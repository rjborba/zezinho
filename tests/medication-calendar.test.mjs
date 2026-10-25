import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/medication-calendar.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = { exports: {} };
runInThisContext(`(function(module, exports) { ${compiled}\n})`)(loaded, loaded.exports);
const { calendarNow, calendarDates, addCalendarDays, isCalendarDate, getMedicationCalendar } = loaded.exports;

function medication(id = "daily", details = {}, item = {}) {
  return {
    id, name: id, kind: "medicamento", archivedAt: null,
    medication: {
      posology: { type: "daily", timesPerDay: 2, times: ["20:00", "08:00"], notes: "" },
      period: { type: "indefinite" }, dosage: { amount: 1, unit: "comprimidos" },
      administrationRoute: "oral", customRoute: "", ...details,
    },
    ...item,
  };
}

test("clock uses Recife's date at UTC midnight and rolls over at local midnight", () => {
  assert.deepEqual(calendarNow(Date.parse("2026-10-26T02:59:59Z")), { date: "2026-10-25", time: "23:59", minute: 1439 });
  assert.deepEqual(calendarNow(Date.parse("2026-10-26T03:00:00Z")), { date: "2026-10-26", time: "00:00", minute: 0 });
});

test("day and Monday-based week navigation cross months, years and leap days", () => {
  assert.deepEqual(calendarDates("2027-01-03", "day"), ["2027-01-03"]);
  assert.deepEqual(calendarDates("2027-01-03", "week"), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  assert.equal(addCalendarDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addCalendarDays("2026-03-01", -1), "2026-02-28");
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(isCalendarDate("0000-01-01"), false);
});

test("daily doses are sorted and weekly doses respect weekdays and inclusive treatment dates", () => {
  const weekly = medication("weekly", {
    posology: { type: "weekly", timesPerDay: 1, times: ["10:30"], daysOfWeek: [1, 3, 5, 0], notes: "" },
    period: { type: "range", startDate: "2026-10-21", endDate: "2026-10-23" },
  });
  const { days, unscheduled } = getMedicationCalendar([medication(), weekly], calendarDates("2026-10-25", "week"));
  assert.equal(days.flatMap((day) => day.events).length, 16);
  assert.deepEqual(days.flatMap((day) => day.events).filter((event) => event.itemId === "weekly").map(({ date, time }) => [date, time]), [["2026-10-21", "10:30"], ["2026-10-23", "10:30"]]);
  assert.deepEqual(days[0].events.map((event) => event.time), ["08:00", "20:00"]);
  assert.deepEqual(unscheduled, []);
});

test("archived medications and inventory items never appear; stock is not required", () => {
  const { days, unscheduled } = getMedicationCalendar([
    medication("active"), medication("archived", {}, { archivedAt: "2026-10-20" }),
    medication("item", {}, { kind: "item", medication: null }),
  ], ["2026-10-25"]);
  assert.deepEqual(days[0].events.map((event) => event.itemId), ["active", "active"]);
  assert.deepEqual(unscheduled, []);
});

test("free, missing, partial and invalid schedules are listed without invented times", () => {
  const items = [
    medication("free", { posology: { type: "free", instructions: "Conforme orientação" } }),
    medication("legacy", { posology: { type: "daily", timesPerDay: 2, notes: "" } }),
    medication("partial", { posology: { type: "daily", timesPerDay: 2, times: ["08:00"], notes: "" } }),
    medication("invalid", { posology: { type: "daily", timesPerDay: 1, times: ["24:00"], notes: "" } }),
    medication("missing", {}, { medication: null }),
    medication("bad-period", { period: { type: "range", startDate: "2026-02-30", endDate: "2026-10-25" } }),
    medication("ended", { posology: { type: "free", instructions: "Conforme orientação" }, period: { type: "range", startDate: "2026-10-01", endDate: "2026-10-24" } }),
  ];
  const { days, unscheduled } = getMedicationCalendar(items, ["2026-10-25"]);
  assert.equal(days[0].events.length, 0);
  assert.deepEqual(unscheduled.map(({ item }) => item.id), ["free", "legacy", "partial", "invalid", "missing", "bad-period"]);
  assert.equal(unscheduled[0].reason, "Conforme orientação");
});

test("overlapping cards use separate lanes and non-overlapping doses regain full width", () => {
  const item = medication("overlap", { posology: { type: "daily", timesPerDay: 6, times: ["08:00", "08:00", "08:30", "09:00", "12:00", "23:59"], notes: "" } });
  const original = JSON.stringify(item);
  const { days } = getMedicationCalendar([item], ["2026-10-25"]);
  const events = days[0].events;
  assert.deepEqual(events.map(({ column, columns }) => [column, columns]), [[0, 3], [1, 3], [2, 3], [0, 3], [0, 1], [0, 1]]);
  assert.equal(new Set(events.map((event) => event.id)).size, 6);
  assert.equal(events.at(-1).minute, 1439);
  assert.equal(JSON.stringify(item), original);
});

test("midnight and last-minute doses stay on their scheduled day", () => {
  const { days } = getMedicationCalendar([medication("night", { posology: { type: "daily", timesPerDay: 2, times: ["23:59", "00:00"], notes: "" } })], ["2026-10-25", "2026-10-26"]);
  for (const day of days) {
    assert.deepEqual(day.events.map((event) => [event.date, event.minute]), [[day.date, 0], [day.date, 1439]]);
  }
});
