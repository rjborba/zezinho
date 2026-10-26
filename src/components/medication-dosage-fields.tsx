"use client";

import { useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { dosageComponents, DOSAGE_UNITS, MAX_DOSAGE_COMPONENTS } from "@/lib/medications";
import type { DosageComponent, MedicationDetails } from "@/lib/types";

function componentDraft(component: DosageComponent, id: number) {
  const knownUnit = (DOSAGE_UNITS as readonly string[]).includes(component.unit);
  return {
    id,
    ingredient: component.ingredient ?? "",
    amount: String(component.amount),
    unit: knownUnit ? component.unit : "outra",
    customUnit: knownUnit ? "" : component.unit,
    focusOnMount: false,
  };
}

export function MedicationDosageFields({ medication }: { medication?: MedicationDetails | null }) {
  const id = useId();
  const [components, setComponents] = useState(() => medication
    ? dosageComponents(medication).map(componentDraft)
    : [{ id: 0, ingredient: "", amount: "", unit: "mg", customUnit: "", focusOnMount: false }]);
  const nextId = useRef(components.length);
  const addButton = useRef<HTMLButtonElement>(null);
  const multiple = components.length > 1;

  function updateComponent(componentId: number, field: "ingredient" | "amount" | "unit" | "customUnit", value: string) {
    setComponents((current) => current.map((component) => component.id === componentId ? { ...component, [field]: value } : component));
  }

  return (
    <fieldset className="field-group dosage-fields">
      <legend>Dosagem</legend>
      <p className="field-hint">Para medicamentos com mais de um princípio ativo, adicione a dosagem de cada componente. Ex.: 400 mg + 80 mg.</p>
      {components.map((component, index) => {
        const componentId = `${id}-component-${component.id}`;
        return (
          <fieldset className="field-group dosage-component" key={component.id}>
            <legend>{multiple ? `Componente ${index + 1}` : "Componente"}</legend>
            <div className="field-group">
              <label htmlFor={`${componentId}-ingredient`}>Princípio ativo do componente {!multiple && <span className="optional-label">(opcional)</span>}</label>
              <input id={`${componentId}-ingredient`} name="dosageIngredient" value={component.ingredient} onChange={(event) => updateComponent(component.id, "ingredient", event.target.value)} maxLength={80} required={multiple} autoFocus={component.focusOnMount} placeholder="Ex.: Sulfametoxazol" />
            </div>
            <div className="form-columns">
              <div className="field-group">
                <label htmlFor={`${componentId}-amount`}>Quantidade da dosagem</label>
                <input id={`${componentId}-amount`} name="dosageAmount" type="number" inputMode="decimal" min="0.001" max="999999999" step="0.001" value={component.amount} onChange={(event) => updateComponent(component.id, "amount", event.target.value)} required />
              </div>
              <div className="field-group">
                <label htmlFor={`${componentId}-unit`}>Unidade da dosagem</label>
                <select id={`${componentId}-unit`} name="dosageUnit" value={component.unit} onChange={(event) => updateComponent(component.id, "unit", event.target.value)}>
                  {DOSAGE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  <option value="outra">Outra</option>
                </select>
              </div>
            </div>
            {component.unit === "outra" ? (
              <div className="field-group">
                <label htmlFor={`${componentId}-custom-unit`}>Outra unidade da dosagem</label>
                <input id={`${componentId}-custom-unit`} name="customDosageUnit" value={component.customUnit} onChange={(event) => updateComponent(component.id, "customUnit", event.target.value)} maxLength={32} required />
              </div>
            ) : <input type="hidden" name="customDosageUnit" value="" />}
            {multiple && (
              <button className="button button-secondary dosage-remove" type="button" aria-label={`Remover componente ${index + 1}`} onClick={() => {
                setComponents((current) => current.filter((entry) => entry.id !== component.id));
                addButton.current?.focus();
              }}>
                <Trash2 aria-hidden="true" size={16} /> Remover componente
              </button>
            )}
          </fieldset>
        );
      })}
      <button ref={addButton} className="button button-secondary" type="button" disabled={components.length >= MAX_DOSAGE_COMPONENTS} onClick={() => {
        const componentId = nextId.current++;
        setComponents((current) => [...current, { id: componentId, ingredient: "", amount: "", unit: "mg", customUnit: "", focusOnMount: true }]);
      }}>
        <Plus aria-hidden="true" size={18} /> Adicionar componente
      </button>
      {components.length >= MAX_DOSAGE_COMPONENTS && <p className="field-hint" role="status">Limite de {MAX_DOSAGE_COMPONENTS} componentes por medicamento.</p>}
    </fieldset>
  );
}
