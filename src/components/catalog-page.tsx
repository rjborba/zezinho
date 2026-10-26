import { Suspense } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CatalogList } from "@/components/catalog-list";
import { ItemCreateDialog } from "@/components/item-create-dialog";
import type { EditableItem } from "@/components/item-row";
import { ScheduledEntryRefresh } from "@/components/scheduled-entry-refresh";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";
import type { RecordKind } from "@/lib/types";

export function CatalogPage({ kind }: { kind: RecordKind }) {
  return (
    <AppShell>
      <Suspense fallback={<p className="list-placeholder" role="status">Carregando {kind === "medicamento" ? "medicamentos" : "itens"}...</p>}>
        <CatalogContent kind={kind} />
      </Suspense>
    </AppShell>
  );
}

async function CatalogContent({ kind }: { kind: RecordKind }) {
  const { items, archivedItems, configured, error, nextScheduledEntryAt } = await getInventory();
  const plural = kind === "medicamento" ? "medicamentos" : "itens";
  const catalogItems = (records: typeof items): EditableItem[] => records.filter((item) => item.kind === kind).map((item) => ({
    id: item.id, name: item.name, unit: item.unit, kind: item.kind, medication: item.medication,
    requiresSpecialControl: item.requiresSpecialControl,
    lastRestockedAt: item.lastRestockedAt, archivedAt: item.archivedAt,
  }));

  return (
    <>
      <ScheduledEntryRefresh at={nextScheduledEntryAt} />
      <header className="page-header page-header-with-action">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h1 className="page-title">{kind === "medicamento" ? "Medicamentos" : "Itens"}</h1>
          <p className="page-description">Cadastro de {plural}</p>
        </div>
        <div className="catalog-actions">
          {kind === "medicamento" && !error && items.some((item) => item.kind === "medicamento") && (
            <Link href="/medicamentos/imprimir" className="button button-secondary"><Printer size={18} aria-hidden="true" /> Imprimir A4</Link>
          )}
          <ItemCreateDialog kind={kind} disabled={!configured || error} />
        </div>
      </header>

      {!configured && <SetupNotice />}
      {error && (
        <div className="notice notice-error" role="alert">
          Não foi possível carregar os {plural}.
        </div>
      )}

      <CatalogList items={catalogItems(items)} archivedItems={catalogItems(archivedItems)} kind={kind} disabled={!configured} />
    </>
  );
}
