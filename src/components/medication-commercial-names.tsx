import type { MedicationDetails } from "@/lib/types";

export function MedicationCommercialNames({ medication }: { medication: MedicationDetails }) {
  if (!medication.otherNames?.length) return null;
  return <p className="medication-commercial-names"><span className="sr-only">Nomes comerciais: </span>{medication.otherNames.join(" · ")}</p>;
}
