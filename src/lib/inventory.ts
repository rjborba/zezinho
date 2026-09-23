import { cacheLife, cacheTag } from "next/cache";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { InventoryData, StockEntry, StockUnit } from "@/lib/types";

const demoItems: InventoryData["items"] = [
  {
    id: "demo-fralda",
    name: "Fralda",
    unit: "unidade",
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
    itemId: "demo-fralda",
    itemName: "Fralda",
    unit: "unidade",
    quantity: 30,
    remainingQuantity: 2,
    createdAt: new Date().toISOString(),
  },
];

type ItemEntryRow = {
  quantity: number | string;
  remaining_quantity: number | string | null;
  created_at: string;
};

type ItemRow = {
  id: string;
  name: string;
  unit: StockUnit;
  archived_at: string | null;
  created_at: string;
  stock_entries: ItemEntryRow[] | null;
};

type EntryRow = {
  id: string;
  item_id: string;
  quantity: number | string;
  remaining_quantity: number | string | null;
  created_at: string;
  items: { name: string; unit: StockUnit } | { name: string; unit: StockUnit }[] | null;
};

export async function getInventory(): Promise<InventoryData> {
  "use cache";
  cacheLife({
    stale: 3_600,
    revalidate: 300,
    expire: 86_400,
  });
  cacheTag("inventory");

  if (!isSupabaseConfigured()) {
    return {
      items: demoItems,
      archivedItems: demoArchivedItems,
      recentEntries: demoEntries,
      configured: false,
      error: false,
    };
  }

  try {
    const supabase = getSupabase();
    const [itemsResult, entriesResult] = await Promise.all([
      supabase
        .from("items")
        .select(
          "id,name,unit,archived_at,created_at,stock_entries(quantity,remaining_quantity,created_at)",
        )
        .order("name"),
      supabase
        .from("stock_entries")
        .select("id,item_id,quantity,remaining_quantity,created_at,items(name,unit)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (itemsResult.error || entriesResult.error) {
      throw itemsResult.error ?? entriesResult.error;
    }

    const allItems = (itemsResult.data as ItemRow[]).map((item) => {
      const entries = [...(item.stock_entries ?? [])].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const latestEntry = entries.at(-1);
      const latestRemaining = latestEntry?.remaining_quantity;
      const total = latestEntry
        ? latestRemaining === null
          ? entries.reduce((sum, entry) => sum + Number(entry.quantity), 0)
          : Number(latestEntry.quantity) + Number(latestRemaining)
        : 0;

      let consumedTotal = 0;
      let elapsedDaysTotal = 0;

      for (let index = 1; index < entries.length; index += 1) {
        const previous = entries[index - 1];
        const current = entries[index];
        if (
          previous.remaining_quantity === null ||
          current.remaining_quantity === null
        ) {
          continue;
        }

        const elapsedDays =
          (new Date(current.created_at).getTime() -
            new Date(previous.created_at).getTime()) /
          86_400_000;
        const consumed =
          Number(previous.quantity) +
          Number(previous.remaining_quantity) -
          Number(current.remaining_quantity);

        if (elapsedDays > 0 && consumed >= 0) {
          consumedTotal += consumed;
          elapsedDaysTotal += elapsedDays;
        }
      }

      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        createdAt: item.created_at,
        total,
        averagePerDay:
          elapsedDaysTotal > 0 ? consumedTotal / elapsedDaysTotal : null,
        hasEntries: entries.length > 0,
        lastRestockedAt: latestEntry?.created_at ?? null,
        archivedAt: item.archived_at,
      };
    });

    const items = allItems.filter((item) => item.archivedAt === null);
    const archivedItems = allItems.filter((item) => item.archivedAt !== null);

    const recentEntries = (entriesResult.data as EntryRow[]).flatMap(
      (entry): StockEntry[] => {
        const relatedItem = Array.isArray(entry.items) ? entry.items[0] : entry.items;
        if (!relatedItem) return [];

        return [
          {
            id: entry.id,
            itemId: entry.item_id,
            itemName: relatedItem.name,
            unit: relatedItem.unit,
            quantity: Number(entry.quantity),
            remainingQuantity:
              entry.remaining_quantity === null
                ? null
                : Number(entry.remaining_quantity),
            createdAt: entry.created_at,
          },
        ];
      },
    );

    return {
      items,
      archivedItems,
      recentEntries,
      configured: true,
      error: false,
    };
  } catch {
    return {
      items: [],
      archivedItems: [],
      recentEntries: [],
      configured: true,
      error: true,
    };
  }
}
