import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const modules = new Map();
let uiNow = null;
let openDetails = false;
function loadSource(path) {
  if (modules.has(path)) return modules.get(path);
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${compiled}\n})`)((specifier) => {
    if (specifier === "@/lib/use-current-time") return { useCurrentTime: () => uiNow };
    if (specifier === "react") return { ...require("react"), useState: (initial) => [openDetails || initial, () => {}] };
    if (specifier.startsWith("@/lib/")) return loadSource(`${specifier.slice(2)}.ts`);
    if (specifier.startsWith("@/components/")) return loadSource(`${specifier.slice(2)}.tsx`);
    assert.ok(["react/jsx-runtime", "react", "lucide-react"].includes(specifier), specifier);
    return require(specifier);
  }, result, result.exports);
  modules.set(path, result.exports);
  return result.exports;
}

const { HomeMedicationStockList } = loadSource("components/home-medication-stock-list.tsx");
const item = (overrides = {}, details = {}) => ({
  id: "aciclovir", name: "Aciclovir", kind: "medicamento", unit: "unidade", total: 24, hasEntries: true,
  medication: { dosage: { amount: 400, unit: "mg" }, otherNames: ["Zovirax", "Hervirax"], ...details },
  ...overrides,
});
const render = (items) => renderToStaticMarkup(createElement(HomeMedicationStockList, { items }));

test("home medication rows show names, brands, strength and stock without verbose blocks", () => {
  const html = render([item()]);
  for (const value of ["Aciclovir", "Zovirax · Hervirax", "400 mg", "24", "un.", "Quantidade em estoque:"]) {
    assert.ok(html.includes(value), value);
  }
  assert.equal((html.match(/<li /g) ?? []).length, 1);
  assert.doesNotMatch(html, /medication-forecast|medication-badge|Última reposição|Consumo médio|Média disponível|item-avatar/);
});

test("unknown quantities stay distinct from a recorded zero stock", () => {
  const unknown = render([item({ hasEntries: false, total: 0 })]);
  assert.match(unknown, /<strong>—<\/strong>/);
  assert.match(unknown, /sem entrada/);
  const zero = render([item({ total: 0 })]);
  assert.match(zero, /<strong>0<\/strong>/);
  assert.doesNotMatch(zero, /sem entrada/);
});

test("association strengths and fractional stock keep their separate units", () => {
  const html = render([item({ name: "Associação", total: 12.5, unit: "ml" }, {
    dosage: { components: [{ amount: 400, unit: "mg" }, { amount: 80, unit: "mg" }] },
  })]);
  assert.match(html, /400 mg \+ 80 mg/);
  assert.match(html, /<strong>12,5<\/strong>/);
  assert.match(html, />ml<\/span>/);
});

test("missing brands or medication details do not add empty brand lines or crash", () => {
  const noBrands = render([item({}, { otherNames: [] })]);
  assert.doesNotMatch(noBrands, /medication-commercial-names/);
  const missing = render([item({ medication: null })]);
  assert.match(missing, /Aciclovir/);
  assert.doesNotMatch(missing, /home-medication-dosage|medication-commercial-names/);
});

test("the compact summary preserves all rows and input values", () => {
  const items = [item(), item({ id: "second", name: "Outro medicamento" })];
  const before = JSON.stringify(items);
  assert.equal((render(items).match(/<li /g) ?? []).length, 2);
  assert.equal(JSON.stringify(items), before);
});

test("home shows a special-control badge only when the stored flag is true", () => {
  const html = render([
    item({ name: "Mirtazapina", requiresSpecialControl: true }),
    item({ id: "aciclovir", name: "Aciclovir", requiresSpecialControl: false }),
    item({ id: "antibiotic", name: "Sulfametoxazol + trimetoprima", requiresSpecialControl: false }),
    item({ id: "legacy", name: "Snapshot antigo", requiresPrescription: true }),
  ]);
  assert.equal((html.match(/class="special-control-badge"/g) ?? []).length, 1);
  assert.match(html, /Controle especial/);
  assert.doesNotMatch(html, /Receita necessária/);
  assert.equal((html.match(/<li /g) ?? []).length, 4);
});

test("the compact balance shows live estimated units and opens an auditable reference without inferring missing doses", () => {
  const medication = { dosage: { amount: 400, unit: "mg" }, stockPerDose: 1, otherNames: ["Zovirax"], posology: { type: "daily", timesPerDay: 2, times: ["10:00", "21:00"], notes: "" }, period: { type: "indefinite" } };
  const referenceAt = "2026-10-26T23:59:00-03:00";
  const record = item({ total: 23, stockReferenceAt: referenceAt, medication, medicationHistory: [{ effectiveAt: referenceAt, medication, unit: "unidade" }] });
  try {
    uiNow = Date.parse("2026-10-27T10:00:00-03:00");
    assert.match(render([record]), /<strong>22<\/strong>/);
    assert.match(render([record]), /<span>Restam <\/span><strong>22<\/strong>/);
    assert.doesNotMatch(render([record]), /estimadas|registradas/);
    uiNow = Date.parse("2026-10-27T21:00:00-03:00");
    assert.match(render([record]), /<strong>21<\/strong>/);
    openDetails = true;
    const html = render([record]);
    assert.match(html, /Saldo de referência/);
    assert.match(html, /23 un\./);
    assert.match(html, /Data de referência · Recife/);
    assert.match(html, /2 tomadas previstas/);
    assert.match(html, /Não confirma que as doses foram administradas/);
    const missing = render([item({ ...record, medication: { ...medication, stockPerDose: undefined } })]);
    assert.match(missing, /Confirme a quantidade de estoque por tomada/);
    assert.doesNotMatch(missing, /estimadas|registradas/);
    const prn = { ...medication, posology: { type: "free", instructions: "Se necessário" } };
    assert.match(render([item({ ...record, medication: prn, total: 4 })]), /Uso conforme necessidade: sem desconto automático/);
    openDetails = false;
    assert.match(render([item({ ...record, total: 1 })]), /estimado esgotado/);
    assert.match(render([item({ ...record, total: 1 })]), /<strong>0<\/strong>/);
  } finally {
    uiNow = null;
    openDetails = false;
  }
});

test("Home uses only the remaining quantity label, including singular and recorded balances", () => {
  assert.match(render([item({ total: 1 })]), /<span>Resta <\/span><strong>1<\/strong>/);
  assert.match(render([item({ total: 0 })]), /<span>Restam <\/span><strong>0<\/strong>/);
  assert.doesNotMatch(render([item()]), /estimadas|registradas/);
  assert.doesNotMatch(render([item({ hasEntries: false })]), /<span>Restam /);
});

test("home displays the current calculated balance, refill date and color band without opening details", () => {
  const medication = { dosage: { amount: 400, unit: "mg" }, stockPerDose: 1,
    posology: { type: "daily", timesPerDay: 1, times: ["10:00"], notes: "" }, period: { type: "indefinite" } };
  const referenceAt = "2026-10-26T23:59:00-03:00";
  const record = item({ stockReferenceAt: referenceAt, medication, medicationHistory: [{ effectiveAt: referenceAt, medication, unit: "unidade" }] });
  try {
    uiNow = Date.parse("2026-10-27T09:00:00-03:00");
    for (const [total, severity] of [[1,"critical"],[3,"soon"],[7,"week"],[8,null]]) {
      const html = render([{ ...record, total }]);
      assert.match(html, new RegExp(`<strong>${total}</strong>`));
      assert.match(html, new RegExp(`Acaba em \\d{2}/\\d{2} - ${total} ${total === 1 ? "dia" : "dias"}<`));
      assert.doesNotMatch(html, /Repor/);
      assert.match(html, /28\/10\/2026|30\/10\/2026|03\/11\/2026|04\/11\/2026/);
      if (severity) assert.match(html, new RegExp(`class="home-medication-row stock-urgency-${severity}"`));
      else assert.match(html, /class="home-medication-row"/);
      assert.doesNotMatch(html, /role="dialog"/);
    }
    uiNow = Date.parse("2026-10-27T10:00:00-03:00");
    const exhausted = render([{ ...record, total: 1 }]);
    assert.match(exhausted, /<strong>0<\/strong>/);
    assert.match(exhausted, /home-medication-row stock-urgency-critical/);
    assert.match(exhausted, /Estoque estimado esgotado/);
    const unknown = render([{ ...record, medication: { ...medication, stockPerDose: undefined } }]);
    assert.match(unknown, /Previsão indisponível/);
    assert.match(unknown, /class="home-medication-row"/);
    const prn = render([{ ...record, medication: { ...medication, posology: { type: "free", instructions: "Se necessário" } } }]);
    assert.match(prn, /Uso se necessário · sem previsão/);
  } finally { uiNow = null; }
});

test("scheduled closing balances calculate today's stock, with unconfirmed doses shown as scheduled instead of no entry", () => {
  const medication = { dosage: { amount: 400, unit: "mg" }, stockPerDose: 1,
    posology: { type: "daily", timesPerDay: 2, times: ["10:00", "21:00"], notes: "" }, period: { type: "indefinite" } };
  const referenceAt = "2026-10-26T23:59:00-03:00";
  const record = item({ hasEntries: false, total: 0, lastRestockedAt: null, stockReferenceAt: null, medication,
    scheduledStockAdjustment: { quantity: 23, effectiveAt: referenceAt },
    medicationHistory: [{ effectiveAt: "2026-10-26T08:00:00-03:00", medication, unit: "unidade" }] });
  try {
    uiNow = Date.parse("2026-10-26T20:00:00-03:00");
    const html = render([record]);
    assert.match(html, /<strong>24<\/strong>/);
    assert.match(html, /Acaba em 07\/11 - 12 dias</);
    assert.doesNotMatch(html, /sem entrada/);
    openDetails = true;
    assert.match(render([record]), /Doses previstas até o saldo agendado/);
    assert.match(render([record]), /23 un\./);
    openDetails = false;
    const unknown = render([{ ...record, medication: { ...medication, stockPerDose: undefined } }]);
    assert.match(unknown, /saldo agendado/);
    assert.match(unknown, /23 un\./);
    assert.doesNotMatch(unknown, /sem entrada|<small>estimadas<\/small>/);
  } finally { uiNow = null; openDetails = false; }
});
