import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/medication-calendar.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = { exports: {} };
runInThisContext(`(function(module, exports) { ${compiled}\n})`)(loaded, loaded.exports);
const { calendarNow, calendarDates, addCalendarDays, isCalendarDate, getMedicationCalendar, calendarDurationLabel, calendarGroupTiming, getNextMedicationGroup } = loaded.exports;

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

test("special-control flags reach timed doses, next groups and untimed medications without name inference", () => {
  const items = [
    medication("required", {}, { requiresSpecialControl: true }),
    medication("not-required", {}, { name: "Aciclovir", requiresSpecialControl: false }),
    medication("untimed", { posology: { type: "free", instructions: "Conforme orientação" } }, { requiresSpecialControl: true }),
    medication("legacy", {}, { requiresPrescription: true }),
  ];
  const before = JSON.stringify(items);
  const { days } = getMedicationCalendar(items, ["2026-10-25"]);
  assert.ok(days[0].events.filter((event) => event.itemId === "required").every((event) => event.requiresSpecialControl === true));
  assert.ok(days[0].events.filter((event) => event.itemId === "not-required").every((event) => event.requiresSpecialControl === false));
  assert.ok(days[0].events.filter((event) => event.itemId === "legacy").every((event) => event.requiresSpecialControl === false));
  assert.equal(days[0].unscheduled[0].item.requiresSpecialControl, true);
  assert.deepEqual(getNextMedicationGroup(items, { date: "2026-10-25", minute: 0 }).events.map((event) => event.requiresSpecialControl).sort(), [false, false, true]);
  assert.equal(JSON.stringify(items), before);
});

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
  assert.deepEqual(days[0].unscheduled, unscheduled);
});

test("medications without a time only appear on eligible days inside each calendar day", () => {
  const weekly = medication("weekly-no-time", {
    posology: { type: "weekly", timesPerDay: 1, daysOfWeek: [1, 3, 5], notes: "" },
    period: { type: "range", startDate: "2026-10-20", endDate: "2026-10-22" },
  });
  const asNeeded = medication("as-needed", {
    posology: { type: "free", instructions: "Se necessário" },
    period: { type: "range", startDate: "2026-10-22", endDate: "2026-10-24" },
  });
  const archived = medication("archived-free", { posology: { type: "free", instructions: "Se necessário" } }, { archivedAt: "2026-10-19" });
  const { days, unscheduled } = getMedicationCalendar([weekly, asNeeded, archived], calendarDates("2026-10-25", "week"));

  assert.deepEqual(days.map((day) => [day.date, day.unscheduled.map(({ item }) => item.id)]), [
    ["2026-10-19", []],
    ["2026-10-20", []],
    ["2026-10-21", ["weekly-no-time"]],
    ["2026-10-22", ["as-needed"]],
    ["2026-10-23", ["as-needed"]],
    ["2026-10-24", ["as-needed"]],
    ["2026-10-25", []],
  ]);
  assert.deepEqual(unscheduled.map(({ item }) => item.id), ["weekly-no-time", "as-needed"]);
  assert.ok(days.every((day) => day.events.length === 0 && day.groups.length === 0));
  assert.equal(days[3].unscheduled[0].reason, "Se necessário");
});

test("simultaneous doses share a time group while nearby doses keep their exact times", () => {
  const item = medication("overlap", { posology: { type: "daily", timesPerDay: 6, times: ["08:00", "08:00", "08:01", "09:00", "12:00", "23:59"], notes: "" } });
  const original = JSON.stringify(item);
  const { days } = getMedicationCalendar([item], ["2026-10-25"]);
  const events = days[0].events;
  assert.deepEqual(days[0].groups.map(({ time, events }) => [time, events.length]), [["08:00", 2], ["08:01", 1], ["09:00", 1], ["12:00", 1], ["23:59", 1]]);
  assert.deepEqual(days[0].groups.flatMap((group) => group.events), events);
  assert.equal(new Set(events.map((event) => event.id)).size, 6);
  assert.equal(events.at(-1).minute, 1439);
  assert.equal(JSON.stringify(item), original);
});

test("crowded time groups retain every medication and sort names without changing the source", () => {
  const items = Array.from({ length: 12 }, (_, index) => medication(`medicine-${String(12 - index).padStart(2, "0")}`));
  const original = JSON.stringify(items);
  const { days } = getMedicationCalendar(items, ["2026-10-25", "2026-10-26"]);
  for (const day of days) {
    assert.deepEqual(day.groups.map(({ time, events }) => [time, events.length]), [["08:00", 12], ["20:00", 12]]);
    for (const group of day.groups) {
      assert.equal(group.events[0].name, "medicine-01");
      assert.equal(group.events.at(-1).name, "medicine-12");
      assert.ok(group.events.every((event) => event.date === day.date && event.time === group.time));
      assert.equal(new Set(group.events.map((event) => event.id)).size, 12);
    }
  }
  assert.equal(JSON.stringify(items), original);
});

test("midnight and last-minute doses stay on their scheduled day", () => {
  const { days } = getMedicationCalendar([medication("night", { posology: { type: "daily", timesPerDay: 2, times: ["23:59", "00:00"], notes: "" } })], ["2026-10-25", "2026-10-26"]);
  for (const day of days) {
    assert.deepEqual(day.events.map((event) => [event.date, event.minute]), [[day.date, 0], [day.date, 1439]]);
  }
});

test("timing distinguishes upcoming, current, later and past groups as the clock advances", () => {
  const items = [medication("morning", { posology: { type: "daily", timesPerDay: 3, times: ["08:00", "10:00", "21:00"], notes: "" } })];
  const before = { date: "2026-10-25", minute: 9 * 60 + 25 };
  const next = getNextMedicationGroup(items, before);
  assert.equal(next.time, "10:00");
  assert.equal(next.minutesUntil, 35);
  assert.deepEqual(calendarGroupTiming(before.date, 600, before, next), { state: "next", label: "Próximo · em 35min" });
  assert.deepEqual(calendarGroupTiming(before.date, 1260, before, next), { state: "later", label: "Mais tarde" });
  assert.deepEqual(calendarGroupTiming(before.date, 480, before, next), { state: "past", label: "Horário passado · há 1h 25min" });

  const current = { ...before, minute: 600 };
  assert.deepEqual(calendarGroupTiming(current.date, 600, current, getNextMedicationGroup(items, current)), { state: "now", label: "Agora" });
  const after = { ...before, minute: 601 };
  assert.equal(getNextMedicationGroup(items, after).time, "21:00");
  assert.deepEqual(calendarGroupTiming(after.date, 600, after, getNextMedicationGroup(items, after)), { state: "past", label: "Horário passado · há 1min" });
});

test("the next group merges simultaneous medications and rolls into tomorrow across years", () => {
  const items = [medication("first"), medication("second")];
  const original = JSON.stringify(items);
  const next = getNextMedicationGroup(items, { date: "2026-12-31", minute: 23 * 60 + 59 });
  assert.equal(next.date, "2027-01-01");
  assert.equal(next.time, "08:00");
  assert.equal(next.minutesUntil, 481);
  assert.deepEqual(next.events.map((event) => event.itemId), ["first", "second"]);
  assert.equal(JSON.stringify(items), original);
  assert.equal(calendarDurationLabel(next.minutesUntil), "8h 1min");
});

test("the next group respects weekly schedules and future treatment starts without a search cutoff", () => {
  const weekly = medication("weekly", {
    posology: { type: "weekly", timesPerDay: 1, times: ["10:00"], daysOfWeek: [1], notes: "" },
  });
  const mondayAfterDose = { date: "2026-10-26", minute: 601 };
  const nextWeek = getNextMedicationGroup([weekly], mondayAfterDose);
  assert.equal(nextWeek.date, "2026-11-02");
  assert.equal(calendarDurationLabel(nextWeek.minutesUntil), "6d 23h");
  assert.deepEqual(calendarGroupTiming(nextWeek.date, nextWeek.minute, mondayAfterDose, nextWeek), { state: "later", label: "Previsto" });

  const future = medication("future", {
    posology: { type: "weekly", timesPerDay: 1, times: ["09:00"], daysOfWeek: [5], notes: "" },
    period: { type: "range", startDate: "2027-01-01", endDate: "2027-01-07" },
  });
  const nextYear = getNextMedicationGroup([future], mondayAfterDose);
  assert.equal(nextYear.date, "2027-01-01");
  assert.equal(nextYear.time, "09:00");
});

test("unscheduled, archived, invalid and finished medications never become an upcoming dose", () => {
  const items = [
    medication("free", { posology: { type: "free", instructions: "Se necessário" } }),
    medication("archived", {}, { archivedAt: "2026-10-20" }),
    medication("missing", {}, { medication: null }),
    medication("invalid", { posology: { type: "daily", timesPerDay: 1, times: ["24:00"], notes: "" } }),
    medication("ended", { period: { type: "range", startDate: "2026-10-01", endDate: "2026-10-24" } }),
    medication("last-day", { posology: { type: "daily", timesPerDay: 1, times: ["08:00"], notes: "" }, period: { type: "range", startDate: "2026-10-25", endDate: "2026-10-25" } }),
    medication("bad-period", { period: { type: "range", startDate: "2026-02-30", endDate: "2026-10-25" } }),
    medication("item", {}, { kind: "item" }),
  ];
  assert.equal(getNextMedicationGroup(items, { date: "2026-10-25", minute: 600 }), null);
  assert.equal(getNextMedicationGroup([], { date: "2026-10-25", minute: 600 }), null);
});

test("midnight becomes current on the Recife date instead of staying upcoming or past", () => {
  const items = [medication("midnight", { posology: { type: "daily", timesPerDay: 1, times: ["00:00"], notes: "" } })];
  const before = calendarNow(Date.parse("2026-10-26T02:59:59Z"));
  assert.equal(getNextMedicationGroup(items, before).minutesUntil, 1);
  const midnight = calendarNow(Date.parse("2026-10-26T03:00:00Z"));
  const next = getNextMedicationGroup(items, midnight);
  assert.equal(next.date, "2026-10-26");
  assert.deepEqual(calendarGroupTiming(next.date, next.minute, midnight, next), { state: "now", label: "Agora" });
  assert.deepEqual(calendarGroupTiming("2026-10-25", 0, midnight, next), { state: "past", label: "Horário passado · há 1d" });
});
