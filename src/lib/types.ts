export const UNITS = ["unidade", "ml", "kg"] as const;

export type StockUnit = (typeof UNITS)[number];

export type InventoryItem = {
  id: string;
  name: string;
  unit: StockUnit;
  total: number;
  averagePerDay: number | null;
  hasEntries: boolean;
  archivedAt: string | null;
  createdAt: string;
};

export type StockEntry = {
  id: string;
  itemId: string;
  itemName: string;
  unit: StockUnit;
  quantity: number;
  remainingQuantity: number | null;
  createdAt: string;
};

export type InventoryData = {
  items: InventoryItem[];
  archivedItems: InventoryItem[];
  recentEntries: StockEntry[];
  configured: boolean;
  error: boolean;
};
