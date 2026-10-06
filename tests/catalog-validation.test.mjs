import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// Exercise the actual TS helpers using the existing compiler, with no test dependency.
const modules = new Map();
function loadSource(name) {
  if (modules.has(name)) return modules.get(name);
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const result = { exports: {} };
  const factory = runInThisContext(`(function(require, module, exports) { ${compiled}\n})`);
  factory((specifier) => {
    assert.ok(specifier.startsWith("@/lib/"));
    return loadSource(specifier.slice("@/lib/".length));
  }, result, result.exports);
  modules.set(name, result.exports);
  return result.exports;
}

const { parseCatalogForm } = loadSource("catalog-validation");
const { dosageLabel, periodLabel, posologyLabel, routeLabel } = loadSource("medications");
const { formatQuantity, isCountUnit, unitLabel } = loadSource("units");

function medicationForm(overrides = {}) {
  const data = new FormData();
  const fields = {
    name: "Medicamento de teste", kind: "medicamento", unit: "unidade",
    posologyType: "daily", timesPerDay: "2", doseTimes: ["08:00", "20:00"], posologyNotes: "Orientação informada",
    administrationRoute: "oral", periodType: "indefinite", dosageAmount: "500", dosageUnit: "mg",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
  }
  return data;
}

function parsedMedication(fields) {
  const parsed = parseCatalogForm(medicationForm(fields));
  assert.ok("data" in parsed, JSON.stringify(parsed));
  return parsed.data.medication;
}

test("ordinary items retain the original units and need no medication metadata", () => {
  for (const unit of ["unidade", "ml", "kg"]) {
    const form = new FormData();
    form.set("name", "  Alcool em gel  ");
    form.set("unit", unit);
    assert.deepEqual(parseCatalogForm(form), { data: { name: "Alcool em gel", kind: "item", unit, medication: null } });
  }
});

test("daily medication dosage is independent of stock unit", () => {
  const medication = parsedMedication();
  assert.deepEqual(medication.posology, { type: "daily", timesPerDay: 2, times: ["08:00", "20:00"], notes: "Orientação informada" });
  assert.equal(posologyLabel(medication), "2 vezes ao dia · Horários: 08:00, 20:00 · Orientação informada");
  assert.deepEqual(medication.period, { type: "indefinite" });
  assert.deepEqual(medication.dosage, { amount: 500, unit: "mg" });
  assert.equal(dosageLabel(medication), "500 mg");
  assert.equal(routeLabel(medication), "Oral");
});

test("weekday schedules preserve and deduplicate the selected days", () => {
  const medication = parsedMedication({ posologyType: "weekly", daysOfWeek: ["1", "3", "0", "1"], timesPerDay: "1", doseTimes: ["09:30"], posologyNotes: "" });
  assert.deepEqual(medication.posology.daysOfWeek, [1, 3, 0]);
  assert.equal(posologyLabel(medication), "1 vez ao dia · Seg, Qua, Dom · Horários: 09:30");
});

test("each daily or weekly dose needs one valid time in 24-hour format", () => {
  for (const posologyType of ["daily", "weekly"]) {
    const fields = { posologyType, daysOfWeek: ["1", "5"] };
    for (const doseTimes of [[], ["08:00"], ["08:00", "20:00", "22:00"], ["", "20:00"], ["24:00", "20:00"], ["08:60", "20:00"], ["8:00", "20:00"], ["08:00:30", "20:00"], ["morning", "20:00"]]) {
      assert.ok("error" in parseCatalogForm(medicationForm({ ...fields, doseTimes })), JSON.stringify({ posologyType, doseTimes }));
    }
    const medication = parsedMedication({ ...fields, timesPerDay: "3", doseTimes: ["00:00", "12:15", "23:59"] });
    assert.deepEqual(medication.posology.times, ["00:00", "12:15", "23:59"]);
  }
});

test("legacy schedules stay readable without inventing medication times", () => {
  const medication = parsedMedication({ posologyNotes: "Notas existentes" });
  delete medication.posology.times;
  assert.equal(posologyLabel(medication), "2 vezes ao dia · Notas existentes");
  medication.posology = { type: "weekly", timesPerDay: 1, daysOfWeek: [1, 5], notes: "" };
  assert.equal(posologyLabel(medication), "1 vez ao dia · Seg, Sex");
});

test("free posology, custom route, custom dosage and date period round-trip", () => {
  const medication = parsedMedication({
    posologyType: "free", posologyInstructions: "  Orientação livre\nSegunda linha  ",
    administrationRoute: "outra", customRoute: "Via informada",
    periodType: "range", startDate: "2028-02-29", endDate: "2028-03-15",
    dosageAmount: "0,125", dosageUnit: "outra", customDosageUnit: "mg/dose",
  });
  assert.equal(posologyLabel(medication), "Orientação livre\nSegunda linha");
  assert.equal(routeLabel(medication), "Via informada");
  assert.equal(periodLabel(medication), "29/02/2028 a 15/03/2028");
  assert.equal(dosageLabel(medication), "0,125 mg/dose");
  assert.deepEqual(medication.posology, { type: "free", instructions: "Orientação livre\nSegunda linha" });
});

test("required medication fields, invalid kinds and type-specific stock units are rejected", () => {
  const invalid = [
    { name: "x" }, { name: "x".repeat(81) }, { kind: "other" }, { unit: "kg" },
    { kind: "item", unit: "mg" }, { posologyType: "unknown" }, { timesPerDay: "" },
    { timesPerDay: "1.5" }, { timesPerDay: "0" }, { timesPerDay: "100" },
    { posologyType: "weekly" }, { posologyType: "weekly", daysOfWeek: ["7"] },
    { posologyType: "weekly", daysOfWeek: [""] }, { posologyType: "free", posologyInstructions: " " },
    { posologyNotes: "x".repeat(1001) }, { administrationRoute: "invalid" },
    { administrationRoute: "outra", customRoute: "" }, { periodType: "unknown" },
    { dosageAmount: "0" }, { dosageAmount: "-1" }, { dosageAmount: "NaN" },
    { dosageAmount: "Infinity" }, { dosageAmount: "0.0001" }, { dosageUnit: "unknown" },
    { dosageUnit: "outra", customDosageUnit: "" },
  ];
  for (const fields of invalid) assert.ok("error" in parseCatalogForm(medicationForm(fields)), JSON.stringify(fields));
});

test("period validation rejects missing, impossible and reversed dates", () => {
  for (const [startDate, endDate] of [["", ""], ["2026-02-29", "2026-03-01"], ["2026-13-01", "2027-01-01"], ["2026-10-06", "2026-10-05"], ["0000-01-01", "2026-01-01"]]) {
    assert.ok("error" in parseCatalogForm(medicationForm({ periodType: "range", startDate, endDate })));
  }
  assert.deepEqual(parsedMedication({ periodType: "range", startDate: "2026-10-05", endDate: "2026-10-05" }).period, { type: "range", startDate: "2026-10-05", endDate: "2026-10-05" });
});

test("medication stock units and labels work without converting historical quantities", () => {
  for (const unit of ["unidade", "ml", "mg", "g", "gotas"]) assert.ok("data" in parseCatalogForm(medicationForm({ unit })));
  assert.equal(unitLabel("mg", "long"), "miligramas");
  assert.equal(unitLabel("g", "long"), "gramas");
  assert.equal(unitLabel("gotas", "long"), "gotas");
  assert.equal(isCountUnit("gotas"), true);
  assert.equal(isCountUnit("ml"), false);
  assert.equal(formatQuantity(0.4, "unidade"), "0,4");
  assert.equal(formatQuantity(400, "ml"), "400");
});

test("stock quantity per dose is optional, independent of strength and supports partial units", () => {
  assert.equal(parsedMedication().stockPerDose, undefined);
  for (const value of ["1", "2", "0.5", "0,125", "999999999"]) {
    const medication = parsedMedication({ stockPerDose: value });
    assert.equal(medication.stockPerDose, Number(value.replace(",", ".")));
    assert.deepEqual(medication.dosage, { amount: 500, unit: "mg" });
  }
  for (const stockPerDose of ["0", "-1", "NaN", "Infinity", "0.0001", "1000000000"]) {
    assert.ok("error" in parseCatalogForm(medicationForm({ stockPerDose })), stockPerDose);
  }
});
