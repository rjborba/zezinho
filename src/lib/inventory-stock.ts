import type { InventoryItem, StockEntryType } from "@/lib/types";

export type InventoryEntryRow = {
  entry_type?: StockEntryType;
  quantity: number | string;
  remaining_quantity: number | string | null;
  created_at: string;
};

export function summarizeStockEntries(
  allEntries: InventoryEntryRow[],
  now: Date,
): Pick<InventoryItem, "total" | "averagePerDay" | "hasEntries" | "lastRestockedAt" | "stockReferenceAt" | "scheduledStockAdjustment"> & { nextEntryAt: string | null } {
  const ordered = [...allEntries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const entries = ordered.filter((entry) => new Date(entry.created_at).getTime() <= now.getTime());
  const nextEntry = ordered.find((entry) => new Date(entry.created_at).getTime() > now.getTime());
  const latestEntry = entries.at(-1);
  const lastAdjustment = entries.findLastIndex((entry) => entry.entry_type === "adjustment");
  const total = latestEntry
    ? latestEntry.remaining_quantity === null
      ? entries.slice(lastAdjustment + 1).reduce((sum, entry) => sum + Number(entry.quantity), lastAdjustment < 0 ? 0 : Number(entries[lastAdjustment].remaining_quantity))
      : Number(latestEntry.quantity) + Number(latestEntry.remaining_quantity)
    : 0;

  let consumedTotal = 0;
  let elapsedDaysTotal = 0;
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    // A correction is not measured consumption or a purchase. Do not bridge it.
    if (previous.entry_type === "adjustment" || current.entry_type === "adjustment") continue;
    if (previous.remaining_quantity === null || current.remaining_quantity === null) continue;
    const elapsedDays = (new Date(current.created_at).getTime() - new Date(previous.created_at).getTime()) / 86_400_000;
    const consumed = Number(previous.quantity) + Number(previous.remaining_quantity) - Number(current.remaining_quantity);
    if (elapsedDays > 0 && consumed >= 0) {
      consumedTotal += consumed;
      elapsedDaysTotal += elapsedDays;
    }
  }

  return {
    total,
    averagePerDay: elapsedDaysTotal > 0 ? consumedTotal / elapsedDaysTotal : null,
    hasEntries: entries.length > 0,
    lastRestockedAt: entries.findLast((entry) => entry.entry_type !== "adjustment")?.created_at ?? null,
    stockReferenceAt: latestEntry?.created_at ?? null,
    nextEntryAt: nextEntry?.created_at ?? null,
    // A future purchase is not stock on hand. Only expose an absolute balance,
    // and only when no earlier baseline/movement can be confused with it.
    ...(!latestEntry && nextEntry?.entry_type === "adjustment" && nextEntry.remaining_quantity !== null
      ? { scheduledStockAdjustment: { quantity: Number(nextEntry.remaining_quantity), effectiveAt: nextEntry.created_at } }
      : {}),
  };
}
