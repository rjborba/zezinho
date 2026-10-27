export function EntryDateField({ id, defaultValue, disabled = false, adjustment = false }: {
  id: string;
  defaultValue: string;
  disabled?: boolean;
  adjustment?: boolean;
}) {
  return (
    <div className="field-group">
      <label htmlFor={id}>{adjustment ? "Data e hora de referência do saldo" : "Data e hora da entrada"}</label>
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
        Horário de Recife. Pode ser no passado ou no futuro. {adjustment ? "Ajustes futuros só passam a valer na data e hora escolhidas." : "Entradas futuras só entram no estoque na data e hora escolhidas."}
      </p>
    </div>
  );
}
