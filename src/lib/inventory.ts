import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { summarizeStockEntries, type InventoryEntryRow } from "@/lib/inventory-stock";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { InventoryData, MedicationDetails, RecordKind, StockEntry, StockEntryType, StockUnit } from "@/lib/types";

const demoItems: InventoryData["items"] = [
  {
    id: "demo-fralda",
    name: "Fralda",
    unit: "unidade",
    kind: "item",
    requiresSpecialControl: false,
    medication: null,
    total: 32,
    averagePerDay: 4.2,
    hasEntries: true,
    lastRestockedAt: new Date().toISOString(),
    archivedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-lenco",
    name: "Lenço umedecido",
    unit: "unidade",
    kind: "item",
    requiresSpecialControl: false,
    medication: null,
    total: 8,
    averagePerDay: 1.6,
    hasEntries: true,
    lastRestockedAt: new Date().toISOString(),
    archivedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-sabonete",
    name: "Sabonete",
    unit: "unidade",
    kind: "item",
    requiresSpecialControl: false,
    medication: null,
    total: 10,
    averagePerDay: null,
    hasEntries: true,
    lastRestockedAt: new Date().toISOString(),
    archivedAt: null,
    createdAt: new Date().toISOString(),
  },
];

const demoArchivedItems: InventoryData["archivedItems"] = [
  {
    id: "demo-algodao",
    name: "Algodão",
    unit: "unidade",
    kind: "item",
    requiresSpecialControl: false,
    medication: null,
    total: 0,
    averagePerDay: null,
    hasEntries: false,
    lastRestockedAt: null,
    archivedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

const demoEntries: InventoryData["recentEntries"] = [
  {
    id: "demo-entry-fralda",
    entryType: "purchase",
    itemId: "demo-fralda",
    itemName: "Fralda",
    unit: "unidade",
    kind: "item",
    quantity: 30,
    remainingQuantity: 2,
    createdAt: new Date().toISOString(),
    scheduled: false,
  },
];

type ItemRow = {
  id: string;
  name: string;
  unit: StockUnit;
  kind: RecordKind;
  requires_special_control: boolean;
  medication: MedicationDetails | null;
  archived_at: string | null;
  created_at: string;
  stock_entries: InventoryEntryRow[] | null;
  medication_schedule_history: { effective_at: string; medication: MedicationDetails | null; unit: StockUnit }[] | null;
};

type EntryRow = {
  entry_type: StockEntryType;
  id: string;
  item_id: string;
  quantity: number | string;
  remaining_quantity: number | string | null;
  created_at: string;
  items: { name: string; unit: StockUnit; kind: RecordKind } | { name: string; unit: StockUnit; kind: RecordKind }[] | null;
};

async function getInventoryRows(): Promise<{ itemRows: ItemRow[]; entryRows: EntryRow[] }> {
  "use cache";
  cacheLife({
    stale: 3_600,
    revalidate: 300,
    expire: 86_400,
  });
  cacheTag("inventory");

  const supabase = getSupabase();
  const [itemsResult, entriesResult] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id,name,unit,kind,requires_special_control,medication,archived_at,created_at,stock_entries(quantity,remaining_quantity,created_at,entry_type),medication_schedule_history(effective_at,medication,unit)",
      )
      .order("name"),
    supabase
      .from("stock_entries")
      .select("id,item_id,quantity,remaining_quantity,created_at,entry_type,items(name,unit,kind)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (itemsResult.error || entriesResult.error) throw itemsResult.error ?? entriesResult.error;
  return { itemRows: itemsResult.data as ItemRow[], entryRows: entriesResult.data as EntryRow[] };
}

export async function getInventory(): Promise<InventoryData> {
  // Cache the database snapshot, not which entries have already happened.
  // Scheduled entries must activate even when no database write occurs.
  await connection();

  if (!isSupabaseConfigured()) {
    return {
      items: demoItems,
      archivedItems: demoArchivedItems,
      recentEntries: demoEntries,
      nextScheduledEntryAt: null,
      configured: false,
      error: false,
    };
  }

  try {
    const { itemRows, entryRows } = await getInventoryRows();
    const now = new Date();
    let nextScheduledEntryAt: string | null = null;
    const allItems = itemRows.map((item) => {
      const { nextEntryAt, ...stock } = summarizeStockEntries(item.stock_entries ?? [], now);
      if (nextEntryAt && (!nextScheduledEntryAt || new Date(nextEntryAt) < new Date(nextScheduledEntryAt))) {
        nextScheduledEntryAt = nextEntryAt;
      }

      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        kind: item.kind,
        requiresSpecialControl: item.requires_special_control ?? false,
        medication: item.medication,
        medicationHistory: (item.medication_schedule_history ?? []).map((version) => ({ effectiveAt: version.effective_at, medication: version.medication, unit: version.unit })),
        createdAt: item.created_at,
        ...stock,
        archivedAt: item.archived_at,
      };
    });

    const items = allItems.filter((item) => item.archivedAt === null);
    const archivedItems = allItems.filter((item) => item.archivedAt !== null);

    const recentEntries = entryRows.flatMap(
      (entry): StockEntry[] => {
        const relatedItem = Array.isArray(entry.items) ? entry.items[0] : entry.items;
        if (!relatedItem) return [];

        return [
          {
            id: entry.id,
            entryType: entry.entry_type ?? "purchase",
            itemId: entry.item_id,
            itemName: relatedItem.name,
            unit: relatedItem.unit,
            kind: relatedItem.kind,
            quantity: Number(entry.quantity),
            remainingQuantity:
              entry.remaining_quantity === null
                ? null
                : Number(entry.remaining_quantity),
            createdAt: entry.created_at,
            scheduled: new Date(entry.created_at).getTime() > now.getTime(),
          },
        ];
      },
    );

    return {
      items,
      archivedItems,
      recentEntries,
      nextScheduledEntryAt,
      configured: true,
      error: false,
    };
  } catch {
    return {
      items: [],
      archivedItems: [],
      recentEntries: [],
      nextScheduledEntryAt: null,
      configured: true,
      error: true,
    };
  }
}
