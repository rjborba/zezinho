import { dosageLabel, periodLabel, posologyLabel, routeLabel } from "@/lib/medications";
import type { MedicationDetails } from "@/lib/types";

export function MedicationSummary({ medication }: { medication: MedicationDetails }) {
  return (
    <dl className="medication-summary">
      <div><dt>Dosagem</dt><dd>{dosageLabel(medication)}</dd></div>
      <div><dt>Via de administração</dt><dd>{routeLabel(medication)}</dd></div>
      <div className="summary-wide"><dt>Posologia</dt><dd>{posologyLabel(medication)}</dd></div>
      <div className="summary-wide"><dt>Período de uso</dt><dd>{periodLabel(medication)}</dd></div>
    </dl>
  );
}
