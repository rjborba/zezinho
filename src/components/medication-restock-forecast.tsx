"use client";

import { useSyncExternalStore } from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";

import { getMedicationRestockForecast, type MedicationRestockForecast as Forecast, type MedicationStock } from "@/lib/medication-stock";
import type { StockUnit } from "@/lib/types";
import { formatQuantity, unitLabel } from "@/lib/units";

// One shared clock for every medication. The server snapshot is stable so a
// cached home page never freezes the countdown or causes hydration mismatches.
const clockListeners = new Set<() => void>();
let clockTime: number | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const getClock = () => clockTime;
const getServerClock = () => null;

function refreshClock() {
  clockTime = Date.now();
  clockListeners.forEach((listener) => listener());
}

function subscribeToClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockTimer === null) {
    refreshClock();
    clockTimer = setInterval(refreshClock, 60_000);
    document.addEventListener("visibilitychange", refreshClock);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
      document.removeEventListener("visibilitychange", refreshClock);
    }
  };
}

const dateLabel = (date: string) => date.split("-").reverse().join("/");

export function MedicationRestockStatus({ forecast, unit }: { forecast: Forecast; unit: StockUnit }) {
  if (forecast.status === "unavailable" || forecast.status === "ended") {
    return (
      <div className="medication-forecast medication-forecast-muted">
        <p>{forecast.status === "ended" ? "Período de uso encerrado · sem previsão de nova compra." : forecast.message}</p>
      </div>
    );
  }

  const urgent = forecast.status === "estimated" && forecast.urgent;
  const Icon = urgent ? AlertTriangle : CalendarClock;
  return (
    <div className={`medication-forecast${urgent ? " medication-forecast-urgent" : ""}`}>
      <p className="medication-forecast-title">
        <Icon aria-hidden="true" size={16} />
        <strong>
          {forecast.status === "covered"
            ? "Estoque suficiente para o período"
            : forecast.overdue
              ? "Comprar agora · estoque estimado esgotado"
              : forecast.daysLeft === 0
                ? "Comprar hoje"
                : `Restam ${forecast.daysLeft} ${forecast.daysLeft === 1 ? "dia" : "dias"}${urgent ? " · comprar em breve" : ""}`}
        </strong>
      </p>
      {forecast.status === "covered" ? (
        <p>Uso previsto até <time dateTime={forecast.endDate}>{dateLabel(forecast.endDate)}</time>.</p>
      ) : (
        <p>
          Comprar até <time dateTime={forecast.buyTime ? `${forecast.buyDate}T${forecast.buyTime}:00-03:00` : forecast.buyDate}>{dateLabel(forecast.buyDate)}{forecast.buyTime ? ` às ${forecast.buyTime}` : ""}</time>.
        </p>
      )}
      <p className="medication-forecast-basis">
        Estimativa: {formatQuantity(forecast.quantityPerDose, unit)} {unitLabel(unit)}/dose desde a última entrada.
        {forecast.assumedUnitPerDose && " Consideramos 1 unidade por dose; confirme no cadastro."}
        {forecast.approximateTimes && " Horários não informados; previsão por dia."}
      </p>
    </div>
  );
}

export function MedicationRestockForecast({ item }: { item: MedicationStock }) {
  const now = useSyncExternalStore(subscribeToClock, getClock, getServerClock);
  const forecast = now === null ? null : getMedicationRestockForecast(item, new Date(now));
  if (now === null) return <div className="medication-forecast medication-forecast-muted"><p>Calculando próxima compra...</p></div>;
  return forecast ? <MedicationRestockStatus forecast={forecast} unit={item.unit} /> : null;
}
