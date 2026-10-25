"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Pill } from "lucide-react";

import { MedicationSummary } from "@/components/medication-summary";
import { Modal } from "@/components/modal";
import {
  addCalendarDays, calendarDateLabel, calendarDates, calendarNow, EVENT_DISPLAY_MINUTES,
  getMedicationCalendar, isCalendarDate,
  type CalendarMedication, type CalendarView, type MedicationEvent,
} from "@/lib/medication-calendar";
import { dosageLabel } from "@/lib/medications";
import { useCurrentTime } from "@/lib/use-current-time";

const HOUR_HEIGHT = 80;
const HOURS = Array.from({ length: 25 }, (_, hour) => hour);
const MIN_DATE = "0001-01-08";
const MAX_DATE = "9999-12-24";
const fullDate = (date: string) => calendarDateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

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
  const [selectedEvent, setSelectedEvent] = useState<MedicationEvent | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const date = selectedDate ?? today.date;
  const dates = calendarDates(date, view);
  const { days, unscheduled } = getMedicationCalendar(items, dates);
  const events = days.flatMap((day) => day.events);
  const todayIndex = dates.indexOf(today.date);
  const maxColumns = events.reduce((max, event) => Math.max(max, event.columns), 1);
  const columnWidth = view === "week" ? Math.max(140, maxColumns * 70) : Math.max(240, maxColumns * 140);
  const gridStyle = {
    "--calendar-days": days.length,
    "--calendar-column-width": `${columnWidth}px`,
    "--calendar-hour-height": `${HOUR_HEIGHT}px`,
    "--calendar-height": `${24 * HOUR_HEIGHT + 68}px`,
  } as CSSProperties;
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScroll = useRef("");
  const scrollKey = `${dates[0]}-${view}-${focusRequest}`;
  const firstMinute = events.reduce((first, event) => Math.min(first, event.minute), 24 * 60);
  const focusMinute = todayIndex >= 0 ? today.minute : firstMinute === 24 * 60 ? 8 * 60 : firstMinute;

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || lastScroll.current === scrollKey) return;
    lastScroll.current = scrollKey;
    const todayColumn = viewport.querySelector<HTMLElement>(".calendar-day-today");
    viewport.scrollTo({
      top: Math.max(0, focusMinute / 60 * HOUR_HEIGHT - 120),
      left: todayColumn ? todayColumn.offsetLeft - 64 : 0,
      behavior: "instant",
    });
  }, [scrollKey, focusMinute]);

  const moveDate = (direction: number) => {
    const next = addCalendarDays(date, direction * (view === "week" ? 7 : 1));
    if (isCalendarDate(next) && next >= MIN_DATE && next <= MAX_DATE) setSelectedDate(next);
  };
  const rangeLabel = view === "day"
    ? calendarDateLabel(date, { day: "numeric", month: "long", year: "numeric" })
    : `${calendarDateLabel(dates[0], { day: "numeric", month: "short", year: dates[0].slice(0, 4) !== dates[6].slice(0, 4) ? "numeric" : undefined })} – ${calendarDateLabel(dates[6], { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <section className="medication-calendar" aria-label="Agenda de medicamentos">
        <div className="calendar-toolbar">
          <div className="calendar-view-switch" role="group" aria-label="Visualização da agenda">
            <button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>Dia</button>
            <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Semana</button>
          </div>
          <span className="calendar-clock"><span aria-hidden="true" /> Agora, {today.time} <small>Recife</small></span>
        </div>

        <div className="calendar-navigation">
          <div className="calendar-range">
            <h2 aria-live="polite">{rangeLabel}</h2>
            <p>{events.length} {events.length === 1 ? "dose prevista" : "doses previstas"} · {view === "day" ? "neste dia" : "nesta semana"}</p>
          </div>
          <div className="calendar-date-controls">
            <button type="button" className="calendar-today-button" onClick={() => { setSelectedDate(null); setFocusRequest((value) => value + 1); }}>Hoje</button>
            <label className="calendar-date-picker">
              <CalendarDays size={18} aria-hidden="true" />
              <span className="sr-only">Escolher data</span>
              <input type="date" aria-label="Escolher data" min={MIN_DATE} max={MAX_DATE} value={date} onChange={(event) => {
                const value = event.target.value;
                if (isCalendarDate(value) && value >= MIN_DATE && value <= MAX_DATE) setSelectedDate(value);
              }} />
            </label>
            <button type="button" className="calendar-arrow" aria-label={view === "day" ? "Dia anterior" : "Semana anterior"} disabled={addCalendarDays(date, view === "week" ? -7 : -1) < MIN_DATE} onClick={() => moveDate(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" className="calendar-arrow" aria-label={view === "day" ? "Próximo dia" : "Próxima semana"} disabled={addCalendarDays(date, view === "week" ? 7 : 1) > MAX_DATE} onClick={() => moveDate(1)}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
        </div>

        {!events.length && (
          <div className="calendar-empty" role="status">
            <Pill size={20} aria-hidden="true" />
            <p><strong>{items.length ? "Nenhuma dose com horário neste período." : "Sua agenda começa com um medicamento."}</strong><span>{items.length ? "Confira outra data ou os horários no cadastro." : "Cadastre os dias e horários para ver as doses aqui."}</span></p>
            <Link href="/itens">Ver cadastro</Link>
          </div>
        )}

        <div className="calendar-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label={`Calendário por ${view === "day" ? "dia" : "semana"}, horários de Recife. Role para ver todos os horários${view === "week" ? " e dias" : ""}.`} style={gridStyle}>
          <div className="calendar-grid">
            <div className="calendar-grid-header">
              <div className="calendar-time-heading"><Clock3 size={17} aria-hidden="true" /><span className="sr-only">Horário</span></div>
              {days.map((day) => (
                <button type="button" key={day.date} className={`calendar-day-heading${day.date === today.date ? " is-today" : ""}`} aria-current={day.date === today.date ? "date" : undefined} aria-label={`Ver ${fullDate(day.date)}`} onClick={() => { setSelectedDate(day.date === today.date ? null : day.date); setView("day"); }}>
                  <span>{calendarDateLabel(day.date, { weekday: "short" })}</span>
                  <strong>{Number(day.date.slice(8))}</strong>
                  {day.date === today.date && <small>Hoje</small>}
                </button>
              ))}
            </div>
            <div className="calendar-grid-body">
              <div className="calendar-hours" aria-hidden="true">
                {HOURS.map((hour) => <span key={hour} style={{ top: hour * HOUR_HEIGHT }}>{String(hour).padStart(2, "0")}:00</span>)}
                {todayIndex >= 0 && <strong className="calendar-now-label" style={{ top: today.minute / 60 * HOUR_HEIGHT }}>{today.time}</strong>}
              </div>
              {days.map((day) => (
                <section key={day.date} aria-label={fullDate(day.date)} className={`calendar-day${day.date === today.date ? " calendar-day-today" : ""}`}>
                  {day.events.map((event) => (
                    <button type="button" key={event.id} className={`calendar-event calendar-event-color-${event.color}`} aria-label={`${event.time}, ${event.name}, ${dosageLabel(event.medication)}. Ver detalhes`} title={`${event.time} · ${event.name} · ${dosageLabel(event.medication)}`} style={{
                      top: event.minute / 60 * HOUR_HEIGHT,
                      height: EVENT_DISPLAY_MINUTES / 60 * HOUR_HEIGHT - 4,
                      left: `calc(${event.column / event.columns * 100}% + 4px)`,
                      width: `calc(${100 / event.columns}% - 8px)`,
                    }} onClick={() => setSelectedEvent(event)}>
                      <span className="calendar-event-time"><Pill size={12} aria-hidden="true" /><time dateTime={`${event.date}T${event.time}:00-03:00`}>{event.time}</time></span>
                      <strong>{event.name}</strong>
                      <span>{dosageLabel(event.medication)}</span>
                    </button>
                  ))}
                  {day.date === today.date && <div className="calendar-now-line" role="img" aria-label={`Agora: ${today.time}, ${fullDate(today.date)}`} style={{ top: today.minute / 60 * HOUR_HEIGHT }}><span /></div>}
                </section>
              ))}
            </div>
          </div>
        </div>
        <div className="calendar-footer">
          <span><span className="calendar-legend-dot" /> Horário atual</span>
          <p>{view === "week" ? "Deslize para ver os dias e horários." : "Role para ver todos os horários."} Toque em uma dose para ver os detalhes.</p>
        </div>
      </section>

      {unscheduled.length > 0 && (
        <section className="calendar-unscheduled" aria-labelledby="unscheduled-title">
          <div className="section-heading"><div><h2 id="unscheduled-title">Sem horário definido</h2><p>Medicamentos deste período que não aparecem na linha do tempo.</p></div><Link href="/itens">Ver cadastro</Link></div>
          <ul>{unscheduled.map(({ item, reason }) => <li key={item.id}><Pill size={20} aria-hidden="true" /><div><strong>{item.name}</strong><p>{reason}</p></div></li>)}</ul>
        </section>
      )}
      <p className="calendar-note">A agenda mostra as doses previstas conforme o cadastro. Cada bloco representa uma tomada, sem registrar se ela foi realizada.</p>

      {selectedEvent && (
        <Modal title={selectedEvent.name} onClose={() => setSelectedEvent(null)}>
          <p className="calendar-dose-date"><CalendarDays size={20} aria-hidden="true" />{fullDate(selectedEvent.date)}<strong>{selectedEvent.time} · Recife</strong></p>
          <MedicationSummary medication={selectedEvent.medication} />
          <Link className="button button-secondary" href="/itens">Ver cadastro do medicamento</Link>
        </Modal>
      )}
    </>
  );
}
