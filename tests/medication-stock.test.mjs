import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const modules = new Map();
function loadSource(path) {
  if (modules.has(path)) return modules.get(path);
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${compiled}\n})`)((specifier) => {
    if (specifier.startsWith("@/lib/")) return loadSource(`${specifier.slice(2)}.ts`);
    assert.ok(["react", "react/jsx-runtime", "lucide-react"].includes(specifier), specifier);
    return require(specifier);
  }, result, result.exports);
  modules.set(path, result.exports);
  return result.exports;
}

const { getMedicationRestockForecast: forecast, medicationStockPerDose } = loadSource("lib/medication-stock.ts");
const { MedicationRestockStatus, MedicationRestockForecast } = loadSource("components/medication-restock-forecast.tsx");

const today = new Date("2026-10-06T07:00:00-03:00");
function stock(overrides = {}, medication = {}) {
  return {
    kind: "medicamento", unit: "unidade", total: 30, hasEntries: true,
    lastRestockedAt: "2026-10-06T07:00:00-03:00",
    medication: {
      posology: { type: "daily", timesPerDay: 2, times: ["08:00", "20:00"], notes: "" },
      dosage: { amount: 500, unit: "mg" }, administrationRoute: "oral", customRoute: "",
      period: { type: "indefinite" }, stockPerDose: 1,
      ...medication,
    },
    ...overrides,
  };
}

test("30 pills twice daily cover 15 days and forecast the first uncovered dose", () => {
  const result = forecast(stock(), today);
  assert.deepEqual(result, {
    status: "estimated", buyDate: "2026-10-21", buyTime: "08:00", daysLeft: 15,
    urgent: false, overdue: false, quantityPerDose: 1, assumedUnitPerDose: false, approximateTimes: false,
  });
});

test("the five-day warning is inclusive and counts down from the original entry", () => {
  for (const [date, days, urgent] of [["2026-10-15", 6, false], ["2026-10-16", 5, true], ["2026-10-17", 4, true], ["2026-10-20", 1, true], ["2026-10-21", 0, true], ["2026-10-25", 0, true]]) {
    const result = forecast(stock(), new Date(`${date}T07:00:00-03:00`));
    assert.equal(result.daysLeft, days, date);
    assert.equal(result.urgent, urgent, date);
    assert.equal(result.buyDate, "2026-10-21");
  }
  assert.equal(forecast(stock(), new Date("2026-10-21T07:59:00-03:00")).overdue, false);
  assert.equal(forecast(stock(), new Date("2026-10-21T08:00:00-03:00")).overdue, true);
});

test("leftover stock contributes to coverage and new restock dates reset the forecast", () => {
  // Purchased 30 + 5 remaining = 35, not 30 and not the sum of all past purchases.
  assert.equal(forecast(stock({ total: 35 }), today).buyDate, "2026-10-23");
  assert.equal(forecast(stock({ total: 35 }), today).buyTime, "20:00");
  assert.equal(forecast(stock({ lastRestockedAt: "2026-10-01T07:00:00-03:00" }), today).daysLeft, 10);
});

test("dose times exclude doses scheduled before the purchase and are sorted without mutation", () => {
  const item = stock({ total: 2, lastRestockedAt: "2026-10-06T12:00:00-03:00" }, { posology: { type: "daily", timesPerDay: 2, times: ["20:00", "08:00"], notes: "" } });
  const before = JSON.stringify(item);
  const result = forecast(item, new Date("2026-10-06T13:00:00-03:00"));
  assert.equal(result.buyDate, "2026-10-07");
  assert.equal(result.buyTime, "20:00");
  assert.equal(JSON.stringify(item), before);
  assert.equal(forecast(stock({ total: 0, lastRestockedAt: "2026-10-06T08:00:01-03:00" }), new Date("2026-10-06T09:00:00-03:00")).buyTime, "20:00");
});

test("weekly schedules count only the selected weekdays, including Sunday and full weeks", () => {
  const medication = { posology: { type: "weekly", timesPerDay: 1, times: ["09:00"], daysOfWeek: [1, 3, 5, 1], notes: "" } };
  const result = forecast(stock({ total: 3 }, medication), today);
  assert.equal(result.buyDate, "2026-10-14");
  assert.equal(result.daysLeft, 8);
  const sunday = forecast(stock({ total: 2 }, { posology: { type: "weekly", timesPerDay: 1, times: ["09:00"], daysOfWeek: [0], notes: "" } }), today);
  assert.equal(sunday.buyDate, "2026-10-25");
});

test("future starts, inclusive end dates and completed periods avoid unnecessary alerts", () => {
  const range = { period: { type: "range", startDate: "2026-10-06", endDate: "2026-10-20" } };
  assert.equal(forecast(stock({}, range), today).status, "covered");
  assert.equal(forecast(stock({}, { period: { ...range.period, endDate: "2026-10-21" } }), today).status, "estimated");
  const future = forecast(stock({ total: 4 }, { period: { type: "range", startDate: "2026-10-10", endDate: "2026-11-01" } }), today);
  assert.equal(future.buyDate, "2026-10-12");
  assert.equal(future.daysLeft, 6);
  assert.equal(future.urgent, false);
  assert.equal(forecast(stock({ hasEntries: false }, { period: { type: "range", startDate: "2026-10-01", endDate: "2026-10-05" } }), today).status, "ended");
});

test("explicit quantities per dose, partial pills and count-based dosage do not confuse strength with stock", () => {
  assert.equal(forecast(stock({ total: 20 }, { stockPerDose: 2 }), today).daysLeft, 5);
  assert.equal(forecast(stock({ total: 5 }, { stockPerDose: 0.5 }), today).daysLeft, 5);
  const capsules = forecast(stock({ total: 20 }, { stockPerDose: undefined, dosage: { amount: 2, unit: "cápsulas" } }), today);
  assert.equal(capsules.daysLeft, 5);
  assert.equal(capsules.quantityPerDose, 2);
  assert.equal(capsules.assumedUnitPerDose, false);
  const legacy = forecast(stock({}, { stockPerDose: undefined }), today);
  assert.equal(legacy.quantityPerDose, 1);
  assert.equal(legacy.assumedUnitPerDose, true);
});

test("compatible volume, drops and mass consume the actual dose amount", () => {
  const liquid = forecast(stock({ unit: "ml", total: 300 }, { stockPerDose: undefined, dosage: { amount: 5, unit: "ml" } }), today);
  assert.equal(liquid.buyDate, "2026-11-05");
  assert.equal(liquid.quantityPerDose, 5);
  assert.equal(forecast(stock({ unit: "gotas", total: 20 }, { stockPerDose: undefined, dosage: { amount: 2, unit: "gotas" } }), today).daysLeft, 5);
  assert.equal(forecast(stock({ unit: "g", total: 0.03 }, { stockPerDose: undefined, dosage: { amount: 5, unit: "mg" } }), today).daysLeft, 3);
  assert.deepEqual(medicationStockPerDose(stock({}, { stockPerDose: undefined, dosage: { amount: 500, unit: "mcg" } }).medication, "mg"), { quantity: 0.5, assumed: false });
  assert.equal(forecast(stock({ unit: "ml", total: 1 }, { stockPerDose: 0.1 }), today).daysLeft, 5);
});

test("unknown concentration, free instructions and missing entries do not fabricate dates", () => {
  for (const unit of ["ml", "gotas", "mg/ml", "%", "mg/dose"]) {
    assert.equal(forecast(stock({}, { stockPerDose: undefined, dosage: { amount: 5, unit } }), today).status, "unavailable");
  }
  assert.equal(forecast(stock({ unit: "ml" }, { stockPerDose: undefined }), today).status, "unavailable");
  assert.equal(forecast(stock({ unit: "gotas" }, { stockPerDose: undefined, dosage: { amount: 5, unit: "mg/ml" } }), today).status, "unavailable");
  assert.equal(forecast(stock({}, { posology: { type: "free", instructions: "Tomar quando necessário" } }), today).status, "unavailable");
  assert.equal(forecast(stock({ hasEntries: false, lastRestockedAt: null }), today).status, "unavailable");
  assert.equal(forecast(stock({ kind: "item", medication: null }), today), null);
});

test("legacy schedules use date-only estimates and empty stock is urgent", () => {
  const result = forecast(stock({}, { posology: { type: "daily", timesPerDay: 2, notes: "" } }), today);
  assert.equal(result.buyDate, "2026-10-21");
  assert.equal(result.buyTime, null);
  assert.equal(result.approximateTimes, true);
  const empty = forecast(stock({ total: 0 }), today);
  assert.equal(empty.daysLeft, 0);
  assert.equal(empty.urgent, true);
});

test("Recife calendar days are used regardless of the host or browser timezone", () => {
  const result = forecast(stock(), new Date("2026-10-07T01:00:00Z"));
  assert.equal(result.daysLeft, 15); // Still October 6 in Recife.
  assert.equal(forecast(stock(), new Date("2026-10-07T03:00:00Z")).daysLeft, 14);
  const leap = forecast(stock({ lastRestockedAt: "2028-02-28T07:00:00-03:00", total: 4 }), new Date("2028-02-28T07:00:00-03:00"));
  assert.equal(leap.buyDate, "2028-03-01");
});

test("invalid or enormous input fails safely without looping across years", () => {
  for (const total of [NaN, Infinity, -1]) assert.equal(forecast(stock({ total }), today).status, "unavailable");
  assert.equal(forecast(stock({ lastRestockedAt: "invalid" }), today).status, "unavailable");
  assert.equal(forecast(stock({ lastRestockedAt: "2026-10-07T07:00:00-03:00" }), today).status, "unavailable");
  assert.equal(forecast(stock(), new Date("invalid")).status, "unavailable");
  assert.equal(forecast(stock({}, { stockPerDose: 0 }), today).status, "unavailable");
  assert.equal(forecast(stock({}, { posology: { type: "weekly", timesPerDay: 2, daysOfWeek: [], notes: "" } }), today).status, "unavailable");
  assert.equal(forecast(stock({}, { posology: { type: "daily", timesPerDay: 2, times: ["24:00", "08:00"], notes: "" } }), today).status, "unavailable");
  assert.equal(forecast(stock({ total: 999999999 }, { stockPerDose: 0.001 }), today).status, "unavailable");
});

test("weekly skipping agrees with a simple dose-by-dose calendar reference", () => {
  for (const daysOfWeek of [[0], [1, 3, 5], [0, 2, 4, 6], [0, 1, 2, 3, 4, 5, 6]]) {
    for (const total of [0, 1, 2, 3, 6, 7, 14, 31, 40]) {
      for (const hour of [7, 12, 21]) {
        const anchor = new Date(`2026-10-06T${String(hour).padStart(2, "0")}:00:00-03:00`);
        const reference = [];
        for (let day = 0; day < 366 && reference.length <= total; day += 1) {
          const date = new Date(Date.UTC(2026, 9, 6 + day));
          if (!daysOfWeek.includes(date.getUTCDay())) continue;
          for (const time of ["08:00", "20:00"]) {
            if (day === 0 && Number(time.slice(0, 2)) < hour) continue;
            reference.push({ date: date.toISOString().slice(0, 10), time });
          }
        }
        const result = forecast(stock({ total, lastRestockedAt: anchor.toISOString() }, { posology: { type: "weekly", timesPerDay: 2, times: ["20:00", "08:00"], daysOfWeek, notes: "" } }), anchor);
        assert.equal(result.buyDate, reference[total].date, JSON.stringify({ total, daysOfWeek, hour }));
        assert.equal(result.buyTime, reference[total].time);
      }
    }
  }
});

test("actual UI renders red at five days, clear text and no alert for covered periods", () => {
  const render = (result) => renderToStaticMarkup(createElement(MedicationRestockStatus, { forecast: result, unit: "unidade" }));
  const sixDays = render(forecast(stock(), new Date("2026-10-15T07:00:00-03:00")));
  assert.doesNotMatch(sixDays, /medication-forecast-urgent/);
  const fiveDays = render(forecast(stock(), new Date("2026-10-16T07:00:00-03:00")));
  assert.match(fiveDays, /medication-forecast-urgent/);
  assert.match(fiveDays, /Restam 5 dias · comprar em breve/);
  assert.match(fiveDays, /21\/10\/2026 às 08:00/);
  assert.match(render(forecast(stock(), new Date("2026-10-21T09:00:00-03:00"))), /Comprar agora/);
  const covered = render(forecast(stock({}, { period: { type: "range", startDate: "2026-10-06", endDate: "2026-10-20" } }), today));
  assert.match(covered, /Estoque suficiente para o período/);
  assert.doesNotMatch(covered, /medication-forecast-urgent/);
  assert.match(render(forecast(stock({}, { stockPerDose: undefined }), today)), /Consideramos 1 unidade por dose; confirme no cadastro/);
  const free = render(forecast(stock({}, { posology: { type: "free", instructions: "Quando necessário" } }), today));
  assert.match(free, /Use uma posologia diária ou por dias da semana/);
  assert.doesNotMatch(free, /Comprar até|medication-forecast-urgent/);
});

test("server-rendered forecast has a stable placeholder instead of a cached current date", () => {
  const html = renderToStaticMarkup(createElement(MedicationRestockForecast, { item: stock() }));
  assert.match(html, /Calculando próxima compra/);
  assert.doesNotMatch(html, /medication-forecast-urgent/);
});

test("restored item editors remain usable without action feedback", () => {
  const source = readFileSync(new URL("../src/components/item-form.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${compiled}\n})`)((specifier) => {
    if (specifier === "react") return { ...require("react"), useId: () => "test-editor", useState: (value) => [value, () => {}], useActionState: () => [undefined, () => {}, false] };
    if (specifier === "@/app/actions") return { createItemAction: () => {}, updateItemAction: () => {} };
    if (specifier === "@/components/medication-fields") return { MedicationFields: () => null };
    if (specifier.startsWith("@/lib/")) return loadSource(`${specifier.slice(2)}.ts`);
    assert.ok(["react/jsx-runtime", "lucide-react"].includes(specifier), specifier);
    return require(specifier);
  }, result, result.exports);
  const html = renderToStaticMarkup(createElement(result.exports.ItemForm, {}));
  assert.match(html, /Cadastrar item/);
});
