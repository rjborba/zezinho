import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const modules = new Map();
function loadSource(path) {
  if (modules.has(path)) return modules.get(path);
  const source = readFileSync(new URL(`../src/lib/${path}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${compiled}\n})`)((specifier) => {
    if (specifier.startsWith("@/lib/")) return loadSource(specifier.slice(6));
    return require(specifier);
  }, result, result.exports);
  modules.set(path, result.exports);
  return result.exports;
}

const { medicationPrintRows, medicationPrintGroups } = loadSource("medication-print");
const item = (id, details = {}, overrides = {}) => ({
  id, name: id, kind: "medicamento", unit: "unidade", archivedAt: null,
  medication: {
    otherNames: ["Marca A", "Marca B"], dosage: { amount: 500, unit: "mg" },
    stockPerDose: 0.5, administrationRoute: "oral", customRoute: "",
    period: { type: "indefinite" },
    posology: { type: "daily", timesPerDay: 2, times: ["20:00", "08:00"], notes: "Após a refeição.\nCom água." },
    ...details,
  }, ...overrides,
});

test("the print plan preserves names, every dose time and all registered instructions without mutating the inventory", () => {
  const items = [item("Ativo")];
  const original = JSON.stringify(items);
  const [row] = medicationPrintRows(items);
  assert.equal(row.name, "Ativo");
  assert.equal(row.commercialNames, "Marca A · Marca B");
  assert.equal(row.dosage, "500 mg");
  assert.deepEqual(row.times, ["08:00", "20:00"]);
  assert.equal(row.timingNote, "");
  assert.equal(row.posology, "2 vezes ao dia · Todos os dias");
  assert.equal(row.amountPerDose, "0,5 un. por tomada");
  assert.equal(row.route, "Oral");
  assert.equal(row.instructions, "Após a refeição.\nCom água.");
  assert.equal("period" in row, false);
  assert.equal(JSON.stringify(items), original);
});

test("weekly plans retain weekdays, ingredient strengths and custom routes without a treatment-period column", () => {
  const [row] = medicationPrintRows([item("Associação", {
    dosage: { components: [{ ingredient: "A", amount: 400, unit: "mg" }, { ingredient: "B", amount: 80, unit: "mg" }] },
    posology: { type: "weekly", timesPerDay: 1, times: ["09:00"], daysOfWeek: [1, 3, 5], notes: "Orientação cadastrada" },
    administrationRoute: "outra", customRoute: "Via cadastrada",
    period: { type: "range", startDate: "2026-10-01", endDate: "2026-11-15" },
  })]);
  assert.equal(row.dosage, "A: 400 mg + B: 80 mg");
  assert.equal(row.posology, "1 vez ao dia · Seg, Qua, Sex");
  assert.equal(row.route, "Via cadastrada");
  assert.equal("period" in row, false);
});

test("time groups repeat each medication at every dose time and put unscheduled medications last", () => {
  const items = [
    item("Z"), item("A"),
    item("Cedo", { posology: { type: "weekly", timesPerDay: 1, times: ["06:00"], daysOfWeek: [1, 3, 5], notes: "" } }),
    item("Livre", { posology: { type: "free", instructions: "Se necessário" } }),
    item("Antigo", { posology: { type: "daily", timesPerDay: 1, notes: "" } }),
    item("Arquivado", {}, { archivedAt: "2026-10-01" }),
  ];
  const original = JSON.stringify(items);
  const groups = medicationPrintGroups(items);
  assert.deepEqual(groups.map((group) => [group.time, group.rows.map((row) => row.name)]), [
    ["06:00", ["Cedo"]], ["08:00", ["A", "Z"]], ["20:00", ["A", "Z"]], ["", ["Antigo", "Livre"]],
  ]);
  assert.equal(groups[0].rows[0].posology, "1 vez ao dia · Seg, Qua, Sex");
  assert.equal(groups[3].rows[1].instructions, "Se necessário");
  assert.equal(JSON.stringify(items), original);
});

test("grouping preserves simultaneous doses and incomplete schedule warnings", () => {
  const groups = medicationPrintGroups([item("Parcial", {
    posology: { type: "daily", timesPerDay: 3, times: ["08:00", "08:00"], notes: "Orientação" },
  })]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].rows.length, 2);
  assert.ok(groups[0].rows.every((row) => row.timingNote === "Horários incompletos"));
  assert.deepEqual(medicationPrintGroups([]), []);
});

test("free, legacy and incomplete schedules stay explicit without invented times or dose quantities", () => {
  const rows = medicationPrintRows([
    item("Livre", { posology: { type: "free", instructions: "Se necessário, conforme orientação." }, stockPerDose: undefined }),
    item("Antigo", { posology: { type: "daily", timesPerDay: 2, notes: "" }, otherNames: [] }),
    item("Parcial", { posology: { type: "daily", timesPerDay: 3, times: ["25:00", "08:00", "08:00"], notes: "" } }),
    item("Incompleto", {}, { medication: null }),
  ]);
  const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
  assert.equal(byName.Livre.timingNote, "Sem horário fixo");
  assert.equal(byName.Livre.instructions, "Se necessário, conforme orientação.");
  assert.equal(byName.Livre.amountPerDose, "");
  assert.equal(byName.Antigo.timingNote, "Não informado");
  assert.equal(byName.Antigo.commercialNames, "Não informado");
  assert.deepEqual(byName.Parcial.times, ["08:00", "08:00"]);
  assert.equal(byName.Parcial.timingNote, "Horários incompletos");
  assert.equal(byName.Incompleto.dosage, "Não informada");
});

test("only active medications print, ordered by first time then name, including all treatment periods", () => {
  const rows = medicationPrintRows([
    item("Z"), item("A"),
    item("Cedo", { posology: { type: "daily", timesPerDay: 1, times: ["06:00"], notes: "" } }),
    item("Livre", { posology: { type: "free", instructions: "Conforme orientação" } }),
    item("Arquivado", {}, { archivedAt: "2026-10-01" }),
    item("Fralda", {}, { kind: "item", medication: null }),
    item("Período definido", { period: { type: "range", startDate: "2026-01-01", endDate: "2026-01-10" } }),
  ]);
  assert.deepEqual(rows.map((row) => row.name), ["Cedo", "A", "Período definido", "Z", "Livre"]);
});

test("print rows and every dose group preserve only the explicit special-control flag", () => {
  const items = [
    item("Controlado", {}, { requiresSpecialControl: true }),
    item("Receita simples", {}, { requiresSpecialControl: false }),
    item("Antigo", {}, { requiresPrescription: true }),
    item("Livre", { posology: { type: "free", instructions: "Conforme orientação" } }, { requiresSpecialControl: true }),
    item("Sem detalhes", {}, { medication: null, requiresSpecialControl: true }),
  ];
  const before = JSON.stringify(items);
  const rows = medicationPrintRows(items);
  assert.deepEqual(Object.fromEntries(rows.map((row) => [row.name, row.requiresSpecialControl])), {
    "Controlado": true, "Receita simples": false, "Antigo": false, "Livre": true, "Sem detalhes": true,
  });
  const groups = medicationPrintGroups(items);
  assert.ok(groups.filter((group) => group.time).every((group) => group.rows.find((row) => row.name === "Controlado").requiresSpecialControl));
  assert.equal(groups.find((group) => !group.time).rows.find((row) => row.name === "Livre").requiresSpecialControl, true);
  assert.equal(JSON.stringify(items), before);
});
