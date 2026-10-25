import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { MedicationCalendar } from "@/components/medication-calendar";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";

export const metadata: Metadata = { title: "Agenda de medicamentos" };

export default async function CalendarPage() {
  const { items, configured, error } = await getInventory();
  const medications = items.filter((item) => item.kind === "medicamento").map(({ id, name, kind, medication, archivedAt }) => ({
    id, name, kind, medication, archivedAt,
  }));

  return (
    <AppShell wide>
      <header className="page-header">
        <p className="eyebrow">Sua rotina</p>
        <h1 className="page-title">Agenda de medicamentos</h1>
        <p className="page-subtitle">Os horários de cada cuidado, em um só lugar.</p>
      </header>
      {!configured && <SetupNotice />}
      {error ? (
        <div className="notice notice-error" role="alert">
          Não foi possível carregar os medicamentos. Atualize a página para tentar novamente.
        </div>
      ) : (
        <MedicationCalendar items={medications} />
      )}
    </AppShell>
  );
}
