import type { InventoryItem, MedicationDetails } from "@/lib/types";

export type CalendarView = "day" | "week";
export type CalendarMedication = Pick<InventoryItem, "id" | "name" | "kind" | "medication" | "archivedAt">;
export type MedicationEvent = {
  id: string;
  itemId: string;
  name: string;
  medication: MedicationDetails;
  date: string;
  time: string;
  minute: number;
  column: number;
  columns: number;
  color: number;
};

// This is space for a readable card, not the duration of a dose.
export const EVENT_DISPLAY_MINUTES = 50;
const DAY_MS = 86_400_000;
const clockFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function calendarNow(now: number) {
  const parts = Object.fromEntries(clockFormat.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function isCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000")) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function addCalendarDays(date: string, amount: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + amount * DAY_MS).toISOString().slice(0, 10);
}

export function calendarDates(date: string, view: CalendarView): string[] {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const first = view === "week" ? addCalendarDays(date, -((weekday + 6) % 7)) : date;
  return Array.from({ length: view === "week" ? 7 : 1 }, (_, index) => addCalendarDays(first, index));
}

export function calendarDateLabel(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function layoutEvents(events: MedicationEvent[]): MedicationEvent[] {
  events.sort((a, b) => a.minute - b.minute || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
  let group: MedicationEvent[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;
  const finishGroup = () => group.forEach((event) => { event.columns = columnEnds.length; });

  for (const event of events) {
    if (event.minute >= groupEnd) {
      finishGroup();
      group = [];
      columnEnds = [];
    }
    const available = columnEnds.findIndex((end) => end <= event.minute);
    event.column = available === -1 ? columnEnds.length : available;
    columnEnds[event.column] = event.minute + EVENT_DISPLAY_MINUTES;
    groupEnd = Math.max(...columnEnds);
    group.push(event);
  }
  finishGroup();
  return events;
}

export function getMedicationCalendar(items: CalendarMedication[], dates: string[]) {
  const days = dates.map((date) => ({ date, events: [] as MedicationEvent[] }));
  const unscheduled: { item: CalendarMedication; reason: string }[] = [];

  for (const item of items) {
    if (item.kind !== "medicamento" || item.archivedAt !== null) continue;
    const medication = item.medication;
    if (!medication) {
      unscheduled.push({ item, reason: "Complete os dados do medicamento no cadastro." });
      continue;
    }
    const { period, posology } = medication;
    if (period.type === "range" && (!isCalendarDate(period.startDate) || !isCalendarDate(period.endDate) || period.startDate > period.endDate)) {
      unscheduled.push({ item, reason: "Revise o período de uso no cadastro." });
      continue;
    }
    const eligible = days.filter(({ date }) => {
      if (period.type === "range" && (date < period.startDate || date > period.endDate)) return false;
      return posology.type !== "weekly" || posology.daysOfWeek.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    });
    if (!eligible.length) continue;
    if (posology.type === "free") {
      unscheduled.push({ item, reason: posology.instructions });
      continue;
    }
    const times = posology.times;
    if (!times?.length || times.length !== posology.timesPerDay || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      unscheduled.push({ item, reason: "Complete os horários das doses no cadastro." });
      continue;
    }
    const color = Array.from(item.id).reduce((hash, character) => (hash + character.charCodeAt(0)) % 4, 0);
    for (const day of eligible) {
      times.forEach((time, index) => day.events.push({
        id: `${item.id}-${day.date}-${index}`, itemId: item.id, name: item.name, medication,
        date: day.date, time, minute: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)),
        column: 0, columns: 1, color,
      }));
    }
  }
  return { days: days.map((day) => ({ ...day, events: layoutEvents(day.events) })), unscheduled };
}
