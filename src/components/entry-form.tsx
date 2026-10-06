"use client";

import { useActionState, useId, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { createEntryAction } from "@/app/actions";
import { SearchableItemSelect } from "@/components/searchable-item-select";
import { MedicationSummary } from "@/components/medication-summary";
import { initialActionState, type ActionState } from "@/lib/action-state";
import type { InventoryItem, RecordKind } from "@/lib/types";
import { isCountUnit, unitLabel } from "@/lib/units";

export function EntryForm({
  items,
  kind,
  disabled = false,
  onCancel,
  onSuccess,
  onPendingChange,
}: {
  items: InventoryItem[];
  kind: RecordKind;
  disabled?: boolean;
  onCancel?: () => void;
  onSuccess?: (message: string) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (previousState: ActionState, formData: FormData) => {
      onPendingChange?.(true);
      try {
        const result = await createEntryAction(previousState, formData);
        if (result.status === "success") onSuccess?.(result.message);
        return result;
      } finally {
        onPendingChange?.(false);
      }
    },
    initialActionState,
  );
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [remainingQuantity, setRemainingQuantity] = useState("0");
  const id = useId();
  const selectedItem = items.find((item) => item.id === selectedId);
  const countUnit = selectedItem ? isCountUnit(selectedItem.unit) : false;
  const label = kind === "medicamento" ? "Medicamento" : "Item";

  return (
    <form action={formAction} onReset={(event) => event.preventDefault()} className="stack-form" aria-label={`Nova entrada de ${label.toLocaleLowerCase("pt-BR")}`}>
      <input type="hidden" name="kind" value={kind} />
      <div className="field-group">
        <label htmlFor={`${id}-item`}>{label}</label>
        <SearchableItemSelect
          id={`${id}-item`}
          label={label}
          autoFocus
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          disabled={disabled || pending}
        />
      </div>
      {selectedItem?.medication && <MedicationSummary medication={selectedItem.medication} />}
      {kind === "medicamento" && selectedItem && <p className="field-hint">Registre o estoque em {unitLabel(selectedItem.unit, "long")}, sem alterar a dosagem do medicamento.</p>}

      <div className="field-group">
        <label htmlFor={`${id}-quantity`}>Quanto foi comprado?</label>
        <div className="quantity-input">
          <input
            id={`${id}-quantity`}
            name="quantity"
            type="number"
            inputMode="decimal"
            placeholder={countUnit ? "10" : "0,0"}
            min={countUnit ? "1" : "0.001"}
            step={countUnit ? "1" : "0.001"}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={disabled || pending}
            required
          />
          <span>{selectedItem ? unitLabel(selectedItem.unit, "short") : ""}</span>
        </div>
      </div>

      <div className="field-group">
        <label htmlFor={`${id}-remaining`}>Quanto ainda tinha?</label>
        <p className="field-hint">Conte o que restava antes de guardar a nova compra.</p>
        <div className="quantity-input">
          <input
            id={`${id}-remaining`}
            name="remainingQuantity"
            type="number"
            inputMode="decimal"
            value={remainingQuantity}
            onChange={(event) => setRemainingQuantity(event.target.value)}
            min="0"
            step={countUnit ? "1" : "0.001"}
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

      <div className="item-form-actions">
        <button className="button button-primary" type="submit" disabled={disabled || pending}>
          {pending && <LoaderCircle className="spin" aria-hidden="true" size={20} />}
          {pending ? "Registrando..." : "Confirmar entrada"}
        </button>
        {onCancel && <button className="button button-secondary" type="button" disabled={pending} onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}
