import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function sourceLoader(overrides = {}, globals = {}) {
  const modules = new Map();
  return function load(path) {
    if (modules.has(path)) return modules.get(path);
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const result = { exports: {} };
    runInThisContext(`(function(require, module, exports, Date, document, setTimeout, clearTimeout) { ${compiled}\n})`)((specifier) => {
      if (specifier in overrides) return overrides[specifier];
      if (specifier.startsWith("@/")) return load(`${specifier.slice(2)}.${specifier.startsWith("@/components/") ? "tsx" : "ts"}`);
      assert.ok(["react", "react/jsx-runtime", "lucide-react"].includes(specifier), specifier);
      return require(specifier);
    }, result, result.exports, globals.Date ?? Date, globals.document, globals.setTimeout ?? setTimeout, globals.clearTimeout ?? clearTimeout);
    modules.set(path, result.exports);
    return result.exports;
  };
}

const load = sourceLoader();
const { formatEntryDateTime, parseEntryDateTime, entryTimestampForUpdate } = load("lib/entry-dates.ts");
const { summarizeStockEntries: summarize } = load("lib/inventory-stock.ts");
const { getMedicationRestockForecast: forecast } = load("lib/medication-stock.ts");
const { EntryDateField } = load("components/entry-date-field.tsx");
const { formatDate } = load("lib/units.ts");
const now = new Date("2026-10-06T12:00:00-03:00");
const entry = (date, quantity = 30, remaining = 0) => ({ created_at: `${date}-03:00`, quantity, remaining_quantity: remaining });

test("past and future local dates round-trip in Recife, including midnight and leap days", () => {
  for (const local of ["2020-01-01T00:00", "2026-10-06T12:00", "2026-10-07T23:59", "2028-02-29T08:15"]) {
    const timestamp = parseEntryDateTime(local);
    assert.equal(timestamp, new Date(`${local}:00-03:00`).toISOString());
    assert.equal(formatEntryDateTime(timestamp), local);
  }
  assert.equal(formatEntryDateTime("2026-10-07T01:00:00Z"), "2026-10-06T22:00");
});

test("missing, malformed, impossible and timezone-bearing input is rejected", () => {
  for (const value of [null, undefined, "", "2026-02-29T08:00", "2026-04-31T08:00", "2026-13-01T08:00", "2026-10-00T08:00", "0000-01-01T00:00", "2026-10-06T24:00", "2026-10-06T12:60", "2026-10-06T8:00", "2026-10-06T08:00Z", "2026-10-06T08:00:00", "2026-10-06", "tomorrow", new File(["date"], "date.txt")]) {
    assert.equal(parseEntryDateTime(value), null, String(value));
  }
});

test("editing quantities preserves the original exact timestamp unless the date changes", () => {
  const previous = "2026-10-06T15:24:39.123456+00:00";
  assert.equal(entryTimestampForUpdate("2026-10-06T12:24", previous), previous);
  assert.equal(entryTimestampForUpdate("2026-10-07T12:24", previous), "2026-10-07T15:24:00.000Z");
  assert.equal(entryTimestampForUpdate("2026-02-29T12:24", previous), null);
});

test("date fields are required, accessible and allow past and future dates", () => {
  const html = renderToStaticMarkup(createElement(EntryDateField, { id: "test-date", defaultValue: "2026-10-06T12:00" }));
  assert.match(html, /type="datetime-local"/);
  assert.match(html, /name="entryDate"/);
  assert.match(html, /value="2026-10-06T12:00"/);
  assert.match(html, /required=""/);
  assert.match(html, /aria-describedby="test-date-hint"/);
  assert.match(html, /Horário de Recife/);
  assert.doesNotMatch(html, /\smin=/);
  assert.match(formatDate("2030-01-01T12:00:00Z"), /2030/);
  assert.match(formatDate("2030-01-01T12:00:00Z"), /09:00/);
});

test("new and restored Entrada forms expose the date field without missing-feedback crashes", () => {
  const fixture = { id: "item", name: "Teste", unit: "ml", kind: "item", medication: null };
  const loader = sourceLoader({
    react: { ...require("react"), useId: () => "test-entry", useState: (value) => [typeof value === "function" ? value() : value, () => {}], useActionState: () => [undefined, () => {}, false] },
    "@/app/actions": { createEntryAction() {}, updateEntryAction() {}, deleteEntryAction() {} },
    "@/components/searchable-item-select": { SearchableItemSelect: () => null },
  });
  const html = renderToStaticMarkup(createElement(loader("components/entry-form.tsx").EntryForm, { items: [fixture], kind: "item" }));
  assert.match(html, /name="entryDate"/);
  assert.match(html, /Confirmar entrada/);
});

test("scheduled history entries show their status and existing date in the editor", () => {
  const fixture = { id: "item", name: "Teste", unit: "ml", kind: "item", medication: null };
  const loader = sourceLoader({
    react: { ...require("react"), useState: (value) => [value === false ? true : value, () => {}], useActionState: () => [undefined, () => {}, false] },
    "react-dom": { useFormStatus: () => ({ pending: false }) },
    "@/app/actions": { updateEntryAction() {}, deleteEntryAction() {} },
    "@/components/searchable-item-select": { SearchableItemSelect: () => null },
  });
  const history = { id: "entry", itemId: "item", itemName: "Teste", unit: "ml", kind: "item", quantity: 20, remainingQuantity: 2, createdAt: "2030-01-01T12:00:00Z", scheduled: true };
  const html = renderToStaticMarkup(createElement(loader("components/entry-history.tsx").EntryHistory, { items: [fixture], entries: [history] }));
  assert.match(html, /Agendada/);
  assert.match(html, /2030/);
  assert.match(html, /value="2030-01-01T09:00"/);
  assert.match(html, /Salvar alteração/);
});

test("backdated entries are ordered by their chosen date and leave newer stock unchanged", () => {
  const entries = [entry("2026-10-05T12:00:00", 20, 2), entry("2026-10-01T12:00:00", 30, 5)];
  const before = JSON.stringify(entries);
  assert.deepEqual(summarize(entries, now), { total: 22, averagePerDay: 8.25, hasEntries: true, lastRestockedAt: entries[0].created_at, nextEntryAt: null });
  assert.equal(JSON.stringify(entries), before);
});

test("future entries do not replace today's stock, average or last restock", () => {
  const existing = [entry("2026-10-01T12:00:00", 30, 5), entry("2026-10-05T12:00:00", 20, 2)];
  const future = entry("2026-10-06T12:01:00", 90, 10);
  const result = summarize([future, ...existing], now);
  assert.deepEqual(result, { ...summarize(existing, now), nextEntryAt: future.created_at });
  const activated = summarize([future, ...existing], new Date(future.created_at));
  assert.equal(activated.total, 100);
  assert.equal(activated.lastRestockedAt, future.created_at);
  assert.equal(activated.nextEntryAt, null);
});

test("only scheduled entries means no current stock, and legacy additive stock ignores future purchases", () => {
  const future = entry("2026-10-07T12:00:00", 100, null);
  assert.deepEqual(summarize([future], now), { total: 0, averagePerDay: null, hasEntries: false, lastRestockedAt: null, nextEntryAt: future.created_at });
  assert.equal(summarize([future, entry("2026-10-01T12:00:00", 30, null), entry("2026-10-05T12:00:00", 20, null)], now).total, 50);
});

test("a future medication purchase does not clear today's five-day warning", () => {
  const medication = { posology: { type: "daily", timesPerDay: 2, times: ["08:00", "20:00"], notes: "" }, period: { type: "indefinite" }, dosage: { amount: 500, unit: "mg" }, stockPerDose: 1 };
  const existing = entry("2026-10-01T07:00:00", 20, 0);
  const future = entry("2026-10-07T07:00:00", 60, 0);
  const result = forecast({ kind: "medicamento", unit: "unidade", medication, ...summarize([existing, future], now) }, now);
  assert.equal(result.daysLeft, 5);
  assert.equal(result.urgent, true);
  assert.equal(result.buyDate, "2026-10-11");
  assert.equal(forecast({ kind: "medicamento", unit: "unidade", medication, total: 20, hasEntries: true, lastRestockedAt: "2026-10-06T12:01:00-03:00" }, now).status, "unavailable");
});

test("medication countdowns refresh their shared clock when a scheduled restock activates", () => {
  const timestamp = "2026-10-06T15:01:00Z";
  const current = new Date(timestamp).getTime() + 1000;
  let clockSnapshot;
  const effects = [];
  const loader = sourceLoader({ react: {
    useEffect: (effect, dependencies) => effects.push({ effect, dependencies }),
    useSyncExternalStore: (_subscribe, getSnapshot) => {
      clockSnapshot = getSnapshot;
      return getSnapshot() ?? current - 60_000;
    },
  } }, { Date: class extends Date { static now() { return current; } } });
  const { MedicationRestockForecast } = loader("components/medication-restock-forecast.tsx");
  const item = { kind: "medicamento", unit: "unidade", total: 60, hasEntries: true, lastRestockedAt: timestamp, medication: { posology: { type: "daily", timesPerDay: 2, times: ["08:00", "20:00"], notes: "" }, period: { type: "indefinite" }, dosage: { amount: 500, unit: "mg" }, stockPerDose: 1 } };
  assert.equal(MedicationRestockForecast({ item }).props.forecast.status, "unavailable");
  assert.deepEqual(effects[0].dependencies, [timestamp]);
  effects[0].effect();
  assert.equal(clockSnapshot(), current);
  assert.equal(MedicationRestockForecast({ item }).props.forecast.status, "estimated");
});

function actionsFixture(options = {}) {
  const writes = [];
  const invalidations = [];
  const item = { name: "Teste", unit: "ml", kind: "item", archived_at: null, ...options.item };
  const previous = options.previous ?? { created_at: "2026-10-06T15:00:39.123456Z" };
  const supabase = { from(table) {
    let updating = false;
    return {
      select() { return this; }, eq() { return this; },
      async single() { assert.equal(table, "items"); return { data: item, error: null }; },
      async maybeSingle() { return { data: updating ? options.updated === false ? null : { id: "entry" } : options.missing ? null : previous, error: null }; },
      async insert(data) { writes.push({ type: "insert", table, data }); return { error: null }; },
      update(data) { updating = true; writes.push({ type: "update", table, data }); return this; },
    };
  } };
  const actions = sourceLoader({ "next/cache": { revalidatePath: (path) => invalidations.push(path), updateTag: (tag) => invalidations.push(tag) }, "@/lib/supabase": { getSupabase: () => supabase, isSupabaseConfigured: () => true } })("app/actions.ts");
  const form = (overrides = {}) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ entryId: "entry", itemId: "item", kind: "item", quantity: "12.5", remainingQuantity: "3", entryDate: "2026-10-06T12:00", ...overrides })) data.set(key, value);
    return data;
  };
  return { actions, writes, invalidations, form };
}

test("creation actions save explicit past and future timestamps with quantities unchanged", async () => {
  for (const entryDate of ["2026-10-01T00:00", "2027-01-01T23:59"]) {
    const { actions, writes, invalidations, form } = actionsFixture();
    assert.equal((await actions.createEntryAction({}, form({ entryDate }))).status, "success");
    assert.deepEqual(writes, [{ type: "insert", table: "stock_entries", data: { item_id: "item", quantity: 12.5, remaining_quantity: 3, created_at: parseEntryDateTime(entryDate) } }]);
    assert.ok(invalidations.includes("inventory"));
  }
});

test("update actions save changed dates and preserve precise unchanged dates", async () => {
  for (const entryDate of ["2026-10-06T12:00", "2027-01-01T09:00", "2026-09-01T09:00"]) {
    const { actions, writes, form } = actionsFixture();
    assert.equal((await actions.updateEntryAction({}, form({ entryDate }))).status, "success");
    assert.equal(writes[0].data.created_at, entryDate === "2026-10-06T12:00" ? "2026-10-06T15:00:39.123456Z" : parseEntryDateTime(entryDate));
    assert.equal(writes[0].data.quantity, 12.5);
    assert.equal(writes[0].data.remaining_quantity, 3);
  }
});

test("invalid dates never reach the database through either action", async () => {
  const { actions, writes, form } = actionsFixture();
  for (const action of [actions.createEntryAction, actions.updateEntryAction]) {
    for (const entryDate of ["", "2026-02-29T08:00", "2026-10-06T24:00"]) {
      const result = await action({}, form({ entryDate }));
      assert.equal(result.status, "error");
      assert.match(result.message, /data e hora válidas/);
    }
  }
  assert.equal(writes.length, 0);
});

test("missing entries and failed updates do not report success", async () => {
  for (const options of [{ missing: true }, { updated: false }]) {
    const { actions, writes, form } = actionsFixture(options);
    assert.equal((await actions.updateEntryAction({}, form())).status, "error");
    if (options.missing) assert.equal(writes.length, 0);
  }
});

test("scheduled medication entries retain whole-unit and selected-kind validation", async () => {
  const { actions, writes, form } = actionsFixture({ item: { kind: "medicamento", unit: "unidade" } });
  assert.equal((await actions.createEntryAction({}, form({ kind: "medicamento", entryDate: "2027-01-01T08:00" }))).status, "error");
  assert.equal((await actions.createEntryAction({}, form({ quantity: "30", entryDate: "2027-01-01T08:00" }))).status, "error");
  assert.equal(writes.length, 0);
  assert.equal((await actions.createEntryAction({}, form({ kind: "medicamento", quantity: "30", entryDate: "2027-01-01T08:00" }))).status, "success");
  assert.equal(writes[0].data.quantity, 30);
});

test("scheduled refresh activates once, rechecks background tabs and cleans up", () => {
  let clock = Date.parse("2026-10-06T15:00:00Z");
  const timestamp = "2026-10-06T15:01:00Z";
  let refreshes = 0;
  let timeout;
  let visibility;
  let cleaned = false;
  const loader = sourceLoader({
    react: { useEffect: (effect) => { cleanup = effect(); } },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshes += 1; } }) },
  }, {
    Date: class extends Date { static now() { return clock; } },
    document: { addEventListener: (event, callback) => { assert.equal(event, "visibilitychange"); visibility = callback; }, removeEventListener: (event, callback) => { assert.equal(callback, visibility); cleaned = true; } },
    setTimeout: (callback, delay) => { timeout = { callback, delay }; return 1; },
    clearTimeout: () => {},
  });
  let cleanup;
  loader("components/scheduled-entry-refresh.tsx").ScheduledEntryRefresh({ at: timestamp });
  assert.equal(timeout.delay, 60_000);
  assert.equal(refreshes, 0);
  clock = Date.parse(timestamp);
  visibility();
  timeout.callback();
  assert.equal(refreshes, 1);
  cleanup();
  assert.equal(cleaned, true);
});

test("inventory requests re-evaluate the same database snapshot when a scheduled entry becomes due", async () => {
  let clock = Date.parse("2026-10-06T15:00:00Z");
  let connections = 0;
  const existing = entry("2026-10-01T07:00:00", 30, 2);
  const future = entry("2026-10-06T12:01:00", 60, 1);
  const rows = {
    items: [{ id: "item", name: "Teste", unit: "unidade", kind: "item", medication: null, archived_at: null, created_at: "2026-10-01T10:00:00Z", stock_entries: [existing, future] }],
    stock_entries: [{ id: "future", item_id: "item", ...future, items: { name: "Teste", unit: "unidade", kind: "item" } }],
  };
  const supabase = { from(table) {
    return { select() { return this; }, order() { return this; }, limit() { return this; }, then(resolve, reject) { return Promise.resolve({ data: rows[table], error: null }).then(resolve, reject); } };
  } };
  const { getInventory } = sourceLoader({
    "next/cache": { cacheLife() {}, cacheTag() {} },
    "next/server": { connection: async () => { connections += 1; } },
    "@/lib/supabase": { getSupabase: () => supabase, isSupabaseConfigured: () => true },
  }, { Date: class extends Date { constructor(value) { super(value ?? clock); } } })("lib/inventory.ts");
  const before = JSON.stringify(rows);
  const scheduled = await getInventory();
  assert.equal(scheduled.error, false);
  assert.equal(scheduled.items[0].total, 32);
  assert.equal(scheduled.recentEntries[0].scheduled, true);
  assert.equal(scheduled.nextScheduledEntryAt, future.created_at);
  clock = new Date(future.created_at).getTime();
  const activated = await getInventory();
  assert.equal(activated.items[0].total, 61);
  assert.equal(activated.recentEntries[0].scheduled, false);
  assert.equal(activated.nextScheduledEntryAt, null);
  assert.equal(connections, 2);
  assert.equal(JSON.stringify(rows), before);
});
