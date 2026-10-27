import { dosageComponents } from "@/lib/medications";
import type { InventoryItem, MedicationDetails, StockUnit } from "@/lib/types";

export type MedicationStock = Pick<InventoryItem, "kind" | "medication" | "unit" | "total" | "hasEntries" | "lastRestockedAt" | "stockReferenceAt" | "medicationHistory" | "scheduledStockAdjustment">;

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
  const day = calendarDay(`${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`);
  return day === null ? null : { day, seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second) };
}

// Stock is not necessarily the strength printed on a tablet. Never convert
// mg to ml/drops, or infer a liquid concentration, from the dosage alone.
export function medicationStockPerDose(medication: MedicationDetails, unit: StockUnit): { quantity: number; assumed: boolean } | null {
  const explicit = medication.stockPerDose;
  if (explicit !== undefined) {
    return Number.isFinite(explicit) && explicit > 0 ? { quantity: explicit, assumed: false } : null;
  }
  const components = dosageComponents(medication);
  // Ingredient strengths cannot determine how much stock a combination consumes.
  if (components.length !== 1) return null;
  const amount = components[0].amount;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const dosageUnit = components[0].unit.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
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

function getLegacyMedicationRestockForecast(item: MedicationStock, now: Date): MedicationRestockForecast | null {
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
  const referenceAt = item.stockReferenceAt ?? item.lastRestockedAt;
  if (!item.hasEntries || !referenceAt) return unavailable("Registre uma entrada ou ajuste para prever a próxima compra.");
  const restocked = localCalendar(new Date(referenceAt));
  if (!restocked || new Date(referenceAt).getTime() > now.getTime() || !Number.isFinite(item.total) || item.total < 0) {
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
    ? slots?.filter((seconds) => firstDay !== restocked.day || seconds >= restocked.seconds + new Date(referenceAt).getUTCMilliseconds() / 1000) : [];
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

export type MedicationStockEstimate =
  | { status: "estimated"; remaining: number; consumed: number; doses: number; referenceAt: string; referenceQuantity: number; exhausted: boolean; scheduledReference?: boolean }
  | { status: "unavailable"; message: string };

// Count scheduled doses in constant time per schedule version, not per elapsed day.
function countDoses(medication: MedicationDetails, from: Date, to: Date, includeFrom: boolean, includeTo: boolean): number | null {
  const lower = localCalendar(from);
  const upper = localCalendar(to);
  const posology = medication.posology;
  if (!lower || !upper || posology.type === "free") return null;
  const frequency = posology.timesPerDay;
  const times = posology.times;
  const weekdays = posology.type === "daily" ? [0, 1, 2, 3, 4, 5, 6] : [...new Set(posology.daysOfWeek)];
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 99 || !times || times.length !== frequency
    || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    || !weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return null;
  const slots = times.map((time) => Number(time.slice(0, 2)) * 3600 + Number(time.slice(3)) * 60);
  const period = medication.period;
  const start = period.type === "range" ? calendarDay(period.startDate) : lower.day;
  const end = period.type === "range" ? calendarDay(period.endDate) : upper.day;
  if (start === null || end === null || start > end) return null;
  const first = Math.max(lower.day, start);
  const last = Math.min(upper.day, end);
  if (first > last) return 0;
  const scheduled = (day: number) => weekdays.includes(((day + 4) % 7 + 7) % 7);
  const lowerSeconds = lower.seconds + from.getUTCMilliseconds() / 1000;
  const upperSeconds = upper.seconds + to.getUTCMilliseconds() / 1000;
  const boundary = (day: number) => scheduled(day) ? slots.filter((slot) =>
    (day !== lower.day || (includeFrom ? slot >= lowerSeconds : slot > lowerSeconds))
    && (day !== upper.day || (includeTo ? slot <= upperSeconds : slot < upperSeconds))).length : 0;
  if (first === last) return boundary(first);
  const middleDays = last - first - 1;
  let count = boundary(first) + boundary(last) + Math.floor(middleDays / 7) * weekdays.length * frequency;
  for (let offset = 0; offset < middleDays % 7; offset++) {
    if (scheduled(first + 1 + offset)) count += frequency;
  }
  return count;
}

export function getMedicationStockEstimate(item: MedicationStock, now: Date): MedicationStockEstimate {
  const unavailable = (message: string): MedicationStockEstimate => ({ status: "unavailable", message });
  const scheduled = !item.hasEntries ? item.scheduledStockAdjustment : undefined;
  const referenceAt = scheduled?.effectiveAt ?? item.stockReferenceAt ?? item.lastRestockedAt;
  const referenceQuantity = scheduled?.quantity ?? item.total;
  if ((!item.hasEntries && !scheduled) || !referenceAt) return unavailable("Registre uma entrada ou ajuste para calcular o estoque estimado.");
  const reference = new Date(referenceAt).getTime();
  const current = now.getTime();
  // Only today's expected closing balance may be projected back to now. Do not
  // treat distant adjustments or future purchases as current stock.
  const projectBack = scheduled !== undefined && reference > current;
  if (!Number.isFinite(reference) || !Number.isFinite(current) || (!scheduled && reference > current)
    || (projectBack && localCalendar(new Date(reference))?.day !== localCalendar(now)?.day)
    || !Number.isFinite(referenceQuantity) || referenceQuantity < 0) {
    return unavailable("O saldo de referência ainda não está em vigor ou precisa de revisão.");
  }
  if (item.kind !== "medicamento" || !item.medication) return unavailable("Cadastro de medicamento incompleto.");
  if (item.medication.posology.type === "free") return unavailable("Uso conforme necessidade: sem desconto automático. Confira o saldo manualmente.");
  const currentConsumption = medicationStockPerDose(item.medication, item.unit);
  if (!currentConsumption || currentConsumption.assumed) return unavailable("Confirme a quantidade de estoque por tomada no cadastro para calcular a estimativa.");
  const history = item.medicationHistory === undefined
    ? [{ effectiveAt: projectBack ? now.toISOString() : referenceAt, medication: item.medication, unit: item.unit }]
    : [...item.medicationHistory].sort((a, b) => new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime());
  if (!history.length || history.some((version) => !Number.isFinite(new Date(version.effectiveAt).getTime()))
    || new Date(history[0].effectiveAt).getTime() > Math.min(reference, current)) {
    return unavailable("Sem histórico de posologia para esse saldo. Registre um novo ajuste de estoque.");
  }
  let doses = 0;
  let consumed = 0;
  const lower = Math.min(reference, current);
  const upper = Math.max(reference, current);
  for (let index = 0; index < history.length; index++) {
    const version = history[index];
    const effective = new Date(version.effectiveAt).getTime();
    const next = index + 1 < history.length ? new Date(history[index + 1].effectiveAt).getTime() : Infinity;
    if (next <= lower || effective > upper) continue;
    if (!version.medication || version.unit !== item.unit) return unavailable("A unidade de estoque mudou. Registre um novo ajuste de estoque.");
    const count = countDoses(version.medication, new Date(Math.max(lower, effective)), new Date(Math.min(upper, next)), effective > lower, next > upper);
    if (count === null) return unavailable("Histórico sem horários completos ou com uso conforme necessidade. Registre um novo ajuste de estoque.");
    if (count === 0) continue;
    const amount = medicationStockPerDose(version.medication, version.unit);
    if (!amount || amount.assumed) return unavailable("Há tomadas sem quantidade confirmada no histórico. Registre um novo ajuste de estoque.");
    doses += count;
    consumed += count * amount.quantity;
  }
  if (!Number.isSafeInteger(doses) || !Number.isFinite(consumed)) return unavailable("Quantidade muito grande para calcular a estimativa.");
  const remaining = Math.max(0, Math.round((referenceQuantity + (projectBack ? consumed : -consumed)) * 1e9) / 1e9);
  return { status: "estimated", remaining, consumed, doses, referenceAt, referenceQuantity, exhausted: remaining === 0,
    ...(projectBack ? { scheduledReference: true } : {}) };
}

export function getMedicationRestockForecast(item: MedicationStock, now: Date): MedicationRestockForecast | null {
  // Preserve compatibility for older standalone callers. Database-backed items
  // always carry history and use confirmed consumption across its versions.
  if (item.medicationHistory === undefined && !item.scheduledStockAdjustment) return getLegacyMedicationRestockForecast(item, now);
  if (item.kind !== "medicamento" || !item.medication) return null;
  const estimate = getMedicationStockEstimate(item, now);
  if (estimate.status === "unavailable") return estimate;
  const afterNow = new Date(now.getTime() + 1);
  return getLegacyMedicationRestockForecast({ ...item, total: estimate.remaining, hasEntries: true, stockReferenceAt: afterNow.toISOString() }, afterNow);
}

export function medicationStockUrgency(forecast: MedicationRestockForecast | null, exhausted = false): "critical" | "soon" | "week" | null {
  if (exhausted) return "critical";
  if (forecast?.status !== "estimated") return null;
  if (forecast.overdue || forecast.daysLeft <= 1) return "critical";
  if (forecast.daysLeft <= 3) return "soon";
  return forecast.daysLeft <= 7 ? "week" : null;
}
