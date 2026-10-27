"use client";

import { useActionState, useId, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { createEntryAction } from "@/app/actions";
import { EntryDateField } from "@/components/entry-date-field";
import { SearchableItemSelect } from "@/components/searchable-item-select";
import { MedicationSummary } from "@/components/medication-summary";
import { MedicationCommercialNames } from "@/components/medication-commercial-names";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { formatEntryDateTime } from "@/lib/entry-dates";
import type { InventoryItem, RecordKind, StockEntryType } from "@/lib/types";
import { isCountUnit, unitLabel } from "@/lib/units";

export function EntryForm({
  items,
  kind,
  entryType = "purchase",
  disabled = false,
  onCancel,
  onSuccess,
  onPendingChange,
}: {
  items: InventoryItem[];
  kind: RecordKind;
  entryType?: StockEntryType;
  disabled?: boolean;
  onCancel?: () => void;
  onSuccess?: (message: string) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [actionState, formAction, pending] = useActionState(
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
  const state = actionState ?? initialActionState;
  const [entryDate] = useState(() => formatEntryDateTime(new Date()));
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [remainingQuantity, setRemainingQuantity] = useState(entryType === "adjustment" ? "" : "0");
  const id = useId();
  const selectedItem = items.find((item) => item.id === selectedId);
  const countUnit = selectedItem ? isCountUnit(selectedItem.unit) : false;
  const label = kind === "medicamento" ? "Medicamento" : "Item";
  const adjustment = entryType === "adjustment";

  return (
    <form action={formAction} onReset={(event) => event.preventDefault()} className="stack-form" aria-label={`${adjustment ? "Ajuste de estoque de" : "Nova entrada de"} ${label.toLocaleLowerCase("pt-BR")}`}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="entryType" value={entryType} />
      {adjustment && <p className="notice">Informe o saldo total na data e hora escolhidas. O ajuste substitui o saldo de referência sem registrar uma compra. Para saldo após as doses do dia, escolha um horário posterior à última dose.</p>}
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
      {selectedItem?.medication && <><MedicationCommercialNames medication={selectedItem.medication} /><MedicationSummary medication={selectedItem.medication} /></>}
      {kind === "medicamento" && selectedItem && <p className="field-hint">Registre o estoque em {unitLabel(selectedItem.unit, "long")}, sem alterar a dosagem do medicamento.</p>}

      <EntryDateField id={`${id}-date`} defaultValue={entryDate} disabled={disabled || pending} adjustment={adjustment} />

      {adjustment ? <input type="hidden" name="quantity" value="0" /> : <div className="field-group">
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
      </div>}

      <div className="field-group">
        <label htmlFor={`${id}-remaining`}>{adjustment ? "Saldo total em estoque" : "Quanto ainda tinha?"}</label>
        <p className="field-hint">{adjustment ? "Quantidade total nessa data, não a diferença. Pode ser zero." : "Informe o saldo antes dessa compra, na data escolhida."}</p>
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
          {pending ? "Registrando..." : adjustment ? "Confirmar ajuste" : "Confirmar entrada"}
        </button>
        {onCancel && <button className="button button-secondary" type="button" disabled={pending} onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}
