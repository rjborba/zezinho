"use server";

import { revalidatePath, updateTag } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { parseCatalogForm } from "@/lib/catalog-validation";
import { entryTimestampForUpdate, parseEntryDateTime } from "@/lib/entry-dates";
import { parseStockEntryAmounts } from "@/lib/stock-entry-validation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isCountUnit } from "@/lib/units";

function configurationError(): ActionState {
  return {
    status: "error",
    message: "Conecte o Supabase antes de salvar.",
  };
}

export async function createItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return configurationError();

  const parsed = parseCatalogForm(formData);
  if ("error" in parsed) return { status: "error", message: parsed.error };
  const { name } = parsed.data;
  const { error } = await getSupabase().from("items").insert(parsed.data);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Esse nome já está cadastrado." };
    }
    return { status: "error", message: "Não foi possível cadastrar. Tente novamente." };
  }

  revalidatePath("/");
  revalidatePath("/itens");
  revalidatePath("/medicamentos");
  revalidatePath("/entradas");
  updateTag("inventory");
  return { status: "success", message: `${name} foi cadastrado.` };
}

export async function updateItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return configurationError();

  const itemId = String(formData.get("itemId") ?? "");

  if (!itemId) {
    return { status: "error", message: "Item não encontrado." };
  }

  const parsed = parseCatalogForm(formData);
  if ("error" in parsed) return { status: "error", message: parsed.error };

  const { data, error } = await getSupabase()
    .from("items")
    .update(parsed.data)
    .eq("id", itemId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Esse nome já está cadastrado." };
    }
    return { status: "error", message: "Não foi possível salvar a alteração." };
  }

  if (!data) {
    return { status: "error", message: "Item não encontrado." };
  }

  updateTag("inventory");
  revalidatePath("/");
  revalidatePath("/itens");
  revalidatePath("/medicamentos");
  revalidatePath("/entradas");
  return { status: "success", message: parsed.data.kind === "medicamento" ? "Medicamento atualizado." : "Item atualizado." };
}

export async function createEntryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return configurationError();

  const itemId = String(formData.get("itemId") ?? "");
  const parsed = parseStockEntryAmounts(formData);
  if ("error" in parsed) return { status: "error", message: parsed.error };
  const { entryType, quantity, remainingQuantity } = parsed.data;
  const createdAt = parseEntryDateTime(formData.get("entryDate"));

  if (!createdAt) {
    return { status: "error", message: "Informe uma data e hora válidas para a entrada." };
  }

  if (!itemId) return { status: "error", message: "Escolha um item ou medicamento." };

  const supabase = getSupabase();
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("name,unit,kind,archived_at")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return { status: "error", message: "Item não encontrado." };
  }

  if (item.archived_at) {
    return { status: "error", message: "Desarquive o item antes de dar entrada." };
  }

  if (item.kind !== String(formData.get("kind") ?? "item")) {
    return { status: "error", message: "Escolha uma opção do tipo selecionado." };
  }

  if (
    isCountUnit(item.unit) &&
    (!Number.isInteger(quantity) || !Number.isInteger(remainingQuantity))
  ) {
    return { status: "error", message: "Use números inteiros para unidades ou gotas." };
  }

  const { error } = await supabase
    .from("stock_entries")
    .insert({
      item_id: itemId,
      entry_type: entryType,
      quantity,
      remaining_quantity: remainingQuantity,
      created_at: createdAt,
    });

  if (error) {
    return { status: "error", message: "Não foi possível registrar. Tente novamente." };
  }

  revalidatePath("/");
  revalidatePath("/itens");
  revalidatePath("/medicamentos");
  revalidatePath("/entradas");
  updateTag("inventory");
  return { status: "success", message: entryType === "adjustment" ? `Ajuste de ${item.name} registrado.` : `Entrada de ${item.name} registrada.` };
}

export async function updateEntryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return configurationError();

  const entryId = String(formData.get("entryId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const parsed = parseStockEntryAmounts(formData);
  if ("error" in parsed) return { status: "error", message: parsed.error };
  const { entryType, quantity, remainingQuantity } = parsed.data;
  const entryDate = String(formData.get("entryDate") ?? "");

  if (!parseEntryDateTime(entryDate)) {
    return { status: "error", message: "Informe uma data e hora válidas para a entrada." };
  }

  if (!entryId || !itemId) return { status: "error", message: "Movimentação ou item não encontrado." };

  const supabase = getSupabase();
  const [{ data: item, error: itemError }, { data: entry, error: entryError }] = await Promise.all([
    supabase.from("items").select("unit,kind").eq("id", itemId).single(),
    supabase.from("stock_entries").select("created_at,entry_type").eq("id", entryId).maybeSingle(),
  ]);

  if (entryError || !entry) {
    return { status: "error", message: "Entrada não encontrada." };
  }

  if ((entry.entry_type ?? "purchase") !== entryType) {
    return { status: "error", message: "Não é possível converter uma compra em ajuste ou um ajuste em compra." };
  }

  if (itemError || !item) {
    return { status: "error", message: "Item não encontrado." };
  }

  if (item.kind !== String(formData.get("kind") ?? "item")) {
    return { status: "error", message: "Escolha uma opção do tipo selecionado." };
  }

  if (
    isCountUnit(item.unit) &&
    (!Number.isInteger(quantity) || !Number.isInteger(remainingQuantity))
  ) {
    return { status: "error", message: "Use números inteiros para unidades ou gotas." };
  }

  const { data: updated, error } = await supabase
    .from("stock_entries")
    .update({
      item_id: itemId,
      quantity,
      remaining_quantity: remainingQuantity,
      created_at: entryTimestampForUpdate(entryDate, entry.created_at),
    })
    .eq("id", entryId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { status: "error", message: "Não foi possível salvar a alteração." };
  }

  if (!updated) {
    return { status: "error", message: "Entrada não encontrada." };
  }

  updateTag("inventory");
  revalidatePath("/");
  revalidatePath("/itens");
  revalidatePath("/medicamentos");
  revalidatePath("/entradas");
  return { status: "success", message: entryType === "adjustment" ? "Ajuste atualizado." : "Entrada atualizada." };
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return;

  const { error } = await getSupabase()
    .from("stock_entries")
    .delete()
    .eq("id", entryId);

  if (error) return;

  updateTag("inventory");
  revalidatePath("/");
  revalidatePath("/itens");
  revalidatePath("/medicamentos");
  revalidatePath("/entradas");
}

export async function setItemArchivedAction(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const itemId = String(formData.get("itemId") ?? "");
  const shouldArchive = String(formData.get("shouldArchive")) === "true";

  if (!itemId) return;

  const { error } = await getSupabase()
    .from("items")
    .update({ archived_at: shouldArchive ? new Date().toISOString() : null })
    .eq("id", itemId);

  if (error) return;

  revalidatePath("/");
  revalidatePath("/itens");
  revalidatePath("/medicamentos");
  revalidatePath("/entradas");
  updateTag("inventory");
}
