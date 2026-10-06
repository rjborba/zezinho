import type { StockUnit } from "@/lib/types";

export function unitLabel(
  unit: StockUnit,
  style: "short" | "long" = "short",
  quantity = 2,
) {
  if (style === "short") {
    if (unit === "unidade") return quantity === 1 ? "un." : "un.";
    return unit;
  }

  if (unit === "unidade") return "unidades";
  if (unit === "ml") return "mililitros";
  if (unit === "kg") return "quilos";
  if (unit === "mg") return "miligramas";
  if (unit === "g") return "gramas";
  return "gotas";
}

export function isCountUnit(unit: StockUnit) {
  return unit === "unidade" || unit === "gotas";
}

export function formatQuantity(quantity: number, unit: StockUnit) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits:
      isCountUnit(unit) && Number.isInteger(quantity) ? 0 : 3,
  }).format(quantity);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Recife",
  }).format(new Date(date));
}

export function formatDateOnly(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Recife",
  }).format(new Date(date));
}
