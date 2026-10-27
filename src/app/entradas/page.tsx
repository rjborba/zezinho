import { History } from "lucide-react";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { EntryCreateDialog } from "@/components/entry-create-dialog";
import { EntryHistory } from "@/components/entry-history";
import { ScheduledEntryRefresh } from "@/components/scheduled-entry-refresh";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";

export default function EntriesPage() {
  return (
    <AppShell>
      <Suspense fallback={<p className="list-placeholder" role="status">Carregando entradas...</p>}>
        <EntriesContent />
      </Suspense>
    </AppShell>
  );
}

async function EntriesContent() {
  const { items, archivedItems, recentEntries, configured, error, nextScheduledEntryAt } =
    await getInventory();

  return (
    <>
      <ScheduledEntryRefresh at={nextScheduledEntryAt} />
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
        <p>Entradas futuras ficam agendadas e não alteram o estoque ou a previsão de medicamentos antes da data e hora escolhidas.</p>
        <p>Use “Ajustar estoque” para informar um saldo total, inclusive zero, sem registrar compra. Ajustes preservam o histórico e só passam a valer na data escolhida; intervalos que envolvem ajustes não entram na média de consumo.</p>
      </aside>

      <section aria-labelledby="history-title">
        <div className="section-heading">
          <div>
            <h2 id="history-title">Histórico e agendamentos</h2>
            <p>Compras e ajustes por data, incluindo agendamentos</p>
          </div>
          <History aria-hidden="true" size={21} />
        </div>

        <EntryHistory
          entries={recentEntries}
          items={[...items, ...archivedItems]}
        />
      </section>
    </>
  );
}
