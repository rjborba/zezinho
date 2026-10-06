import type { InventoryItem, MedicationDetails, StockUnit } from "@/lib/types";

export type MedicationStock = Pick<InventoryItem, "kind" | "medication" | "unit" | "total" | "hasEntries" | "lastRestockedAt">;

type ForecastBasis = {
  quantityPerDose: number;
  assumedUnitPerDose: boolean;
  approximateTimes: boolean;
};

export type MedicationRestockForecast =
  | ({ status: "estimated"; buyDate: string; buyTime: string | null; daysLeft: number; urgent: boolean; overdue: boolean } & ForecastBasis)
  | ({ status: "covered"; endDate: string } & ForecastBasis)
  | { status: "ended" }
  | { status: "unavailable"; message: string };

const DAY_MS = 86_400_000;
const localDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date.getTime() / DAY_MS : null;
}

function localCalendar(date: Date): { day: number; seconds: number } | null {
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(localDateFormat.formatToParts(date).map((part) => [part.type, part.value]));
  const day = calendarDay(`${parts.year}-${parts.month}-${parts.day}`);
  return day === null ? null : { day, seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second) };
}

// Stock is not necessarily the strength printed on a tablet. Never convert
// mg to ml/drops, or infer a liquid concentration, from the dosage alone.
export function medicationStockPerDose(medication: MedicationDetails, unit: StockUnit): { quantity: number; assumed: boolean } | null {
  const explicit = medication.stockPerDose;
  if (explicit !== undefined) {
    return Number.isFinite(explicit) && explicit > 0 ? { quantity: explicit, assumed: false } : null;
  }
  const amount = medication.dosage.amount;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const dosageUnit = medication.dosage.unit.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (unit === "unidade") {
    if (["unidade", "unidades", "comprimido", "comprimidos", "capsula", "capsulas"].includes(dosageUnit)) {
      return { quantity: amount, assumed: false };
    }
    // Legacy tablet records lack a count per dose. Surface this assumption
    // in the UI and let the user confirm/override it in the medication editor.
    return ["mg", "g", "mcg", "ui"].includes(dosageUnit) ? { quantity: 1, assumed: true } : null;
  }
  if (dosageUnit === unit) return { quantity: amount, assumed: false };
  const massInMg: Record<string, number> = { mg: 1, g: 1000, mcg: 0.001 };
  if ((unit === "mg" || unit === "g") && massInMg[dosageUnit] !== undefined) {
    return { quantity: amount * massInMg[dosageUnit] / massInMg[unit], assumed: false };
  }
  return null;
}

export function getMedicationRestockForecast(item: MedicationStock, now: Date): MedicationRestockForecast | null {
  const medication = item.medication;
  if (item.kind !== "medicamento" || !medication) return null;
  const unavailable = (message: string): MedicationRestockForecast => ({ status: "unavailable", message });
  const today = localCalendar(now);
  if (!today) return unavailable("Não foi possível calcular a data da próxima compra.");

  const period = medication.period;
  const start = period.type === "range" ? calendarDay(period.startDate) : null;
  const end = period.type === "range" ? calendarDay(period.endDate) : null;
  if (period.type === "range" && (start === null || end === null || start > end)) {
    return unavailable("Revise as datas do período de uso para calcular a próxima compra.");
  }
  if (end !== null && end < today.day) return { status: "ended" };
  if (!item.hasEntries || !item.lastRestockedAt) return unavailable("Registre uma entrada para prever a próxima compra.");
  const restocked = localCalendar(new Date(item.lastRestockedAt));
  if (!restocked || restocked.day > today.day || !Number.isFinite(item.total) || item.total < 0) {
    return unavailable("Revise a quantidade e a data da última entrada.");
  }

  const posology = medication.posology;
  if (posology.type === "free") return unavailable("Use uma posologia diária ou por dias da semana para calcular a próxima compra.");
  const frequency = posology.timesPerDay;
  const days = posology.type === "daily" ? [0, 1, 2, 3, 4, 5, 6] : [...new Set(posology.daysOfWeek)];
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 99 || !days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return unavailable("Revise a frequência da posologia para calcular a próxima compra.");
  }
  const consumption = medicationStockPerDose(medication, item.unit);
  if (!consumption) return unavailable("Informe no cadastro a quantidade de estoque usada por dose para calcular a próxima compra.");

  const times = posology.times;
  if (times !== undefined && (times.length !== frequency || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))) {
    return unavailable("Revise os horários das doses para calcular a próxima compra.");
  }
  const slots = times?.map((time) => Number(time.slice(0, 2)) * 3600 + Number(time.slice(3)) * 60).sort((a, b) => a - b);
  const basis: ForecastBasis = { quantityPerDose: consumption.quantity, assumedUnitPerDose: consumption.assumed, approximateTimes: !slots };
  const firstDay = Math.max(restocked.day, start ?? restocked.day);
  const isScheduledDay = (day: number) => days.includes((day + 4) % 7);
  // With legacy schedules without times, include the whole restock day for a
  // conservative date-only estimate rather than inventing dose times.
  const firstSlots = isScheduledDay(firstDay)
    ? slots?.filter((seconds) => firstDay !== restocked.day || seconds >= restocked.seconds) : [];
  const firstDayDoses = isScheduledDay(firstDay) ? firstSlots?.length ?? frequency : 0;
  let doseIndex = Math.floor(item.total / consumption.quantity + 1e-9);
  if (!Number.isSafeInteger(doseIndex)) return unavailable("A quantidade é muito grande para estimar uma data de compra.");

  let buyDay = firstDay;
  let buySeconds: number | null = null;
  if (doseIndex < firstDayDoses) {
    buySeconds = firstSlots?.[doseIndex] ?? null;
  } else {
    doseIndex -= firstDayDoses;
    const dosesPerWeek = frequency * days.length;
    // Skip full weeks in constant time, even for large stock quantities.
    const fullWeeks = Math.floor(doseIndex / dosesPerWeek);
    doseIndex %= dosesPerWeek;
    buyDay = firstDay + 1 + fullWeeks * 7;
    for (let offset = 0; offset < 7; offset += 1) {
      if (!isScheduledDay(buyDay)) {
        buyDay += 1;
        continue;
      }
      if (doseIndex < frequency) {
        buySeconds = slots?.[doseIndex] ?? null;
        break;
      }
      doseIndex -= frequency;
      buyDay += 1;
    }
  }
  // The first dose the current stock cannot cover is the buy-by deadline.
  // No refill is needed when that dose falls after the treatment's end.
  if (end !== null && buyDay > end) return { status: "covered", endDate: period.type === "range" ? period.endDate : "", ...basis };
  const buyDate = new Date(buyDay * DAY_MS);
  if (!Number.isFinite(buyDate.getTime()) || buyDate.getUTCFullYear() > 9999) {
    return unavailable("A quantidade é muito grande para estimar uma data de compra.");
  }
  const daysLeft = Math.max(0, buyDay - today.day);
  const buyTime = buySeconds === null ? null : `${String(Math.floor(buySeconds / 3600)).padStart(2, "0")}:${String(Math.floor(buySeconds % 3600 / 60)).padStart(2, "0")}`;
  return {
    status: "estimated", buyDate: buyDate.toISOString().slice(0, 10), buyTime,
    daysLeft, urgent: daysLeft <= 5,
    overdue: buyDay < today.day || (buyDay === today.day && buySeconds !== null && buySeconds <= today.seconds),
    ...basis,
  };
}
