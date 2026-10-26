import { MedicationCommercialNames } from "@/components/medication-commercial-names";
import { SpecialControlBadge } from "@/components/special-control-badge";
import { dosageLabel } from "@/lib/medications";
import type { InventoryItem } from "@/lib/types";
import { formatQuantity, unitLabel } from "@/lib/units";

export function HomeMedicationStockList({ items }: { items: InventoryItem[] }) {
  return (
    <ul className="stock-list home-medication-stock" aria-label="Estoque de medicamentos">
      {items.map((item) => (
        <li className="home-medication-row" key={item.id}>
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
          <p className="home-medication-quantity">
            <span className="sr-only">Quantidade em estoque: </span>
            <strong>{item.hasEntries ? formatQuantity(item.total, item.unit) : "—"}</strong>
            <span className={item.hasEntries ? "" : "home-medication-no-entry"}>
              {item.hasEntries ? unitLabel(item.unit, "short", item.total) : "sem entrada"}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}
