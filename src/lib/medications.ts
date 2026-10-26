import type { DosageComponent, MedicationDetails } from "@/lib/types";

export const ADMINISTRATION_ROUTES = [
  { value: "oral", label: "Oral" },
  { value: "orodispersivel", label: "Orodispersível" },
  { value: "sublingual", label: "Sublingual" },
  { value: "topica", label: "Tópica" },
  { value: "inalatoria", label: "Inalatória" },
  { value: "injetavel", label: "Injetável" },
  { value: "retal", label: "Retal" },
  { value: "outra", label: "Outra" },
] as const;

export const DOSAGE_UNITS = ["mg", "ml", "g", "mcg", "UI", "gotas", "comprimidos", "cápsulas", "mg/ml", "%"] as const;
export const MAX_DOSAGE_COMPONENTS = 10;

export const WEEKDAYS = [
  { value: 1, label: "Seg", full: "Segunda-feira" },
  { value: 2, label: "Ter", full: "Terça-feira" },
  { value: 3, label: "Qua", full: "Quarta-feira" },
  { value: 4, label: "Qui", full: "Quinta-feira" },
  { value: 5, label: "Sex", full: "Sexta-feira" },
  { value: 6, label: "Sáb", full: "Sábado" },
  { value: 0, label: "Dom", full: "Domingo" },
] as const;

export function dosageComponents(medication: MedicationDetails): DosageComponent[] {
  return "components" in medication.dosage ? medication.dosage.components : [medication.dosage];
}

export function dosageLabel(medication: MedicationDetails, includeIngredients = false): string {
  const format = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
  return dosageComponents(medication).map((component) => {
    const strength = `${format.format(component.amount)} ${component.unit}`;
    return includeIngredients && component.ingredient ? `${component.ingredient}: ${strength}` : strength;
  }).join(" + ");
}

export function medicationTitle(name: string, medication: MedicationDetails | null): string {
  return medication ? `${name} ${dosageLabel(medication)}` : name;
}

export function posologyLabel(medication: MedicationDetails): string {
  const posology = medication.posology;
  if (posology.type === "free") return posology.instructions;
  const frequency = `${posology.timesPerDay} ${posology.timesPerDay === 1 ? "vez" : "vezes"} ao dia`;
  const days = posology.type === "weekly"
    ? ` · ${WEEKDAYS.filter((day) => posology.daysOfWeek.includes(day.value)).map((day) => day.label).join(", ")}`
    : "";
  const times = posology.times?.length ? ` · Horários: ${posology.times.join(", ")}` : "";
  return `${frequency}${days}${times}${posology.notes ? ` · ${posology.notes}` : ""}`;
}

export function routeLabel(medication: MedicationDetails): string {
  return medication.administrationRoute === "outra"
    ? medication.customRoute
    : ADMINISTRATION_ROUTES.find((route) => route.value === medication.administrationRoute)?.label ?? medication.administrationRoute;
}

export function periodLabel(medication: MedicationDetails): string {
  if (medication.period.type === "indefinite") return "Por tempo indeterminado";
  const formatDate = (date: string) => date.split("-").reverse().join("/");
  return `${formatDate(medication.period.startDate)} a ${formatDate(medication.period.endDate)}`;
}
