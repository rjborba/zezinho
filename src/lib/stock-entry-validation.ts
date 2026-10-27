import type { StockEntryType } from "@/lib/types";

export function parseStockEntryAmounts(form: FormData): { error: string } | { data: { entryType: StockEntryType; quantity: number; remainingQuantity: number } } {
  const entryType = String(form.get("entryType") ?? "purchase");
  if (entryType !== "purchase" && entryType !== "adjustment") return { error: "Tipo de movimentação inválido." };
  const quantityText = String(form.get("quantity") ?? "").trim().replace(",", ".");
  const remainingText = String(form.get("remainingQuantity") ?? "").trim().replace(",", ".");
  const quantity = Number(quantityText);
  const remainingQuantity = Number(remainingText);
  if (!quantityText || !Number.isFinite(quantity) || (entryType === "adjustment" ? quantity !== 0 : quantity <= 0)) {
    return { error: entryType === "adjustment" ? "O ajuste define o saldo, sem quantidade comprada." : "Informe uma quantidade comprada maior que zero." };
  }
  if (!remainingText || !Number.isFinite(remainingQuantity) || remainingQuantity < 0) {
    return { error: entryType === "adjustment" ? "Informe um saldo igual ou maior que zero." : "Informe quanto ainda restava antes da compra." };
  }
  return { data: { entryType: entryType as StockEntryType, quantity, remainingQuantity } };
}
