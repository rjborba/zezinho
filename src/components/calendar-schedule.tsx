import { Suspense } from "react";

import { MedicationCalendar } from "@/components/medication-calendar";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";

export function CalendarSchedule() {
  return (
    <Suspense fallback={<div className="calendar-loading" role="status">Carregando agenda...</div>}>
      <CalendarData />
    </Suspense>
  );
}

async function CalendarData() {
  const { items, configured, error } = await getInventory();
  const medications = items.filter((item) => item.kind === "medicamento").map(({ id, name, kind, medication, requiresSpecialControl, archivedAt }) => ({
    id, name, kind, medication, requiresSpecialControl, archivedAt,
  }));

  return (
    <>
      {!configured && <SetupNotice />}
      {error ? (
        <div className="notice notice-error" role="alert">
          Não foi possível carregar os medicamentos. Atualize a página para tentar novamente.
        </div>
      ) : (
        <MedicationCalendar items={medications} />
      )}
    </>
  );
}
