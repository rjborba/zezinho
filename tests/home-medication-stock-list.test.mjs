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
function loadSource(path) {
  if (modules.has(path)) return modules.get(path);
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${compiled}\n})`)((specifier) => {
    if (specifier.startsWith("@/lib/")) return loadSource(`${specifier.slice(2)}.ts`);
    if (specifier.startsWith("@/components/")) return loadSource(`${specifier.slice(2)}.tsx`);
    assert.equal(specifier, "react/jsx-runtime");
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
