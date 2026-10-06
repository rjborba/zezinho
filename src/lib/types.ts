export const UNITS = ["unidade", "ml", "kg"] as const;
export const MEDICATION_STOCK_UNITS = ["unidade", "ml", "mg", "g", "gotas"] as const;

export type StockUnit = (typeof UNITS)[number] | (typeof MEDICATION_STOCK_UNITS)[number];
export type RecordKind = "item" | "medicamento";

export type MedicationDetails = {
  posology:
    // Older medications may not have dose times until they are edited.
    | { type: "daily"; timesPerDay: number; times?: string[]; notes: string }
    | { type: "weekly"; timesPerDay: number; times?: string[]; daysOfWeek: number[]; notes: string }
    | { type: "free"; instructions: string };
  administrationRoute: string;
  customRoute: string;
  period: { type: "indefinite" } | { type: "range"; startDate: string; endDate: string };
  dosage: { amount: number; unit: string };
  // Amount of the selected stock unit consumed by one scheduled dose.
  stockPerDose?: number;
};

export type InventoryItem = {
  id: string;
  name: string;
  unit: StockUnit;
  kind: RecordKind;
  medication: MedicationDetails | null;
  total: number;
  averagePerDay: number | null;
  hasEntries: boolean;
  lastRestockedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type StockEntry = {
  id: string;
  itemId: string;
  itemName: string;
  unit: StockUnit;
  kind: RecordKind;
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
