import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadSource(path, overrides, modules = new Map()) {
  if (modules.has(path)) return modules.get(path);
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${compiled}\n})`)((specifier) => {
    if (specifier in overrides) return overrides[specifier];
    if (specifier.startsWith("@/lib/")) return loadSource(`${specifier.slice(2)}.ts`, overrides, modules);
    if (specifier.startsWith("@/components/")) return loadSource(`${specifier.slice(2)}.tsx`, overrides, modules);
    assert.ok(["react", "react/jsx-runtime", "lucide-react"].includes(specifier), specifier);
    return require(specifier);
  }, result, result.exports);
  modules.set(path, result.exports);
  return result.exports;
}

test("inventory selects and exposes special-control flags without changing stock or medication metadata", async () => {
  const medication = { dosage: { amount: 400, unit: "mg" } };
  const base = {
    unit: "unidade", kind: "medicamento", medication, archived_at: null,
    created_at: "2026-10-01T10:00:00Z",
    stock_entries: [{ quantity: 20, remaining_quantity: 4, created_at: "2026-10-01T10:00:00Z" }],
  };
  const rows = [
    { ...base, id: "required", name: "Controle especial", requires_special_control: true },
    { ...base, id: "not-required", name: "Receita simples", requires_special_control: false },
    { ...base, id: "legacy", name: "Snapshot antigo", requires_prescription: true },
    { ...base, id: "archived", name: "Arquivado", requires_special_control: true, archived_at: "2026-10-02T10:00:00Z" },
  ];
  const before = JSON.stringify(rows);
  let selected;
  const supabase = { from(table) {
    return {
      select(columns) { if (table === "items") selected = columns; return this; },
      order() { return this; }, limit() { return this; },
      then(resolve, reject) { return Promise.resolve({ data: table === "items" ? rows : [], error: null }).then(resolve, reject); },
    };
  } };
  const { getInventory } = loadSource("lib/inventory.ts", {
    "next/cache": { cacheLife() {}, cacheTag() {} },
    "next/server": { connection: async () => {} },
    "@/lib/supabase": { getSupabase: () => supabase, isSupabaseConfigured: () => true },
  });
  const inventory = await getInventory();
  assert.equal(inventory.error, false);
  assert.ok(selected.split(",").includes("requires_special_control"));
  assert.deepEqual(inventory.items.map((item) => item.requiresSpecialControl), [true, false, false]);
  assert.equal(inventory.archivedItems[0].requiresSpecialControl, true);
  assert.ok(inventory.items.every((item) => !Object.hasOwn(item, "requiresPrescription")));
  assert.ok(inventory.items.every((item) => item.total === 24 && item.medication === medication));
  assert.equal(JSON.stringify(rows), before);
});

test("demo records explicitly default to no special-control flag", async () => {
  const { getInventory } = loadSource("lib/inventory.ts", {
    "next/cache": { cacheLife() {}, cacheTag() {} },
    "next/server": { connection: async () => {} },
    "@/lib/supabase": { isSupabaseConfigured: () => false },
  });
  const inventory = await getInventory();
  assert.equal(inventory.configured, false);
  assert.ok([...inventory.items, ...inventory.archivedItems].every((item) => item.requiresSpecialControl === false));
});

test("normal catalog edits leave the separate database special-control flag untouched", async () => {
  const payload = { name: "Aciclovir", unit: "unidade", kind: "medicamento", medication: { dosage: { amount: 400, unit: "mg" } } };
  let updated;
  const { updateItemAction } = loadSource("app/actions.ts", {
    "next/cache": { revalidatePath() {}, updateTag() {} },
    "@/lib/catalog-validation": { parseCatalogForm: () => ({ data: payload }) },
    "@/lib/supabase": { isSupabaseConfigured: () => true, getSupabase: () => ({ from() {
      return { update(data) { updated = data; return this; }, eq() { return this; }, select() { return this; }, maybeSingle: async () => ({ data: { id: "required" }, error: null }) };
    } }) },
  });
  const form = new FormData();
  form.set("itemId", "required");
  const result = await updateItemAction(undefined, form);
  assert.equal(result.status, "success");
  assert.equal(updated, payload);
  assert.equal(Object.hasOwn(updated, "requires_special_control"), false);
});

test("the shared badge uses readable text and renders nothing for unflagged records", () => {
  const { SpecialControlBadge } = loadSource("components/special-control-badge.tsx", {});
  assert.match(renderToStaticMarkup(createElement(SpecialControlBadge, { required: true })), /Controle especial/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(SpecialControlBadge, { required: true })), /Receita necessária/);
  assert.equal(renderToStaticMarkup(createElement(SpecialControlBadge, { required: false })), "");
});

test("catalog medication rows display the flag independently of their dosage and brand metadata", () => {
  const { ItemRow } = loadSource("components/item-row.tsx", {
    "@/app/actions": { setItemArchivedAction() {} },
    "@/components/item-form": { ItemForm: () => null },
    "react-dom": { useFormStatus: () => ({ pending: false }) },
  });
  const item = { id: "required", name: "Teste", unit: "unidade", kind: "medicamento", medication: null, requiresSpecialControl: true, archivedAt: null, lastRestockedAt: null };
  const render = (overrides) => renderToStaticMarkup(createElement(ItemRow, { item: { ...item, ...overrides } }));
  assert.match(render({}), /Controle especial/);
  assert.doesNotMatch(render({}), /class="medication-badge"/);
  assert.doesNotMatch(render({ requiresSpecialControl: false }), /class="medication-badges"/);
  assert.doesNotMatch(render({ requiresSpecialControl: false }), /Controle especial/);
  assert.doesNotMatch(render({ kind: "item" }), /Controle especial/);
});

const scheduledMedication = (overrides = {}) => ({
  id: "controlled", name: "Controlado", kind: "medicamento", unit: "unidade", archivedAt: null,
  requiresSpecialControl: true,
  medication: {
    dosage: { amount: 25, unit: "mg" }, otherNames: ["Marca"],
    posology: { type: "daily", timesPerDay: 2, times: ["08:00", "20:00"], notes: "" },
    administrationRoute: "oral", customRoute: "", period: { type: "indefinite" },
  },
  ...overrides,
});

test("calendar cards show and announce special control on each dose, including untimed cards", () => {
  const { MedicationCalendar } = loadSource("components/medication-calendar.tsx", {
    "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
    "@/lib/use-current-time": { useCurrentTime: () => Date.parse("2026-10-25T12:00:00-03:00") },
    "@/components/modal": { Modal: () => null },
  });
  const items = [
    scheduledMedication(),
    scheduledMedication({ id: "simple", requiresSpecialControl: false }),
    scheduledMedication({ id: "untimed", medication: { ...scheduledMedication().medication, posology: { type: "free", instructions: "Conforme orientação" } } }),
  ];
  const html = renderToStaticMarkup(createElement(MedicationCalendar, { items }));
  assert.equal((html.match(/class="special-control-badge"/g) ?? []).length, 3);
  assert.equal((html.match(/aria-label="[^"]*Controle especial\. Ver detalhes"/g) ?? []).length, 3);
});

test("the A4 print sheet renders the same badge at every registered dose only for flagged medications", () => {
  const { MedicationPrintSheet } = loadSource("components/medication-print-sheet.tsx", {
    "./medication-print.module.css": { default: new Proxy({}, { get: (_target, name) => String(name) }) },
  });
  const items = [scheduledMedication(), scheduledMedication({ id: "simple", name: "Receita simples", requiresSpecialControl: false })];
  const html = renderToStaticMarkup(createElement(MedicationPrintSheet, { items, generatedAt: "2026-10-25T12:00:00-03:00" }));
  assert.equal((html.match(/class="special-control-badge specialControlBadge"/g) ?? []).length, 2);
  assert.equal((html.match(/>Controle especial<\/span>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Receita necessária/);
});
