"use client";

import { useId, useState } from "react";
import { ADMINISTRATION_ROUTES, DOSAGE_UNITS, WEEKDAYS } from "@/lib/medications";
import type { MedicationDetails } from "@/lib/types";

export function MedicationFields({ medication, disabled }: { medication?: MedicationDetails | null; disabled: boolean }) {
  const id = useId();
  const [posologyType, setPosologyType] = useState(medication?.posology.type ?? "daily");
  const [timesPerDay, setTimesPerDay] = useState(medication && medication.posology.type !== "free" ? String(medication.posology.timesPerDay) : "");
  const [doseTimes, setDoseTimes] = useState<string[]>(
    medication && medication.posology.type !== "free" ? medication.posology.times ?? [] : [],
  );
  const frequency = Number(timesPerDay);
  const doseCount = Number.isInteger(frequency) && frequency >= 1 && frequency <= 99 ? frequency : 0;
  const [daysOfWeek, setDaysOfWeek] = useState(medication?.posology.type === "weekly" ? medication.posology.daysOfWeek : []);
  const [instructions, setInstructions] = useState(medication?.posology.type === "free" ? medication.posology.instructions : "");
  const [notes, setNotes] = useState(medication && medication.posology.type !== "free" ? medication.posology.notes : "");
  const [route, setRoute] = useState(medication?.administrationRoute ?? "");
  const [customRoute, setCustomRoute] = useState(medication?.customRoute ?? "");
  const [periodType, setPeriodType] = useState(medication?.period.type ?? "indefinite");
  const [startDate, setStartDate] = useState(medication?.period.type === "range" ? medication.period.startDate : "");
  const [endDate, setEndDate] = useState(medication?.period.type === "range" ? medication.period.endDate : "");
  const [amount, setAmount] = useState(medication ? String(medication.dosage.amount) : "");
  const knownDosageUnit = !medication || (DOSAGE_UNITS as readonly string[]).includes(medication.dosage.unit);
  const [dosageUnit, setDosageUnit] = useState(knownDosageUnit ? medication?.dosage.unit ?? "mg" : "outra");
  const [customDosageUnit, setCustomDosageUnit] = useState(knownDosageUnit ? "" : medication?.dosage.unit ?? "");

  return (
    <fieldset className="medication-fields stack-form" disabled={disabled}>
      <legend className="sr-only">Informações do medicamento</legend>
      <div className="field-group">
        <label htmlFor={`${id}-posology`}>Posologia</label>
        <select id={`${id}-posology`} name="posologyType" value={posologyType} onChange={(event) => setPosologyType(event.target.value as typeof posologyType)}>
          <option value="daily">Todos os dias</option>
          <option value="weekly">Dias da semana</option>
          <option value="free">Descrever livremente</option>
        </select>
      </div>
      {posologyType === "free" ? (
        <div className="field-group">
          <label htmlFor={`${id}-instructions`}>Como e quando tomar?</label>
          <textarea id={`${id}-instructions`} name="posologyInstructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={1000} required placeholder="Descreva as orientações recebidas" />
        </div>
      ) : (
        <>
          {posologyType === "weekly" && (
            <fieldset className="field-group">
              <legend>Quais dias da semana?</legend>
              <div className="weekday-options">
                {WEEKDAYS.map((day) => (
                  <label key={day.value}>
                    <input type="checkbox" name="daysOfWeek" value={day.value} aria-label={day.full} defaultChecked={daysOfWeek.includes(day.value)} onChange={(event) => setDaysOfWeek((current) => event.target.checked ? [...current, day.value] : current.filter((value) => value !== day.value))} />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="field-group">
            <label htmlFor={`${id}-frequency`}>Quantas vezes por dia?</label>
            <input id={`${id}-frequency`} name="timesPerDay" type="number" inputMode="numeric" min="1" max="99" step="1" value={timesPerDay} onChange={(event) => setTimesPerDay(event.target.value)} required />
          </div>
          {doseCount > 0 && (
            <fieldset className="field-group">
              <legend>Horários das doses</legend>
              <div className="form-columns dose-time-fields">
                {Array.from({ length: doseCount }, (_, index) => (
                  <div className="field-group" key={index}>
                    <label htmlFor={`${id}-dose-time-${index}`}>Horário da {index + 1}ª dose</label>
                    <input
                      id={`${id}-dose-time-${index}`}
                      name="doseTimes"
                      type="time"
                      step="60"
                      value={doseTimes[index] ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDoseTimes((current) => {
                          const next = [...current];
                          next[index] = value;
                          return next;
                        });
                      }}
                      required
                    />
                  </div>
                ))}
              </div>
              <p className="field-hint">
                {posologyType === "weekly" ? "Estes horários valem para os dias da semana selecionados." : "Escolha um horário para cada tomada diária."}
              </p>
            </fieldset>
          )}
          <div className="field-group">
            <label htmlFor={`${id}-notes`}>Orientações adicionais <span className="optional-label">(opcional)</span></label>
            <textarea id={`${id}-notes`} name="posologyNotes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Ex.: quantidade por tomada e orientações recebidas" />
          </div>
        </>
      )}
      <div className="field-group">
        <label htmlFor={`${id}-route`}>Via de administração</label>
        <select id={`${id}-route`} name="administrationRoute" value={route} onChange={(event) => setRoute(event.target.value)} required>
          <option value="" disabled>Selecione como tomar</option>
          {ADMINISTRATION_ROUTES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {route === "outra" && (
        <div className="field-group">
          <label htmlFor={`${id}-custom-route`}>Outra via de administração</label>
          <input id={`${id}-custom-route`} name="customRoute" value={customRoute} onChange={(event) => setCustomRoute(event.target.value)} maxLength={120} required />
        </div>
      )}
      <div className="field-group">
        <label htmlFor={`${id}-period`}>Período de uso</label>
        <select id={`${id}-period`} name="periodType" value={periodType} onChange={(event) => setPeriodType(event.target.value as typeof periodType)}>
          <option value="indefinite">Por tempo indeterminado</option>
          <option value="range">Data de início e fim</option>
        </select>
      </div>
      {periodType === "range" && (
        <div className="form-columns">
          <div className="field-group">
            <label htmlFor={`${id}-start`}>Data inicial</label>
            <input id={`${id}-start`} name="startDate" type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} required />
          </div>
          <div className="field-group">
            <label htmlFor={`${id}-end`}>Data final</label>
            <input id={`${id}-end`} name="endDate" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} required />
          </div>
        </div>
      )}
      <fieldset className="field-group">
        <legend>Dosagem</legend>
        <div className="form-columns">
          <div className="field-group">
            <label htmlFor={`${id}-amount`}>Quantidade da dosagem</label>
            <input id={`${id}-amount`} name="dosageAmount" type="number" inputMode="decimal" min="0.001" max="999999999" step="0.001" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </div>
          <div className="field-group">
            <label htmlFor={`${id}-dosage-unit`}>Unidade da dosagem</label>
            <select id={`${id}-dosage-unit`} name="dosageUnit" value={dosageUnit} onChange={(event) => setDosageUnit(event.target.value)}>
              {DOSAGE_UNITS.map((option) => <option key={option} value={option}>{option}</option>)}
              <option value="outra">Outra</option>
            </select>
          </div>
        </div>
        {dosageUnit === "outra" && (
          <div className="field-group">
            <label htmlFor={`${id}-custom-unit`}>Outra unidade da dosagem</label>
            <input id={`${id}-custom-unit`} name="customDosageUnit" value={customDosageUnit} onChange={(event) => setCustomDosageUnit(event.target.value)} maxLength={32} required />
          </div>
        )}
      </fieldset>
      <p className="field-hint">Registre a dosagem e as orientações recebidas. O app não calcula nem recomenda doses.</p>
    </fieldset>
  );
}
