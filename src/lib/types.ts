export const UNITS = ["unidade", "ml", "kg"] as const;
export const MEDICATION_STOCK_UNITS = ["unidade", "ml", "mg", "g", "gotas"] as const;

export type StockUnit = (typeof UNITS)[number] | (typeof MEDICATION_STOCK_UNITS)[number];
export type RecordKind = "item" | "medicamento";

export type DosageComponent = {
  ingredient?: string;
  amount: number;
  unit: string;
};

export type MedicationDetails = {
  otherNames?: string[];
  posology:
    // Older medications may not have dose times until they are edited.
    | { type: "daily"; timesPerDay: number; times?: string[]; notes: string }
    | { type: "weekly"; timesPerDay: number; times?: string[]; daysOfWeek: number[]; notes: string }
    | { type: "free"; instructions: string };
  administrationRoute: string;
  customRoute: string;
  period: { type: "indefinite" } | { type: "range"; startDate: string; endDate: string };
  // Accept existing records; new saves use components, including single strengths.
  dosage: { amount: number; unit: string } | { components: DosageComponent[] };
  // Amount of the selected stock unit consumed by one scheduled dose.
  stockPerDose?: number;
};

export type InventoryItem = {
  id: string;
  name: string;
  unit: StockUnit;
  kind: RecordKind;
  requiresSpecialControl: boolean;
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
  scheduled: boolean;
};

export type InventoryData = {
  items: InventoryItem[];
  archivedItems: InventoryItem[];
  recentEntries: StockEntry[];
  nextScheduledEntryAt: string | null;
  configured: boolean;
  error: boolean;
};
