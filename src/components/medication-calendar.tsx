"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Pill } from "lucide-react";

import { MedicationCommercialNames } from "@/components/medication-commercial-names";
import { MedicationSummary } from "@/components/medication-summary";
import { SpecialControlBadge } from "@/components/special-control-badge";
import { Modal } from "@/components/modal";
import {
  addCalendarDays, calendarDateLabel, calendarDates, calendarDurationLabel, calendarGroupTiming, calendarNow,
  getMedicationCalendar, getNextMedicationGroup, isCalendarDate,
  type CalendarMedication, type CalendarView,
} from "@/lib/medication-calendar";
import { dosageLabel, routeLabel } from "@/lib/medications";
import type { MedicationDetails } from "@/lib/types";
import { useCurrentTime } from "@/lib/use-current-time";

const MIN_DATE = "0001-01-08";
const MAX_DATE = "9999-12-24";
const fullDate = (date: string) => calendarDateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
type CalendarSelection = {
  name: string;
  requiresSpecialControl: boolean;
  medication: MedicationDetails | null;
  date: string;
  time: string | null;
  reason?: string;
};

function CalendarMedicationCard({ name, medication, requiresSpecialControl, timeLabel, color, onSelect }: {
  name: string;
  medication: MedicationDetails | null;
  requiresSpecialControl: boolean;
  timeLabel: string;
  color?: number;
  onSelect: () => void;
}) {
  const dosage = medication ? dosageLabel(medication) : "Cadastro incompleto";
  const administrationRoute = medication ? routeLabel(medication).trim() : "";

  return (
    <button type="button" className={`calendar-event ${color === undefined ? "calendar-event-unscheduled" : `calendar-event-color-${color}`}`} aria-label={`${[timeLabel, name, medication?.otherNames?.join(", "), dosage, administrationRoute ? `Via: ${administrationRoute}` : null, requiresSpecialControl ? "Controle especial" : null].filter(Boolean).join(", ")}. Ver detalhes`} onClick={onSelect}>
      <span className="calendar-event-content">
        <span className="calendar-event-name">
          <strong>{name}</strong>
          {!!medication?.otherNames?.length && <span className="calendar-event-commercial-names">{medication.otherNames.join(" · ")}</span>}
          {(administrationRoute || requiresSpecialControl) && (
            <span className="calendar-event-badges">
              {administrationRoute && <span className="calendar-route-badge">{administrationRoute}</span>}
              <SpecialControlBadge required={requiresSpecialControl} />
            </span>
          )}
        </span>
        <span>{dosage}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

export function MedicationCalendar({ items }: { items: CalendarMedication[] }) {
  const now = useCurrentTime();
  return now === null ? (
    <div className="calendar-loading" role="status">Carregando agenda...</div>
  ) : (
    <CalendarContent items={items} now={now} />
  );
}

function CalendarContent({ items, now }: { items: CalendarMedication[]; now: number }) {
  const today = calendarNow(now);
  const [view, setView] = useState<CalendarView>("day");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarSelection | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const date = selectedDate ?? today.date;
  const dates = calendarDates(date, view);
  const { days, unscheduled } = getMedicationCalendar(items, dates);
  const events = days.flatMap((day) => day.events);
  const nextGroup = getNextMedicationGroup(items, today);
  const showNextSummary = dates.includes(today.date);
  const nextDayLabel = !nextGroup || nextGroup.date === today.date ? ""
    : nextGroup.date === addCalendarDays(today.date, 1) ? "amanhã "
      : `${calendarDateLabel(nextGroup.date, { day: "numeric", month: "short", year: nextGroup.date.slice(0, 4) !== today.date.slice(0, 4) ? "numeric" : undefined })} `;
  const nextLabel = nextGroup ? `${nextGroup.minutesUntil === 0 ? "Agora" : "Próximo"}: ${nextDayLabel}${nextGroup.time}${nextGroup.minutesUntil > 0 ? ` · em ${calendarDurationLabel(nextGroup.minutesUntil)}` : ""}` : "Sem próximos horários";
  const nextMedicationCount = new Set(nextGroup?.events.map((event) => event.itemId)).size;
  const gridStyle = {
    "--calendar-days": days.length,
    "--calendar-column-width": view === "week" ? "260px" : "0px",
  } as CSSProperties;
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScroll = useRef("");
  const scrollKey = `${date}-${view}-${focusRequest}`;

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || lastScroll.current === scrollKey) return;
    lastScroll.current = scrollKey;
    const column = viewport.querySelector<HTMLElement>('[data-calendar-focus-day="true"]');
    const timeGroups = column?.querySelectorAll<HTMLElement>("[data-calendar-state]");
    const target = column?.querySelector<HTMLElement>('[data-calendar-next="true"], [data-calendar-state="now"]')
      ?? (column?.classList.contains("calendar-day-today") ? timeGroups?.[timeGroups.length - 1] : null);
    const stickyHeaderHeight = viewport.querySelector<HTMLElement>(".calendar-grid-header")?.getBoundingClientRect().height ?? 0;
    viewport.scrollTo({
      top: target ? Math.max(0, target.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - stickyHeaderHeight - 12) : 0,
      left: column?.offsetLeft ?? 0,
      behavior: "instant",
    });
  }, [scrollKey]);

  const moveDate = (direction: number) => {
    const next = addCalendarDays(date, direction * (view === "week" ? 7 : 1));
    if (isCalendarDate(next) && next >= MIN_DATE && next <= MAX_DATE) setSelectedDate(next);
  };
  const rangeLabel = view === "day"
    ? calendarDateLabel(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : `${calendarDateLabel(dates[0], { day: "numeric", month: "short", year: dates[0].slice(0, 4) !== dates[6].slice(0, 4) ? "numeric" : undefined })} – ${calendarDateLabel(dates[6], { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <section className="medication-calendar" aria-label="Agenda de medicamentos">
        <header className="calendar-header">
          <div className="calendar-range">
            <h2 aria-live="polite">
              <label className="calendar-date-picker calendar-range-picker">
                <span>{rangeLabel}</span>
                <CalendarDays size={16} aria-hidden="true" />
                <span className="sr-only">Escolher data</span>
                <input type="date" aria-label="Escolher data" min={MIN_DATE} max={MAX_DATE} value={date} onChange={(event) => {
                  const value = event.target.value;
                  if (isCalendarDate(value) && value >= MIN_DATE && value <= MAX_DATE) setSelectedDate(value);
                }} />
              </label>
            </h2>
            <p className={showNextSummary ? "calendar-range-meta-live" : undefined}>
              {showNextSummary ? nextGroup ? (
                <button type="button" className="calendar-next-summary" aria-label={`${nextLabel} · ${nextMedicationCount} ${nextMedicationCount === 1 ? "medicamento" : "medicamentos"}. Ver horário`} onClick={() => { setSelectedDate(nextGroup.date === today.date ? null : nextGroup.date); setFocusRequest((value) => value + 1); }}>
                  <span>{nextLabel}</span><span className="calendar-next-count">· {nextMedicationCount} {nextMedicationCount === 1 ? "medicamento" : "medicamentos"}</span>
                </button>
              ) : <span>{nextLabel}</span> : <span>{events.length} {events.length === 1 ? "dose prevista" : "doses previstas"}</span>}
              <span className="calendar-clock"><span aria-hidden="true" /> Agora, {today.time} <small>Recife</small></span>
            </p>
          </div>
          <div className="calendar-toolbar">
            <div className="calendar-view-switch" role="group" aria-label="Visualização da agenda">
              <button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>Dia</button>
              <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Semana</button>
            </div>
            <div className="calendar-date-controls">
              <button type="button" className="calendar-arrow" aria-label={view === "day" ? "Dia anterior" : "Semana anterior"} disabled={addCalendarDays(date, view === "week" ? -7 : -1) < MIN_DATE} onClick={() => moveDate(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
              <button type="button" className="calendar-today-button" onClick={() => { setSelectedDate(null); setFocusRequest((value) => value + 1); }}>Hoje</button>
              <button type="button" className="calendar-arrow" aria-label={view === "day" ? "Próximo dia" : "Próxima semana"} disabled={addCalendarDays(date, view === "week" ? 7 : 1) > MAX_DATE} onClick={() => moveDate(1)}><ChevronRight size={20} aria-hidden="true" /></button>
            </div>
          </div>
        </header>

        {!events.length && !unscheduled.length && (
          <div className="calendar-empty" role="status">
            <Pill size={20} aria-hidden="true" />
            <p><strong>{items.length ? "Nenhuma dose com horário neste período." : "Sua agenda começa com um medicamento."}</strong><span>{items.length ? "Confira outra data ou os horários no cadastro." : "Cadastre os dias e horários para ver as doses aqui."}</span></p>
            <Link href="/medicamentos">Ver cadastro</Link>
          </div>
        )}

        <div className={`calendar-scroll calendar-scroll-${view}`} ref={scrollRef} tabIndex={0} role="region" aria-label={`Doses agrupadas por horário e medicamentos com horário não definido, ${view === "day" ? "neste dia" : "nesta semana"}. Horários de Recife. Role para ver todos os horários${view === "week" ? " e dias" : ""}.`} style={gridStyle}>
          <div className="calendar-grid">
            <div className="calendar-grid-header">
              {days.map((day) => (
                <button type="button" key={day.date} className={`calendar-day-heading${day.date === today.date ? " is-today" : ""}`} aria-current={day.date === today.date ? "date" : undefined} aria-label={`Ver ${fullDate(day.date)}`} onClick={() => { setSelectedDate(day.date === today.date ? null : day.date); setView("day"); }}>
                  <span>{calendarDateLabel(day.date, { weekday: "short" })}</span>
                  <strong>{Number(day.date.slice(8))}</strong>
                  {day.date === today.date && <small>Hoje</small>}
                </button>
              ))}
            </div>
            <div className="calendar-grid-body">
              {days.map((day) => (
                <section key={day.date} aria-label={fullDate(day.date)} data-calendar-focus-day={day.date === date || undefined} className={`calendar-day${day.date === today.date ? " calendar-day-today" : ""}`}>
                  {!day.groups.length && !day.unscheduled.length && <p className="calendar-day-empty">Nenhuma dose neste dia.</p>}
                  {day.groups.map((group) => {
                    const timing = calendarGroupTiming(day.date, group.minute, today, nextGroup);
                    return (
                      <section key={group.time} className={`calendar-time-group calendar-time-group-${timing.state}`} data-calendar-state={timing.state} data-calendar-next={(day.date === nextGroup?.date && group.time === nextGroup?.time) || undefined} aria-labelledby={`dose-time-${day.date}-${group.minute}`}>
                        <div className="calendar-time-group-heading">
                          <h3 id={`dose-time-${day.date}-${group.minute}`}><Clock3 size={16} aria-hidden="true" /><time dateTime={`${day.date}T${group.time}:00-03:00`}>{group.time}</time></h3>
                          <span>{group.events.length} {group.events.length === 1 ? "dose" : "doses"}</span>
                          <small className={`calendar-time-status calendar-time-status-${timing.state}`}>{timing.label}</small>
                        </div>
                        <ul className="calendar-dose-list">
                          {group.events.map((event) => (
                            <li key={event.id}>
                              <CalendarMedicationCard name={event.name} medication={event.medication} requiresSpecialControl={event.requiresSpecialControl} timeLabel={event.time} color={event.color} onSelect={() => setSelectedEvent(event)} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                  {day.unscheduled.length > 0 && (
                    <section className="calendar-time-group" aria-labelledby={`dose-time-${day.date}-unscheduled`}>
                      <div className="calendar-time-group-heading">
                        <h3 id={`dose-time-${day.date}-unscheduled`}><Clock3 size={16} aria-hidden="true" />Horário não definido</h3>
                        <span>{day.unscheduled.length} {day.unscheduled.length === 1 ? "medicamento" : "medicamentos"}</span>
                      </div>
                      <ul className="calendar-dose-list">
                        {day.unscheduled.map(({ item, reason }) => (
                          <li key={item.id}>
                            <CalendarMedicationCard name={item.name} medication={item.medication} requiresSpecialControl={item.requiresSpecialControl} timeLabel="Horário não definido" onSelect={() => setSelectedEvent({ name: item.name, requiresSpecialControl: item.requiresSpecialControl, medication: item.medication, date: day.date, time: null, reason })} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedEvent && (
        <Modal title={selectedEvent.name} onClose={() => setSelectedEvent(null)}>
          <div className="calendar-dose-details">
            {(Boolean(selectedEvent.medication?.otherNames?.length) || selectedEvent.requiresSpecialControl) && (
              <div className="calendar-dose-identity">
                {selectedEvent.medication && <MedicationCommercialNames medication={selectedEvent.medication} />}
                <SpecialControlBadge required={selectedEvent.requiresSpecialControl} />
              </div>
            )}
            <p className="calendar-dose-date"><CalendarDays size={20} aria-hidden="true" />{fullDate(selectedEvent.date)}<strong>{selectedEvent.time ? `${selectedEvent.time} · Recife` : "Horário não definido"}</strong></p>
            {selectedEvent.reason && selectedEvent.reason !== (selectedEvent.medication?.posology.type === "free" ? selectedEvent.medication.posology.instructions : null) && (
              <p className="calendar-unscheduled-reason">{selectedEvent.reason}</p>
            )}
            {selectedEvent.medication && <MedicationSummary medication={selectedEvent.medication} />}
            <div className="calendar-dose-actions">
              <Link className="button button-secondary" href="/medicamentos">Ver cadastro do medicamento</Link>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
