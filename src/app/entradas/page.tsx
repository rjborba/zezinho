import { History } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EntryCreateDialog } from "@/components/entry-create-dialog";
import { EntryHistory } from "@/components/entry-history";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";

export default async function EntriesPage() {
  const { items, archivedItems, recentEntries, configured, error } =
    await getInventory();

  return (
    <AppShell>
      <header className="page-header page-header-with-action">
        <div>
          <p className="eyebrow">Movimentação</p>
          <h1 className="page-title">Entradas</h1>
        </div>
        <EntryCreateDialog items={items} disabled={!configured || error} />
      </header>

      {!configured && <SetupNotice />}
      {error && (
        <div className="notice notice-error" role="alert">
          Não foi possível carregar os dados.
        </div>
      )}

      <aside className="consumption-tip">
        <strong>Como calculamos o consumo?</strong>
        <p>
          Na próxima compra, o Zezinho compara o saldo anterior com o que ainda
          restou. Assim, estima quanto foi usado por dia nesse intervalo.
        </p>
        <p>A posologia dos medicamentos é apenas informativa e não dá baixa automática no estoque.</p>
      </aside>

      <section aria-labelledby="history-title">
        <div className="section-heading">
          <div>
            <h2 id="history-title">Últimas entradas</h2>
            <p>Movimentações mais recentes</p>
          </div>
          <History aria-hidden="true" size={21} />
        </div>

        <EntryHistory
          entries={recentEntries}
          items={[...items, ...archivedItems]}
        />
      </section>
    </AppShell>
  );
}
