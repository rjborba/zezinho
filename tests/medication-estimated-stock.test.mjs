import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

function load(path) {
  const result = { exports: {} };
  const source = readFileSync(new URL(`../src/lib/${path}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInThisContext(`(function(require,module,exports){${compiled}\n})`)((name) => load(name.replace("@/lib/", "")), result, result.exports);
  return result.exports;
}
const { getMedicationStockEstimate: estimate, getMedicationRestockForecast: forecast, medicationStockUrgency: urgency } = load("medication-stock");
const regimen = (overrides = {}) => ({
  dosage: { amount: 400, unit: "mg" }, stockPerDose: 1, administrationRoute: "oral", customRoute: "",
  posology: { type: "daily", timesPerDay: 2, times: ["10:00", "21:00"], notes: "" }, period: { type: "indefinite" }, ...overrides,
});
const version = (effectiveAt, medication, unit = "unidade") => ({ effectiveAt, medication, unit });
const base = "2026-10-26T23:59:00-03:00";
const item = (overrides = {}) => ({
  kind: "medicamento", unit: "unidade", total: 23, hasEntries: true, lastRestockedAt: null,
  stockReferenceAt: base, medication: regimen(), medicationHistory: [version(base, regimen())], ...overrides,
});
const at = (date) => new Date(date + "-03:00");

test("23 aciclovir tablets become 22 and 21 only as the next day's exact dose times pass", () => {
  for (const [time, remaining, doses] of [["09:59:59",23,0],["10:00:00",22,1],["20:59:59",22,1],["21:00:00",21,2]]) {
    const result = estimate(item(), at(`2026-10-27T${time}`));
    assert.equal(result.status, "estimated");
    assert.equal(result.remaining, remaining);
    assert.equal(result.doses, doses);
    assert.equal(result.referenceQuantity, 23);
  }
  assert.equal(estimate(item(), new Date(base)).remaining, 23);
  assert.equal(estimate(item(), at("2026-10-26T21:00:00")).status, "unavailable");
});

test("reference-time doses are already included in the recorded balance and midnight uses Recife", () => {
  const medication = regimen({ posology: { type: "daily", timesPerDay: 2, times: ["00:00", "23:59"], notes: "" } });
  const record = item({ stockReferenceAt: "2026-12-31T23:59:00-03:00", medication, medicationHistory: undefined });
  assert.equal(estimate(record, at("2026-12-31T23:59:00")).remaining, 23);
  assert.equal(estimate(record, new Date("2027-01-01T02:59:59.999Z")).remaining, 23);
  assert.equal(estimate(record, new Date("2027-01-01T03:00:00Z")).remaining, 22);
});

test("weekly schedules and inclusive treatment periods skip off days and stop consumption after treatment", () => {
  const medication = regimen({ posology: { type: "weekly", timesPerDay: 2, times: ["10:00", "21:00"], daysOfWeek: [2,4], notes: "" }, period: { type: "range", startDate: "2026-10-27", endDate: "2026-10-29" } });
  const record = item({ medication, medicationHistory: [version(base, medication)] });
  assert.equal(estimate(record, at("2026-10-28T23:59:00")).remaining, 21);
  assert.equal(estimate(record, at("2027-01-01T23:59:00")).remaining, 19);
});

test("missing per-dose amounts are not inferred from mg, PRN never auto-decrements and incomplete schedules stay explicit", () => {
  for (const medication of [regimen({ stockPerDose: undefined }), regimen({ posology: { type: "free", instructions: "Se necessário" } }), regimen({ posology: { type: "daily", timesPerDay: 2, notes: "" } })]) {
    assert.equal(estimate(item({ medication, medicationHistory: [version(base, medication)] }), at("2026-10-27T23:59:00")).status, "unavailable");
  }
  assert.equal(estimate(item({ hasEntries: false }), at("2026-10-27T23:59:00")).status, "unavailable");
  assert.equal(estimate(item({ medicationHistory: [] }), at("2026-10-27T23:59:00")).status, "unavailable");
  assert.equal(estimate(item({ medicationHistory: [version("2026-10-27T00:00:00-03:00", regimen())] }), at("2026-10-27T23:59:00")).status, "unavailable");
});

test("changes apply prospectively, including changed dose amounts and a change exactly at a dose time", () => {
  const changedAt = "2026-10-27T15:00:00-03:00";
  const next = regimen({ stockPerDose: 2, posology: { type: "daily", timesPerDay: 1, times: ["18:00"], notes: "" } });
  const record = item({ medication: next, medicationHistory: [version(changedAt, next), version(base, regimen())] });
  const before = JSON.stringify(record);
  const result = estimate(record, at("2026-10-27T21:00:00"));
  assert.equal(result.remaining, 20); // old 10:00 dose + new 18:00 dose of two tablets
  assert.equal(result.doses, 2);
  assert.equal(JSON.stringify(record), before);
  const boundary = item({ medication: next, medicationHistory: [version(base, regimen()), version("2026-10-27T10:00:00-03:00", next)] });
  assert.equal(estimate(boundary, at("2026-10-27T10:00:00")).remaining, 23); // old 10:00 no longer applies
  const sameTime = regimen({ stockPerDose: 2 });
  assert.equal(estimate(item({ medication: sameTime, medicationHistory: [version(base, regimen()), version("2026-10-27T10:00:00-03:00", sameTime)] }), at("2026-10-27T10:00:00")).remaining, 21);
});

test("a new balance resets consumption while preserving prior regimen versions", () => {
  const record = item({ total: 50, stockReferenceAt: "2026-10-28T12:00:00-03:00" });
  assert.equal(estimate(record, at("2026-10-28T21:00:00")).remaining, 49);
  assert.equal(estimate(record, at("2026-10-29T10:00:00")).remaining, 48);
});

test("unknown historical consumption and changed stock units require a fresh balance instead of a guess", () => {
  const changedAt = "2026-10-28T15:00:00-03:00";
  const unknown = regimen({ stockPerDose: undefined });
  assert.equal(estimate(item({ medicationHistory: [version(base, unknown), version(changedAt, regimen())] }), at("2026-10-29T21:00:00")).status, "unavailable");
  const earlierConfirmation = "2026-10-27T09:00:00-03:00";
  assert.equal(estimate(item({ medicationHistory: [version(base, unknown), version(earlierConfirmation, regimen())] }), at("2026-10-27T21:00:00")).remaining, 21);
  assert.equal(estimate(item({ medicationHistory: [version(base, regimen(), "ml")] }), at("2026-10-27T21:00:00")).status, "unavailable");
});

test("fractional doses remain fractional and exhausted stock clamps at zero without losing predicted consumption", () => {
  const medication = regimen({ stockPerDose: 0.5 });
  const record = item({ total: 1.5, medication, medicationHistory: [version(base, medication)] });
  assert.equal(estimate(record, at("2026-10-27T10:00:00")).remaining, 1);
  const result = estimate(record, at("2026-10-29T21:00:00"));
  assert.equal(result.remaining, 0);
  assert.equal(result.consumed, 3);
  assert.equal(result.exhausted, true);
});

test("large date ranges use full-week arithmetic and forecasts use remaining stock after historical schedules", () => {
  const historic = item({ stockReferenceAt: "0001-01-01T00:00:00-03:00", medicationHistory: undefined });
  const result = estimate(historic, at("9999-12-30T23:59:59"));
  assert.equal(result.status, "estimated");
  assert.ok(result.doses > 7_000_000);
  const next = regimen({ posology: { type: "daily", timesPerDay: 1, times: ["18:00"], notes: "" } });
  const record = item({ total: 3, medication: next, medicationHistory: [version(base, regimen()), version("2026-10-27T15:00:00-03:00", next)] });
  const prediction = forecast(record, at("2026-10-27T19:00:00"));
  assert.equal(prediction.buyDate, "2026-10-29");
  assert.equal(prediction.buyTime, "18:00");
});

test("full-week arithmetic agrees with counting each dose across leap days and arbitrary partial-day bounds", () => {
  for (let seed = 0; seed < 28; seed++) {
    const lower = at(`2028-02-${String(1 + seed % 25).padStart(2,"0")}T${seed % 2 ? "10:00:00" : "23:59:00"}`);
    const upper = new Date(lower.getTime() + (1 + seed * 11) * 86_400_000 + 6 * 3_600_000);
    const daysOfWeek = [seed % 7, (seed + 2) % 7, (seed + 5) % 7];
    const medication = regimen({ stockPerDose: 0.5, posology: { type: "weekly", timesPerDay: 2, times: ["10:00", "21:00"], daysOfWeek, notes: "" } });
    const record = item({ total: 1000, stockReferenceAt: lower.toISOString(), medication, medicationHistory: undefined });
    let expected = 0;
    const date = new Date(lower.getTime() - 3 * 3_600_000).toISOString().slice(0,10);
    for (let day = new Date(`${date}T00:00:00Z`).getTime(); day <= upper.getTime(); day += 86_400_000) {
      if (!daysOfWeek.includes(new Date(day).getUTCDay())) continue;
      for (const time of ["10:00", "21:00"]) {
        const dose = at(`${new Date(day).toISOString().slice(0,10)}T${time}:00`);
        if (dose > lower && dose <= upper) expected++;
      }
    }
    const result = estimate(record, upper);
    assert.equal(result.doses, expected, String(seed));
    assert.equal(result.remaining, 1000 - expected * 0.5);
  }
});

test("today's scheduled closing adjustment projects current stock without counting future purchases", () => {
  const record = item({ hasEntries: false, total: 0, stockReferenceAt: null,
    scheduledStockAdjustment: { quantity: 23, effectiveAt: base },
    medicationHistory: [version("2026-10-26T08:00:00-03:00", regimen())] });
  const before = JSON.stringify(record);
  for (const [time, remaining, doses] of [["09:00:00",25,2],["10:00:00",24,1],["20:59:59",24,1],["21:00:00",23,0],["23:59:00",23,0]]) {
    const result = estimate(record, at(`2026-10-26T${time}`));
    assert.equal(result.status, "estimated");
    assert.equal(result.remaining, remaining);
    assert.equal(result.doses, doses);
    assert.equal(Boolean(result.scheduledReference), time !== "23:59:00");
  }
  assert.equal(estimate(record, at("2026-10-27T10:00:00")).remaining, 22);
  assert.equal(forecast(record, at("2026-10-26T20:00:00")).buyDate, "2026-11-07");
  assert.equal(forecast(record, at("2026-10-26T20:00:00")).buyTime, "21:00");
  assert.equal(JSON.stringify(record), before);
  assert.equal(estimate({ ...record, scheduledStockAdjustment: undefined }, at("2026-10-26T20:00:00")).status, "unavailable");
  assert.equal(estimate(record, at("2026-10-25T20:00:00")).status, "unavailable");
  assert.equal(estimate({ ...record, medication: regimen({ stockPerDose: undefined }) }, at("2026-10-26T20:00:00")).status, "unavailable");
  assert.equal(estimate({ ...record, medicationHistory: [version("2026-10-26T21:00:00-03:00", regimen())] }, at("2026-10-26T20:00:00")).status, "unavailable");
});

test("stock alerts use exclusive severity bands with inclusive 1, 3 and 7 day boundaries", () => {
  for (const [daysLeft, expected] of [[0,"critical"],[1,"critical"],[2,"soon"],[3,"soon"],[4,"week"],[7,"week"],[8,null],[100,null]]) {
    assert.equal(urgency({ status: "estimated", daysLeft, overdue: false }), expected);
  }
  assert.equal(urgency({ status: "estimated", daysLeft: 9, overdue: true }), "critical");
  assert.equal(urgency(null, true), "critical");
  for (const status of ["covered", "ended", "unavailable"]) assert.equal(urgency({ status }), null);
  assert.equal(urgency(null), null);
});

test("the refill deadline includes the next dose even a fraction of a second before it", () => {
  const record = item({ total: 1 });
  assert.equal(forecast(record, at("2026-10-27T09:59:59.500")).buyTime, "21:00");
  assert.equal(forecast(record, at("2026-10-27T10:00:00.000")).buyTime, "21:00");
  assert.equal(forecast(item({ total: 2 }), at("2026-10-27T10:00:00.000")).buyTime, "10:00");
  assert.equal(forecast(item({ total: 2 }), at("2026-10-27T10:00:00.000")).buyDate, "2026-10-28");
});
