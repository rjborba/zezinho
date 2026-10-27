"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";

import { deleteEntryAction, updateEntryAction } from "@/app/actions";
import { EntryDateField } from "@/components/entry-date-field";
import { SearchableItemSelect } from "@/components/searchable-item-select";
import { initialActionState } from "@/lib/action-state";
import { formatEntryDateTime } from "@/lib/entry-dates";
import type { InventoryItem, StockEntry } from "@/lib/types";
import { formatDate, formatQuantity, isCountUnit, unitLabel } from "@/lib/units";

function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="entry-action entry-action-danger"
      type="submit"
      disabled={pending}
    >
      {pending ? (
        <LoaderCircle className="spin" aria-hidden="true" size={16} />
      ) : (
        <Trash2 aria-hidden="true" size={16} />
      )}
      {pending ? "Excluindo" : "Excluir"}
    </button>
  );
}

function EditableEntryRow({
  entry,
  items,
}: {
  entry: StockEntry;
  items: InventoryItem[];
}) {
  const [editing, setEditing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(entry.itemId);
  const [actionState, formAction, pending] = useActionState(
    updateEntryAction,
    initialActionState,
  );
  const state = actionState ?? initialActionState;
  const selectedItem =
    items.find((item) => item.id === selectedItemId);
  const availableItems = items.filter((item) => item.kind === entry.kind);
  const countUnit = selectedItem ? isCountUnit(selectedItem.unit) : false;
  const adjustment = entry.entryType === "adjustment";

  return (
    <article className="entry-card">
      <div className="entry-row">
        <div>
          <h3>{entry.itemName}</h3>
          {adjustment && <span className="adjustment-entry-badge">Ajuste de estoque</span>}
          {entry.kind === "medicamento" && <span className="medication-badge">Medicamento</span>}
          {entry.scheduled && <span className="scheduled-entry-badge">{adjustment ? "Agendado" : "Agendada"}</span>}
          <p>
            <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
            {!adjustment && entry.remainingQuantity !== null && (
              <>
                {" · Restavam "}
                {formatQuantity(entry.remainingQuantity, entry.unit)}{" "}
                {unitLabel(entry.unit, "short", entry.remainingQuantity)}
              </>
            )}
          </p>
        </div>
        <p className="entry-value">
          {adjustment ? "Saldo: " : "+"}{formatQuantity(adjustment ? entry.remainingQuantity ?? 0 : entry.quantity, entry.unit)}{" "}
          {unitLabel(entry.unit, "short", adjustment ? entry.remainingQuantity ?? 0 : entry.quantity)}
        </p>
        <div className="entry-row-actions">
          <button
            className="entry-action"
            type="button"
            onClick={() => setEditing((current) => !current)}
            aria-expanded={editing}
          >
            {editing ? (
              <X aria-hidden="true" size={16} />
            ) : (
              <Pencil aria-hidden="true" size={16} />
            )}
            {editing ? "Cancelar" : "Editar"}
          </button>
          <form
            action={deleteEntryAction}
            onSubmit={(event) => {
              if (!window.confirm(adjustment ? "Excluir este ajuste? O saldo será recalculado pelo histórico restante. Essa ação não pode ser desfeita." : "Excluir esta entrada? Essa ação não pode ser desfeita.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="entryId" value={entry.id} />
            <DeleteButton />
          </form>
        </div>
      </div>

      {editing && (
        <form action={formAction} onReset={(event) => event.preventDefault()} className="entry-edit-form">
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="kind" value={entry.kind} />
          <input type="hidden" name="entryType" value={entry.entryType ?? "purchase"} />

          <div className="field-group">
            <label htmlFor={`item-${entry.id}`}>{entry.kind === "medicamento" ? "Medicamento" : "Item"}</label>
            <SearchableItemSelect
              id={`item-${entry.id}`}
              items={availableItems}
              label={entry.kind === "medicamento" ? "Medicamento" : "Item"}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
              disabled={pending}
            />
          </div>

          <EntryDateField
            id={`date-${entry.id}`}
            defaultValue={formatEntryDateTime(entry.createdAt)}
            disabled={pending}
            adjustment={adjustment}
          />

          <div className="entry-edit-grid">
            {adjustment ? <input type="hidden" name="quantity" value="0" /> : <div className="field-group">
              <label htmlFor={`quantity-${entry.id}`}>Comprado</label>
              <div className="quantity-input">
                <input
                  id={`quantity-${entry.id}`}
                  name="quantity"
                  type="number"
                  inputMode="decimal"
                  defaultValue={entry.quantity}
                  min={countUnit ? "1" : "0.001"}
                  step={countUnit ? "1" : "0.001"}
                  disabled={pending}
                  required
                />
                <span>{selectedItem ? unitLabel(selectedItem.unit) : ""}</span>
              </div>
            </div>}

            <div className="field-group">
              <label htmlFor={`remaining-${entry.id}`}>{adjustment ? "Saldo total em estoque" : "Ainda tinha"}</label>
              <div className="quantity-input">
                <input
                  id={`remaining-${entry.id}`}
                  name="remainingQuantity"
                  type="number"
                  inputMode="decimal"
                  defaultValue={entry.remainingQuantity ?? 0}
                  min="0"
                  step={countUnit ? "1" : "0.001"}
                  disabled={pending}
                  required
                />
                <span>{selectedItem ? unitLabel(selectedItem.unit) : ""}</span>
              </div>
            </div>
          </div>

          {state.message && (
            <p className={`form-message ${state.status}`} role="status">
              {state.status === "success" && <Check aria-hidden="true" size={18} />}
              {state.message}
            </p>
          )}

          <button className="button button-primary" type="submit" disabled={pending}>
            {pending && <LoaderCircle className="spin" aria-hidden="true" size={18} />}
            {pending ? "Salvando..." : "Salvar alteração"}
          </button>
        </form>
      )}
    </article>
  );
}

export function EntryHistory({
  entries,
  items,
}: {
  entries: StockEntry[];
  items: InventoryItem[];
}) {
  if (entries.length === 0) {
    return <p className="list-placeholder">Nenhuma entrada registrada ainda.</p>;
  }

  return (
    <div className="simple-list">
      {entries.map((entry) => (
        <EditableEntryRow entry={entry} items={items} key={entry.id} />
      ))}
    </div>
  );
}
