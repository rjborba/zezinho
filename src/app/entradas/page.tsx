import Link from "next/link";
import { ArrowRight, History, PackagePlus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EntryForm } from "@/components/entry-form";
import { EntryHistory } from "@/components/entry-history";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";

export default async function EntriesPage() {
  const { items, archivedItems, recentEntries, configured, error } =
    await getInventory();

  return (
    <AppShell>
      <header className="page-header">
        <p className="eyebrow">Movimentação</p>
        <h1 className="page-title">Nova entrada</h1>
      </header>

      {!configured && <SetupNotice />}
      {error && (
        <div className="notice notice-error" role="alert">
          Não foi possível carregar os dados.
        </div>
      )}

      <section className="form-card" aria-labelledby="new-entry-title">
        <div className="form-heading">
          <span className="form-icon">
            <PackagePlus aria-hidden="true" size={22} />
          </span>
          <div>
            <h2 id="new-entry-title">Registrar entrada</h2>
            <p>Informe a compra e quanto ainda restava.</p>
          </div>
        </div>

        {items.length > 0 ? (
          <EntryForm items={items} disabled={!configured} />
        ) : (
          <div className="no-items-card">
            <p>Cadastre um item antes de registrar uma entrada.</p>
            <Link href="/itens#novo-item">
              Cadastrar item <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        )}
      </section>

      <aside className="consumption-tip">
        <strong>Como calculamos o consumo?</strong>
        <p>
          Na próxima compra, o Zezinho compara o saldo anterior com o que ainda
          restou. Assim, estima quanto foi usado por dia nesse intervalo.
        </p>
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
