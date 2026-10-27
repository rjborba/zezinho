"use client";

import { MedicationCommercialNames } from "@/components/medication-commercial-names";
import { SpecialControlBadge } from "@/components/special-control-badge";
import { MedicationStockQuantity } from "@/components/medication-stock-quantity";
import { dosageLabel } from "@/lib/medications";
import { getMedicationRestockForecast, getMedicationStockEstimate, medicationStockUrgency } from "@/lib/medication-stock";
import type { InventoryItem } from "@/lib/types";
import { useCurrentTime } from "@/lib/use-current-time";

export function HomeMedicationStockList({ items }: { items: InventoryItem[] }) {
  const now = useCurrentTime();
  const date = now === null ? null : new Date(now);
  return (
    <>
      <div className="home-stock-legend" aria-label="Alertas de reposição">
        <span className="stock-urgency-week">Até 7 dias</span>
        <span className="stock-urgency-soon">Até 3 dias</span>
        <span className="stock-urgency-critical">Até 1 dia / esgotado</span>
      </div>
      <ul className="stock-list home-medication-stock" aria-label="Estoque de medicamentos">
        {items.map((item) => {
          const estimate = date ? getMedicationStockEstimate(item, date) : null;
          const forecast = date && estimate?.status === "estimated" ? getMedicationRestockForecast(item, date) : null;
          const urgency = medicationStockUrgency(forecast, estimate?.status === "estimated" && estimate.exhausted);
          return (
            <li className={`home-medication-row${urgency ? ` stock-urgency-${urgency}` : ""}`} key={item.id}>
              <div className="home-medication-info">
                <h3>
                  <span>{item.name}</span>
                  {item.medication && (
                    <span className="home-medication-dosage">
                      <span className="sr-only">Dosagem: </span>
                      {dosageLabel(item.medication)}
                    </span>
                  )}
                  <SpecialControlBadge required={item.requiresSpecialControl} />
                </h3>
                {item.medication && <MedicationCommercialNames medication={item.medication} />}
              </div>
              <MedicationStockQuantity item={item} estimate={estimate} forecast={forecast} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
