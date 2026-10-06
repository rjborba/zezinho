"use client";

import { useActionState, useId, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { createItemAction, updateItemAction } from "@/app/actions";
import { MedicationFields } from "@/components/medication-fields";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { MEDICATION_STOCK_UNITS, type InventoryItem, type RecordKind, type StockUnit } from "@/lib/types";
import { unitLabel } from "@/lib/units";

export function ItemForm({
  item,
  kind = item?.kind ?? "item",
  disabled = false,
  onCancel,
  onSuccess,
  onPendingChange,
}: {
  item?: Pick<InventoryItem, "id" | "name" | "unit" | "kind" | "medication">;
  kind?: RecordKind;
  disabled?: boolean;
  onCancel?: () => void;
  onSuccess?: (message: string) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  // Radio defaults follow the draft so form resets preserve it after errors.
  const [unit, setUnit] = useState<StockUnit>(item?.unit ?? "unidade");
  const [stockPerDose, setStockPerDose] = useState(item?.medication?.stockPerDose !== undefined ? String(item.medication.stockPerDose) : "");
  const saveItem = item ? updateItemAction : createItemAction;
  const [actionState, formAction, pending] = useActionState(
    async (previousState: ActionState, formData: FormData) => {
      onPendingChange?.(true);
      try {
        const result = await saveItem(previousState, formData);
        if (result.status === "success") {
          setName(String(formData.get("name") ?? "").trim());
          onSuccess?.(result.message);
        }
        return result;
      } finally {
        onPendingChange?.(false);
      }
    },
    initialActionState,
  );
  // A restored editor must remain usable when a save finished after navigation
  // and its action feedback is no longer present.
  const state = actionState ?? initialActionState;
  const nameId = useId();

  return (
    <form
      action={formAction}
      // A resolved validation error also triggers React's automatic form reset.
      // Keep the draft; successful creation closes its modal explicitly.
      onReset={(event) => event.preventDefault()}
      className={item ? "item-edit-form stack-form" : "stack-form"}
      aria-label={item ? `Editar ${item.name}` : kind === "medicamento" ? "Novo medicamento" : "Novo item"}
    >
      {item && <input type="hidden" name="itemId" value={item.id} />}
      <input type="hidden" name="kind" value={kind} />

      <div className="field-group">
        <label htmlFor={nameId}>{kind === "medicamento" ? "Nome do medicamento" : "Nome do item"}</label>
        <input
          id={nameId}
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={kind === "medicamento" ? "Nome conforme a embalagem" : "Ex.: Sabonete"}
          autoComplete="off"
          autoFocus={!item}
          minLength={2}
          maxLength={80}
          required
          disabled={disabled || pending}
        />
      </div>

      {kind === "medicamento" && <MedicationFields medication={item?.medication} disabled={disabled || pending} />}

      {kind === "medicamento" ? (
        <div className="field-group">
          <label htmlFor={`${nameId}-stock-unit`}>Como contar o estoque?</label>
          <select id={`${nameId}-stock-unit`} name="unit" value={unit} onChange={(event) => setUnit(event.target.value as StockUnit)} disabled={disabled || pending}>
            {MEDICATION_STOCK_UNITS.map((option) => <option key={option} value={option}>{unitLabel(option, "long")}</option>)}
          </select>
          <p className="field-hint">A unidade de estoque é independente da dosagem. Ex.: dosagem de 500 mg e estoque em unidades.</p>
          {item && <p className="field-hint">Alterar a unidade mantém os valores das entradas existentes.</p>}
          <label htmlFor={`${nameId}-stock-per-dose`}>Quantidade de estoque por dose ({unitLabel(unit)}) <span className="optional-label">(opcional)</span></label>
          <input
            id={`${nameId}-stock-per-dose`}
            name="stockPerDose"
            type="number"
            inputMode="decimal"
            min="0.001"
            max="999999999"
            step="0.001"
            value={stockPerDose}
            onChange={(event) => setStockPerDose(event.target.value)}
            disabled={disabled || pending}
            aria-describedby={`${nameId}-stock-per-dose-hint`}
            placeholder={unit === "unidade" ? "Ex.: 1 comprimido" : `Quantidade em ${unitLabel(unit)}`}
          />
          <p className="field-hint" id={`${nameId}-stock-per-dose-hint`}>
            {unit === "unidade"
              ? "Informe quantas unidades são usadas por dose, conforme as orientações recebidas. Se a dosagem está em mg e este campo ficar vazio, a previsão considera 1 unidade por dose."
              : "Informe a quantidade do estoque usada por dose. Se ficar vazio, usamos a dosagem quando as unidades forem compatíveis. Não convertemos mg em ml ou gotas sem essa informação."}
          </p>
        </div>
      ) : (
      <fieldset className="field-group">
        <legend>Como ele é medido?</legend>
        <div className="unit-options">
          <label>
            <input
              type="radio"
              name="unit"
              value="unidade"
              defaultChecked={unit === "unidade"}
              onChange={() => setUnit("unidade")}
              disabled={disabled || pending}
            />
            <span>
              <strong>Unidade</strong>
              <small>Ex.: 10 un.</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="unit"
              value="ml"
              defaultChecked={unit === "ml"}
              onChange={() => setUnit("ml")}
              disabled={disabled || pending}
            />
            <span>
              <strong>Mililitros</strong>
              <small>Ex.: 500 ml</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="unit"
              value="kg"
              defaultChecked={unit === "kg"}
              onChange={() => setUnit("kg")}
              disabled={disabled || pending}
            />
            <span>
              <strong>Quilos</strong>
              <small>Ex.: 2,5 kg</small>
            </span>
          </label>
        </div>
        {item && (
          <p className="field-hint">
            Alterar a unidade mantém os valores das entradas existentes.
          </p>
        )}
      </fieldset>
      )}

      {state.message && (
        <p className={`form-message ${state.status}`} role="status">
          {state.status === "success" && <Check aria-hidden="true" size={18} />}
          {state.message}
        </p>
      )}

      <div className="item-form-actions">
        <button className="button button-primary" type="submit" disabled={disabled || pending}>
          {pending && <LoaderCircle className="spin" aria-hidden="true" size={20} />}
          {pending ? "Salvando..." : item ? "Salvar alteração" : kind === "medicamento" ? "Cadastrar medicamento" : "Cadastrar item"}
        </button>
        {onCancel && (
          <button
            className="button button-secondary"
            type="button"
            disabled={pending}
            onClick={onCancel}
          >
            {state.status === "success" ? "Fechar" : "Cancelar"}
          </button>
        )}
      </div>
    </form>
  );
}
