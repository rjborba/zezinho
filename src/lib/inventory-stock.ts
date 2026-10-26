import type { InventoryItem } from "@/lib/types";

export type InventoryEntryRow = {
  quantity: number | string;
  remaining_quantity: number | string | null;
  created_at: string;
};

export function summarizeStockEntries(
  allEntries: InventoryEntryRow[],
  now: Date,
): Pick<InventoryItem, "total" | "averagePerDay" | "hasEntries" | "lastRestockedAt"> & { nextEntryAt: string | null } {
  const ordered = [...allEntries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const entries = ordered.filter((entry) => new Date(entry.created_at).getTime() <= now.getTime());
  const nextEntry = ordered.find((entry) => new Date(entry.created_at).getTime() > now.getTime());
  const latestEntry = entries.at(-1);
  const total = latestEntry
    ? latestEntry.remaining_quantity === null
      ? entries.reduce((sum, entry) => sum + Number(entry.quantity), 0)
      : Number(latestEntry.quantity) + Number(latestEntry.remaining_quantity)
    : 0;

  let consumedTotal = 0;
  let elapsedDaysTotal = 0;
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
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
    lastRestockedAt: latestEntry?.created_at ?? null,
    nextEntryAt: nextEntry?.created_at ?? null,
  };
}
