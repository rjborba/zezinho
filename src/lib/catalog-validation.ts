import { ADMINISTRATION_ROUTES, DOSAGE_UNITS } from "@/lib/medications";
import { MEDICATION_STOCK_UNITS, UNITS, type MedicationDetails, type RecordKind, type StockUnit } from "@/lib/types";

type CatalogRecord = {
  name: string;
  unit: StockUnit;
  kind: RecordKind;
  medication: MedicationDetails | null;
};

type CatalogResult = { data: CatalogRecord } | { error: string };

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseCatalogForm(formData: FormData): CatalogResult {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const name = field("name");
  const kind = field("kind") || "item";
  const unit = field("unit");

  if (name.length < 2 || name.length > 80) return { error: "Informe um nome entre 2 e 80 caracteres." };
  if (kind !== "item" && kind !== "medicamento") return { error: "Escolha Item ou Medicamento." };
  const units: readonly string[] = kind === "item" ? UNITS : MEDICATION_STOCK_UNITS;
  if (!units.includes(unit)) return { error: "Escolha uma unidade de estoque válida." };
  if (kind === "item") return { data: { name, kind, unit: unit as StockUnit, medication: null } };

  const posologyType = field("posologyType");
  let posology: MedicationDetails["posology"];
  if (posologyType === "free") {
    const instructions = field("posologyInstructions");
    if (!instructions || instructions.length > 1000) return { error: "Descreva a posologia em até 1.000 caracteres." };
    posology = { type: "free", instructions };
  } else if (posologyType === "daily" || posologyType === "weekly") {
    const timesPerDay = Number(field("timesPerDay"));
    const notes = field("posologyNotes");
    if (!Number.isInteger(timesPerDay) || timesPerDay < 1 || timesPerDay > 99) return { error: "Informe a frequência por dia, de 1 a 99 vezes." };
    const times = formData.getAll("doseTimes").map((time) => String(time).trim());
    if (times.length !== timesPerDay || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      return { error: "Informe um horário válido para cada dose." };
    }
    if (notes.length > 1000) return { error: "Use até 1.000 caracteres nas instruções da posologia." };
    if (posologyType === "weekly") {
      const rawDays = formData.getAll("daysOfWeek").map(String);
      if (!rawDays.length || rawDays.some((day) => !/^[0-6]$/.test(day))) return { error: "Escolha pelo menos um dia da semana." };
      posology = { type: "weekly", timesPerDay, times, daysOfWeek: [...new Set(rawDays.map(Number))], notes };
    } else {
      posology = { type: "daily", timesPerDay, times, notes };
    }
  } else {
    return { error: "Escolha como informar a posologia." };
  }

  const administrationRoute = field("administrationRoute");
  const customRoute = administrationRoute === "outra" ? field("customRoute") : "";
  if (!ADMINISTRATION_ROUTES.some((route) => route.value === administrationRoute)) return { error: "Escolha a via de administração." };
  if (administrationRoute === "outra" && (!customRoute || customRoute.length > 120)) return { error: "Descreva a via de administração em até 120 caracteres." };

  const periodType = field("periodType");
  let period: MedicationDetails["period"];
  if (periodType === "indefinite") {
    period = { type: "indefinite" };
  } else if (periodType === "range") {
    const startDate = field("startDate");
    const endDate = field("endDate");
    if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) return { error: "Informe as datas de início e fim do período." };
    if (startDate > endDate) return { error: "A data final deve ser igual ou posterior à data inicial." };
    period = { type: "range", startDate, endDate };
  } else {
    return { error: "Escolha um período ou tempo indeterminado." };
  }

  const amount = Number(field("dosageAmount").replace(",", "."));
  const chosenDosageUnit = field("dosageUnit");
  const dosageUnit = chosenDosageUnit === "outra" ? field("customDosageUnit") : chosenDosageUnit;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999 || Math.abs(amount * 1000 - Math.round(amount * 1000)) > 0.0001) return { error: "Informe uma dosagem maior que zero, com até 3 casas decimais." };
  if (!dosageUnit || dosageUnit.length > 32 || (chosenDosageUnit !== "outra" && !(DOSAGE_UNITS as readonly string[]).includes(chosenDosageUnit))) return { error: "Escolha ou informe a unidade da dosagem." };

  const stockPerDoseText = field("stockPerDose");
  const stockPerDose = Number(stockPerDoseText.replace(",", "."));
  if (stockPerDoseText && (!Number.isFinite(stockPerDose) || stockPerDose <= 0 || stockPerDose > 999999999 || Math.abs(stockPerDose * 1000 - Math.round(stockPerDose * 1000)) > 0.0001)) {
    return { error: "Informe uma quantidade de estoque por dose maior que zero, com até 3 casas decimais." };
  }
  return { data: { name, kind, unit: unit as StockUnit, medication: { posology, administrationRoute, customRoute, period, dosage: { amount, unit: dosageUnit }, ...(stockPerDoseText ? { stockPerDose } : {}) } } };
}
