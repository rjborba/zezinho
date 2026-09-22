"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { createEntryAction } from "@/app/actions";
import { SearchableItemSelect } from "@/components/searchable-item-select";
import { initialActionState } from "@/lib/action-state";
import type { InventoryItem } from "@/lib/types";
import { unitLabel } from "@/lib/units";

export function EntryForm({
  items,
  disabled = false,
}: {
  items: InventoryItem[];
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createEntryAction,
    initialActionState,
  );
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];

  useEffect(() => {
    if (state.status === "success") {
      const quantityInput = formRef.current?.elements.namedItem("quantity");
      const remainingInput = formRef.current?.elements.namedItem(
        "remainingQuantity",
      );
      if (quantityInput instanceof HTMLInputElement) {
        quantityInput.value = "";
        quantityInput.focus();
      }
      if (remainingInput instanceof HTMLInputElement) {
        remainingInput.value = "0";
      }
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="stack-form">
      <div className="field-group">
        <label htmlFor="itemId">Item</label>
        <SearchableItemSelect
          id="itemId"
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          disabled={disabled || pending}
        />
      </div>

      <div className="field-group">
        <label htmlFor="quantity">Quanto foi comprado?</label>
        <div className="quantity-input">
          <input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="decimal"
            placeholder={selectedItem?.unit === "unidade" ? "10" : "0,0"}
            min={selectedItem?.unit === "unidade" ? "1" : "0.001"}
            step={selectedItem?.unit === "unidade" ? "1" : "0.001"}
            disabled={disabled || pending}
            required
          />
          <span>{selectedItem ? unitLabel(selectedItem.unit, "short") : ""}</span>
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="remainingQuantity">Quanto ainda tinha?</label>
        <p className="field-hint">Conte o que restava antes de guardar a nova compra.</p>
        <div className="quantity-input">
          <input
            id="remainingQuantity"
            name="remainingQuantity"
            type="number"
            inputMode="decimal"
            defaultValue={0}
            min="0"
            step={selectedItem?.unit === "unidade" ? "1" : "0.001"}
            disabled={disabled || pending}
            required
          />
          <span>{selectedItem ? unitLabel(selectedItem.unit, "short") : ""}</span>
        </div>
      </div>

      {state.message && (
        <p className={`form-message ${state.status}`} role="status">
          {state.status === "success" && <Check aria-hidden="true" size={18} />}
          {state.message}
        </p>
      )}

      <button className="button button-primary" type="submit" disabled={disabled || pending}>
        {pending && <LoaderCircle className="spin" aria-hidden="true" size={20} />}
        {pending ? "Registrando..." : "Confirmar entrada"}
      </button>
    </form>
  );
}
