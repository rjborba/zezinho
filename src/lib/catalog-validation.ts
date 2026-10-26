import { ADMINISTRATION_ROUTES, DOSAGE_UNITS, MAX_DOSAGE_COMPONENTS } from "@/lib/medications";
import { medicationNamesError, normalizeMedicationNames } from "@/lib/medication-names";
import { MEDICATION_STOCK_UNITS, UNITS, type DosageComponent, type MedicationDetails, type RecordKind, type StockUnit } from "@/lib/types";

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

  const otherNamesValues = formData.getAll("otherNames").map(String);
  const otherNames = normalizeMedicationNames(otherNamesValues, name);
  const namesError = medicationNamesError(otherNames);
  if (namesError) return { error: namesError };
  if (otherNamesValues.join("\n").length > 1000) return { error: "Use até 1.000 caracteres nos nomes comerciais." };

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

  const values = (key: string) => formData.getAll(key).map((value) => String(value).trim());
  const amounts = values("dosageAmount");
  const unitsForDosage = values("dosageUnit");
  const ingredients = values("dosageIngredient");
  const customUnits = values("customDosageUnit");
  const legacyForm = ingredients.length === 0 && amounts.length === 1;
  if (amounts.length < 1 || amounts.length > MAX_DOSAGE_COMPONENTS || unitsForDosage.length !== amounts.length
    || (!legacyForm && (ingredients.length !== amounts.length || customUnits.length !== amounts.length))
    || (legacyForm && customUnits.length > 1)) {
    return { error: `Informe de 1 a ${MAX_DOSAGE_COMPONENTS} componentes, com quantidade e unidade para cada um.` };
  }
  const components: DosageComponent[] = [];
  for (let index = 0; index < amounts.length; index++) {
    const ingredient = (ingredients[index] ?? "").replace(/\s+/g, " ");
    const amount = Number(amounts[index].replace(",", "."));
    const chosenUnit = unitsForDosage[index];
    const dosageUnit = chosenUnit === "outra" ? customUnits[index] : chosenUnit;
    if (ingredient.length > 80 || (amounts.length > 1 && !ingredient)) return { error: "Informe o princípio ativo de cada componente em até 80 caracteres." };
    if (!Number.isFinite(amount) || amount < 0.001 || amount > 999999999 || amount !== Math.round(amount * 1000) / 1000) return { error: "Informe uma dosagem maior que zero, com até 3 casas decimais, para cada componente." };
    if (!dosageUnit || dosageUnit.length > 32 || (chosenUnit !== "outra" && !(DOSAGE_UNITS as readonly string[]).includes(chosenUnit))) return { error: "Escolha ou informe a unidade da dosagem de cada componente." };
    components.push({ ...(ingredient ? { ingredient } : {}), amount, unit: dosageUnit });
  }

  const stockPerDoseText = field("stockPerDose");
  const stockPerDose = Number(stockPerDoseText.replace(",", "."));
  if (stockPerDoseText && (!Number.isFinite(stockPerDose) || stockPerDose <= 0 || stockPerDose > 999999999 || Math.abs(stockPerDose * 1000 - Math.round(stockPerDose * 1000)) > 0.0001)) {
    return { error: "Informe uma quantidade de estoque por dose maior que zero, com até 3 casas decimais." };
  }
  return { data: { name, kind, unit: unit as StockUnit, medication: { otherNames, posology, administrationRoute, customRoute, period, dosage: { components }, ...(stockPerDoseText ? { stockPerDose } : {}) } } };
}
