import { dosageComponents } from "@/lib/medications";
import type { InventoryItem } from "@/lib/types";

export function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, " ").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

export function matchesCatalogSearch(item: Pick<InventoryItem, "name" | "medication">, query: string): boolean {
  const normalizedQuery = normalizeSearch(query);
  const ingredients = item.medication ? dosageComponents(item.medication).map((component) => component.ingredient ?? "") : [];
  return [item.name, ...(item.medication?.otherNames ?? []), ...ingredients].some((name) => normalizeSearch(name).includes(normalizedQuery));
}
