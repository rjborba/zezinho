export function EntryDateField({ id, defaultValue, disabled = false }: {
  id: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <div className="field-group">
      <label htmlFor={id}>Data e hora da entrada</label>
      <input
        id={id}
        name="entryDate"
        type="datetime-local"
        defaultValue={defaultValue}
        max="9999-12-31T23:59"
        step="60"
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        required
      />
      <p className="field-hint" id={`${id}-hint`}>
        Horário de Recife. Pode ser no passado ou no futuro. Entradas futuras só entram no estoque na data e hora escolhidas.
      </p>
    </div>
  );
}
