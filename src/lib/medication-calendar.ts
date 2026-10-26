import type { InventoryItem, MedicationDetails } from "@/lib/types";

export type CalendarView = "day" | "week";
export type CalendarMedication = Pick<InventoryItem, "id" | "name" | "kind" | "medication" | "requiresSpecialControl" | "archivedAt">;
export type MedicationEvent = {
  id: string;
  itemId: string;
  name: string;
  medication: MedicationDetails;
  requiresSpecialControl: boolean;
  date: string;
  time: string;
  minute: number;
  color: number;
};

type MedicationTimeGroup = Pick<MedicationEvent, "time" | "minute"> & { events: MedicationEvent[] };
type UnscheduledMedication = { item: CalendarMedication; reason: string };
export type NextMedicationGroup = MedicationTimeGroup & { date: string; minutesUntil: number };
type CalendarClock = { date: string; minute: number };
export type CalendarTimingState = "past" | "now" | "next" | "later";

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

export function calendarDurationLabel(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  if (days) return `${days}d${hours ? ` ${hours}h` : ""}`;
  if (hours) return `${hours}h${remainder ? ` ${remainder}min` : ""}`;
  return `${remainder}min`;
}

function calendarMinutesUntil(date: string, minute: number, today: CalendarClock): number {
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today.date}T00:00:00Z`)) / 60_000 + minute - today.minute;
}

export function calendarGroupTiming(date: string, minute: number, today: CalendarClock, next: NextMedicationGroup | null): { state: CalendarTimingState; label: string } {
  const difference = calendarMinutesUntil(date, minute, today);
  if (difference < 0) return { state: "past", label: `Horário passado · há ${calendarDurationLabel(-difference)}` };
  if (difference === 0) return { state: "now", label: "Agora" };
  if (date !== today.date) return { state: "later", label: "Previsto" };
  if (next?.date === date && next.minute === minute) return { state: "next", label: `Próximo · em ${calendarDurationLabel(difference)}` };
  return { state: "later", label: "Mais tarde" };
}

export function getNextMedicationGroup(items: CalendarMedication[], today: CalendarClock): NextMedicationGroup | null {
  let next: NextMedicationGroup | null = null;

  for (const item of items) {
    if (item.kind !== "medicamento" || item.archivedAt !== null || !item.medication) continue;
    const { period, posology } = item.medication;
    if (posology.type === "free") continue;
    if (period.type === "range" && (!isCalendarDate(period.startDate) || !isCalendarDate(period.endDate) || period.startDate > period.endDate)) continue;
    const firstDate = period.type === "range" && period.startDate > today.date ? period.startDate : today.date;

    // A weekly schedule can next occur on the same weekday seven days later.
    for (let offset = 0; offset <= 7; offset++) {
      const date = addCalendarDays(firstDate, offset);
      if (!isCalendarDate(date) || (period.type === "range" && date > period.endDate)) break;
      const group = getMedicationCalendar([item], [date]).days[0].groups.find((candidate) => date > today.date || candidate.minute >= today.minute);
      if (!group) continue;

      const minutesUntil = calendarMinutesUntil(date, group.minute, today);
      if (!next || minutesUntil < next.minutesUntil) {
        next = { ...group, date, minutesUntil };
      } else if (minutesUntil === next.minutesUntil) {
        next.events.push(...group.events);
      }
      break;
    }
  }

  return next;
}

function groupEvents(events: MedicationEvent[]): MedicationTimeGroup[] {
  events.sort((a, b) => a.minute - b.minute || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
  const groups: MedicationTimeGroup[] = [];
  for (const event of events) {
    const previous = groups[groups.length - 1];
    if (previous?.time === event.time) {
      previous.events.push(event);
    } else {
      groups.push({ time: event.time, minute: event.minute, events: [event] });
    }
  }
  return groups;
}

export function getMedicationCalendar(items: CalendarMedication[], dates: string[]) {
  const days = dates.map((date) => ({ date, events: [] as MedicationEvent[], unscheduled: [] as UnscheduledMedication[] }));
  const unscheduled: UnscheduledMedication[] = [];
  const addUnscheduled = (item: CalendarMedication, reason: string, eligible = days) => {
    const entry = { item, reason };
    unscheduled.push(entry);
    for (const day of eligible) day.unscheduled.push(entry);
  };

  for (const item of items) {
    if (item.kind !== "medicamento" || item.archivedAt !== null) continue;
    const medication = item.medication;
    if (!medication) {
      addUnscheduled(item, "Complete os dados do medicamento no cadastro.");
      continue;
    }
    const { period, posology } = medication;
    if (period.type === "range" && (!isCalendarDate(period.startDate) || !isCalendarDate(period.endDate) || period.startDate > period.endDate)) {
      addUnscheduled(item, "Revise o período de uso no cadastro.");
      continue;
    }
    const eligible = days.filter(({ date }) => {
      if (period.type === "range" && (date < period.startDate || date > period.endDate)) return false;
      return posology.type !== "weekly" || posology.daysOfWeek.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    });
    if (!eligible.length) continue;
    if (posology.type === "free") {
      addUnscheduled(item, posology.instructions, eligible);
      continue;
    }
    const times = posology.times;
    if (!times?.length || times.length !== posology.timesPerDay || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      addUnscheduled(item, "Complete os horários das doses no cadastro.", eligible);
      continue;
    }
    const color = Array.from(item.id).reduce((hash, character) => (hash + character.charCodeAt(0)) % 4, 0);
    for (const day of eligible) {
      times.forEach((time, index) => day.events.push({
        id: `${item.id}-${day.date}-${index}`, itemId: item.id, name: item.name, medication,
        requiresSpecialControl: Boolean(item.requiresSpecialControl),
        date: day.date, time, minute: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)),
        color,
      }));
    }
  }
  return { days: days.map((day) => ({ ...day, groups: groupEvents(day.events) })), unscheduled };
}
