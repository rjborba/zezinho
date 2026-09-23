import Link from "next/link";
import { ArrowRight, PackagePlus, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";
import { formatDateOnly, formatQuantity, unitLabel } from "@/lib/units";

export default async function Home() {
  const { items, configured, error } = await getInventory();

  return (
    <AppShell>
      {!configured && <SetupNotice />}
      {error && (
        <div className="notice notice-error" role="alert">
          Não foi possível carregar o estoque agora. Tente novamente em alguns
          instantes.
        </div>
      )}

      <section aria-labelledby="quick-actions-title">
        <div className="section-heading">
          <h2 id="quick-actions-title">Ações rápidas</h2>
        </div>
        <div className="quick-grid quick-grid-single">
          <Link className="quick-action quick-action-primary" href="/entradas">
            <span className="quick-icon">
              <PackagePlus aria-hidden="true" size={24} strokeWidth={2.2} />
            </span>
            <span>
              <strong>Registrar entrada</strong>
              <small>Adicionar ao estoque</small>
            </span>
            <ArrowRight aria-hidden="true" size={20} />
          </Link>

        </div>
      </section>

      <section aria-labelledby="stock-title">
        <div className="section-heading">
          <div>
            <h2 id="stock-title">Última reposição</h2>
            <p>Compra mais recente + o que ainda restava</p>
          </div>
          <Link href="/itens">Ver itens</Link>
        </div>

        {items.length > 0 ? (
          <div className="stock-list">
            {items.map((item) => (
              <article className="stock-row" key={item.id}>
                <div className="item-avatar" aria-hidden="true">
                  {item.name.charAt(0).toLocaleUpperCase("pt-BR")}
                </div>
                <div className="stock-info">
                  <h3>{item.name}</h3>
                  <p>
                    {item.lastRestockedAt ? (
                      <>
                        Última reposição: {" "}
                        <time dateTime={item.lastRestockedAt}>
                          {formatDateOnly(item.lastRestockedAt)}
                        </time>
                      </>
                    ) : (
                      "Sem reposição"
                    )}
                  </p>
                  <p>
                    {item.averagePerDay !== null
                      ? `Consumo médio: ${formatQuantity(item.averagePerDay, item.unit)} ${unitLabel(item.unit, "short", item.averagePerDay)}/dia`
                      : "Média disponível após a próxima compra"}
                  </p>
                </div>
                <p className="stock-value">
                  <strong>
                    {item.hasEntries ? formatQuantity(item.total, item.unit) : "—"}
                  </strong>
                  <span>
                    {item.hasEntries
                      ? unitLabel(item.unit, "short", item.total)
                      : "sem entrada"}
                  </span>
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Sparkles aria-hidden="true" size={24} />
            </span>
            <h3>Comece cadastrando um item</h3>
            <p>Cadastre o primeiro item para depois registrar as entradas.</p>
            <Link className="button button-secondary" href="/itens#novo-item">
              Cadastrar primeiro item
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
