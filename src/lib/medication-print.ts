import { dosageLabel, posologyLabel, routeLabel } from "@/lib/medications";
import type { InventoryItem } from "@/lib/types";
import { formatQuantity, unitLabel } from "@/lib/units";

export type PrintableMedication = Pick<InventoryItem, "id" | "name" | "kind" | "archivedAt" | "medication" | "unit" | "requiresSpecialControl">;

export function medicationPrintRows(items: PrintableMedication[]) {
  return items.filter((item) => item.kind === "medicamento" && !item.archivedAt).map((item) => {
    const medication = item.medication;
    const posology = medication?.posology;
    const times = posology && posology.type !== "free"
      ? (posology.times ?? []).filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)).slice().sort()
      : [];

    return {
      id: item.id,
      name: item.name,
      requiresSpecialControl: Boolean(item.requiresSpecialControl),
      commercialNames: medication?.otherNames?.join(" · ") || "Não informado",
      dosage: medication ? dosageLabel(medication, true) : "Não informada",
      times,
      timingNote: posology?.type === "free" ? "Sem horário fixo"
        : !times.length ? "Não informado"
          : times.length !== posology?.timesPerDay ? "Horários incompletos" : "",
      posology: !medication || !posology ? "Não informada"
        : posology.type === "free" ? "Posologia livre"
          : `${posologyLabel({ ...medication, posology: { ...posology, times: [], notes: "" } })}${posology.type === "daily" ? " · Todos os dias" : ""}`,
      instructions: posology?.type === "free" ? posology.instructions : posology?.notes || "",
      route: medication ? routeLabel(medication) || "Não informada" : "Não informada",
      amountPerDose: medication?.stockPerDose != null
        ? `${formatQuantity(medication.stockPerDose, item.unit)} ${unitLabel(item.unit)} por tomada`
        : "",
    };
  }).sort((a, b) => (a.times[0] ?? "99:99").localeCompare(b.times[0] ?? "99:99") || a.name.localeCompare(b.name, "pt-BR"));
}

export function medicationPrintGroups(items: PrintableMedication[]) {
  const groups = new Map<string, ReturnType<typeof medicationPrintRows>>();
  for (const row of medicationPrintRows(items)) {
    // A medicine appears at every registered time, including simultaneous doses.
    for (const time of row.times.length ? row.times : [""]) {
      const group = groups.get(time) ?? [];
      group.push(row);
      groups.set(time, group);
    }
  }
  return [...groups].sort(([a], [b]) => (a || "99:99").localeCompare(b || "99:99")).map(([time, rows]) => ({
    time,
    rows: rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  }));
}
