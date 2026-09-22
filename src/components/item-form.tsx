"use client";

import { useActionState, useEffect, useRef } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { createItemAction } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";

export function ItemForm({ disabled = false }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(
    createItemAction,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="stack-form">
      <div className="field-group">
        <label htmlFor="name">Nome do item</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="Ex.: Sabonete"
          autoComplete="off"
          maxLength={80}
          required
          disabled={disabled || pending}
        />
      </div>

      <fieldset className="field-group">
        <legend>Como ele é medido?</legend>
        <div className="unit-options">
          <label>
            <input type="radio" name="unit" value="unidade" defaultChecked disabled={disabled || pending} />
            <span>
              <strong>Unidade</strong>
              <small>Ex.: 10 un.</small>
            </span>
          </label>
          <label>
            <input type="radio" name="unit" value="ml" disabled={disabled || pending} />
            <span>
              <strong>Mililitros</strong>
              <small>Ex.: 500 ml</small>
            </span>
          </label>
          <label>
            <input type="radio" name="unit" value="kg" disabled={disabled || pending} />
            <span>
              <strong>Quilos</strong>
              <small>Ex.: 2,5 kg</small>
            </span>
          </label>
        </div>
      </fieldset>

      {state.message && (
        <p className={`form-message ${state.status}`} role="status">
          {state.status === "success" && <Check aria-hidden="true" size={18} />}
          {state.message}
        </p>
      )}

      <button className="button button-primary" type="submit" disabled={disabled || pending}>
        {pending && <LoaderCircle className="spin" aria-hidden="true" size={20} />}
        {pending ? "Salvando..." : "Cadastrar item"}
      </button>
    </form>
  );
}
