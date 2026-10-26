"use client";

import { useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { normalizeSearch } from "@/lib/catalog-search";
import { medicationNamesError } from "@/lib/medication-names";

export function MedicationNamesField({ names, draft, mainName, disabled, onChange, onDraftChange }: {
  names: string[];
  draft: string;
  mainName: string;
  disabled: boolean;
  onChange: (names: string[]) => void;
  onDraftChange: (draft: string) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const visibleError = draft.trim() ? error : "";

  function addName() {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (/[,;\n]/.test(draft)) {
      setError("Adicione um nome comercial por vez.");
      return;
    }
    if ([mainName, ...names].some((existing) => normalizeSearch(existing) === normalizeSearch(name))) {
      setError("Esse nome já está cadastrado.");
      return;
    }
    const validationError = medicationNamesError([...names, name]);
    if (validationError) {
      setError(validationError);
      return;
    }
    onChange([...names, name]);
    onDraftChange("");
    setError("");
    inputRef.current?.focus();
  }

  return (
    <fieldset className="field-group commercial-names-field" disabled={disabled}>
      <legend>Nomes comerciais <span className="optional-label">(opcional)</span></legend>
      {names.map((name) => <input key={name} type="hidden" name="otherNames" value={name} />)}
      <label className="sr-only" htmlFor={id}>Nome comercial</label>
      <div className="commercial-name-control">
        <input
          id={id}
          ref={inputRef}
          name="otherNames"
          value={draft}
          onChange={(event) => { onDraftChange(event.target.value); setError(""); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              addName();
            }
          }}
          maxLength={80}
          autoComplete="off"
          placeholder="Ex.: Vonau Flash"
          aria-describedby={`${id}-hint${visibleError ? ` ${id}-error` : ""}`}
          aria-invalid={!!visibleError}
        />
        <button className="button button-secondary" type="button" onClick={addName} disabled={disabled || !draft.trim()}>
          <Plus aria-hidden="true" size={17} /> Adicionar nome
        </button>
      </div>
      <p className="field-hint" id={`${id}-hint`}>Digite uma marca e clique em Adicionar nome ou pressione Enter.</p>
      {visibleError && <p className="form-message error" id={`${id}-error`} role="alert">{visibleError}</p>}
      {names.length > 0 && (
        <ul className="commercial-name-list" aria-label="Nomes comerciais cadastrados">
          {names.map((name) => (
            <li key={name}>
              <span>{name}</span>
              <button type="button" aria-label={`Remover ${name}`} onClick={() => { onChange(names.filter((existing) => existing !== name)); setError(""); }}>
                <X aria-hidden="true" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
