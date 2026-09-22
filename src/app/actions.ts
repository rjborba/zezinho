"use server";

import { revalidatePath, updateTag } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { UNITS, type StockUnit } from "@/lib/types";

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

  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "") as StockUnit;

  if (name.length < 2 || name.length > 80) {
    return { status: "error", message: "Informe um nome entre 2 e 80 caracteres." };
  }

  if (!UNITS.includes(unit)) {
    return { status: "error", message: "Escolha uma unidade válida." };
  }

  const { error } = await getSupabase().from("items").insert({ name, unit });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Esse item já está cadastrado." };
    }
    return { status: "error", message: "Não foi possível cadastrar. Tente novamente." };
  }

  revalidatePath("/");
  revalidatePath("/itens");
  revalidatePath("/entradas");
  updateTag("inventory");
  return { status: "success", message: `${name} foi cadastrado.` };
}

export async function createEntryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return configurationError();

  const itemId = String(formData.get("itemId") ?? "");
  const quantityText = String(formData.get("quantity") ?? "").replace(",", ".");
  const remainingText = String(formData.get("remainingQuantity") ?? "").replace(
    ",",
    ".",
  );
  const quantity = Number(quantityText);
  const remainingQuantity = Number(remainingText);

  if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return {
      status: "error",
      message: "Informe uma quantidade comprada maior que zero.",
    };
  }

  if (!Number.isFinite(remainingQuantity) || remainingQuantity < 0) {
    return {
      status: "error",
      message: "Informe quanto ainda restava antes da compra.",
    };
  }

  const supabase = getSupabase();
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("name,unit,archived_at")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return { status: "error", message: "Item não encontrado." };
  }

  if (item.archived_at) {
    return { status: "error", message: "Desarquive o item antes de dar entrada." };
  }

  if (
    item.unit === "unidade" &&
    (!Number.isInteger(quantity) || !Number.isInteger(remainingQuantity))
  ) {
    return { status: "error", message: "Use um número inteiro para unidades." };
  }

  const { error } = await supabase
    .from("stock_entries")
    .insert({
      item_id: itemId,
      quantity,
      remaining_quantity: remainingQuantity,
    });

  if (error) {
    return { status: "error", message: "Não foi possível registrar. Tente novamente." };
  }

  revalidatePath("/");
  revalidatePath("/itens");
  revalidatePath("/entradas");
  updateTag("inventory");
  return { status: "success", message: `Entrada de ${item.name} registrada.` };
}

export async function updateEntryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return configurationError();

  const entryId = String(formData.get("entryId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const quantity = Number(
    String(formData.get("quantity") ?? "").replace(",", "."),
  );
  const remainingQuantity = Number(
    String(formData.get("remainingQuantity") ?? "").replace(",", "."),
  );

  if (!entryId || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return { status: "error", message: "Revise a quantidade comprada." };
  }

  if (!Number.isFinite(remainingQuantity) || remainingQuantity < 0) {
    return { status: "error", message: "Revise quanto ainda restava." };
  }

  const supabase = getSupabase();
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("unit")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return { status: "error", message: "Item não encontrado." };
  }

  if (
    item.unit === "unidade" &&
    (!Number.isInteger(quantity) || !Number.isInteger(remainingQuantity))
  ) {
    return { status: "error", message: "Use números inteiros para unidades." };
  }

  const { error } = await supabase
    .from("stock_entries")
    .update({
      item_id: itemId,
      quantity,
      remaining_quantity: remainingQuantity,
    })
    .eq("id", entryId);

  if (error) {
    return { status: "error", message: "Não foi possível salvar a alteração." };
  }

  updateTag("inventory");
  revalidatePath("/");
  revalidatePath("/itens");
  revalidatePath("/entradas");
  return { status: "success", message: "Entrada atualizada." };
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
  revalidatePath("/entradas");
  updateTag("inventory");
}
