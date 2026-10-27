"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { MedicationRestockStatus } from "@/components/medication-restock-forecast";
import { medicationStockPerDose, type MedicationRestockForecast, type MedicationStockEstimate } from "@/lib/medication-stock";
import type { InventoryItem } from "@/lib/types";
import { formatDate, formatQuantity, unitLabel } from "@/lib/units";

export function MedicationStockQuantity({ item, estimate, forecast }: {
  item: InventoryItem;
  estimate: MedicationStockEstimate | null;
  forecast: MedicationRestockForecast | null;
}) {
  const [open, setOpen] = useState(false);
  const estimated = estimate?.status === "estimated";
  const quantity = estimated ? estimate.remaining : item.total;
  const hasQuantity = estimated || item.hasEntries;
  const remainingLabel = quantity === 1 ? "Resta" : "Restam";
  const scheduled = item.scheduledStockAdjustment;
  const referenceAt = estimated ? estimate.referenceAt : item.stockReferenceAt ?? item.lastRestockedAt;
  const dateLabel = forecast?.status === "estimated" ? forecast.buyDate.split("-").reverse().join("/") : null;
  const runOutLabel = forecast?.status === "estimated"
    ? `${forecast.daysLeft} ${forecast.daysLeft === 1 ? "dia" : "dias"}`
    : null;
  const endLabel = estimated && estimate.exhausted ? "Estoque estimado esgotado"
    : forecast?.status === "estimated" ? `Acaba em ${dateLabel} - ${runOutLabel}`
    : forecast?.status === "covered" ? "Suficiente até o fim do tratamento"
    : forecast?.status === "ended" ? "Período de uso encerrado"
    : item.medication?.posology?.type === "free" ? "Uso se necessário · sem previsão"
    : estimate?.status === "unavailable" && hasQuantity ? "Previsão indisponível · ver detalhes" : null;
  const compactEndLabel = forecast?.status === "estimated" && !forecast.overdue && !(estimated && estimate.exhausted)
    ? `Acaba em ${dateLabel?.slice(0, 5)} - ${runOutLabel}`
    : endLabel;
  const consumption = item.medication ? medicationStockPerDose(item.medication, item.unit) : null;
  const frequency = item.medication?.posology?.type === "daily" ? item.medication.posology.timesPerDay : null;

  return (
    <>
      <button type="button" className={`home-medication-quantity medication-stock-button${estimated && estimate.exhausted ? " is-exhausted" : ""}`} onClick={() => setOpen(true)} aria-label={`Ver estoque de ${item.name}: ${hasQuantity ? `${remainingLabel.toLocaleLowerCase("pt-BR")} ${formatQuantity(quantity, item.unit)} ${unitLabel(item.unit)}` : scheduled ? "saldo agendado" : "sem entrada"}${endLabel ? `. ${endLabel}` : ""}`} aria-haspopup="dialog">
        <span className="sr-only">Quantidade em estoque: </span>
        {hasQuantity && <span>{remainingLabel} </span>}
        <strong>{hasQuantity ? formatQuantity(quantity, item.unit) : "—"}</strong>
        <span>{hasQuantity ? unitLabel(item.unit, "short", quantity) : scheduled ? "saldo agendado" : "sem entrada"}</span>
        {endLabel && <small className="home-stock-deadline" title={endLabel}>{compactEndLabel}</small>}
        {!hasQuantity && scheduled && <small className="home-stock-scheduled">{formatQuantity(scheduled.quantity, item.unit)} {unitLabel(item.unit)} · {formatDate(scheduled.effectiveAt)}</small>}
      </button>
      {open && (
        <Modal title={`Estoque de ${item.name}`} onClose={() => setOpen(false)}>
          <div className="medication-stock-details">
            <p className="medication-stock-total">{hasQuantity && `${remainingLabel} `}<strong>{hasQuantity ? formatQuantity(quantity, item.unit) : "—"}</strong> {unitLabel(item.unit)}</p>
            {estimated ? <p>Estimativa pelos horários cadastrados. Não confirma que as doses foram administradas.</p> : <p>{estimate?.status === "unavailable" ? estimate.message : "Calculando estoque estimado..."}</p>}
            {!hasQuantity && scheduled && <p>Saldo agendado: {formatQuantity(scheduled.quantity, item.unit)} {unitLabel(item.unit)} em {formatDate(scheduled.effectiveAt)}. Não representa uma contagem atual.</p>}
            {hasQuantity && referenceAt && (
              <dl className="medication-summary">
                <div><dt>Saldo de referência</dt><dd>{formatQuantity(estimated ? estimate.referenceQuantity : item.total, item.unit)} {unitLabel(item.unit)}</dd></div>
                <div><dt>Data de referência · Recife</dt><dd><time dateTime={referenceAt}>{formatDate(referenceAt)}</time></dd></div>
                {estimated && <div className="summary-wide"><dt>{estimate.scheduledReference ? "Doses previstas até o saldo agendado (somadas ao saldo)" : "Consumo previsto desde a referência"}</dt><dd>{formatQuantity(estimate.consumed, item.unit)} {unitLabel(item.unit)} · {estimate.doses} {estimate.doses === 1 ? "tomada prevista" : "tomadas previstas"}</dd></div>}
                {consumption && !consumption.assumed && frequency && <div className="summary-wide"><dt>Consumo diário cadastrado</dt><dd>{formatQuantity(consumption.quantity * frequency, item.unit)} {unitLabel(item.unit)}/dia · {formatQuantity(consumption.quantity, item.unit)} por tomada</dd></div>}
              </dl>
            )}
            {estimated && forecast && <MedicationRestockStatus forecast={forecast} unit={item.unit} />}
            <p>Uma nova compra ou ajuste estabelece um novo saldo de referência. Medicamentos conforme necessidade não têm desconto automático.</p>
          </div>
        </Modal>
      )}
    </>
  );
}
