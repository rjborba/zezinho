import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, PackagePlus, Pill, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { HomeMedicationStockList } from "@/components/home-medication-stock-list";
import { ScheduledEntryRefresh } from "@/components/scheduled-entry-refresh";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";
import { medicationTitle } from "@/lib/medications";
import { formatDateOnly, formatQuantity, unitLabel } from "@/lib/units";

export default function Home() {
  return (
    <AppShell>
      <Suspense fallback={<p className="list-placeholder" role="status">Carregando estoque...</p>}>
        <HomeContent />
      </Suspense>
    </AppShell>
  );
}

async function HomeContent() {
  const { items, configured, error, nextScheduledEntryAt } = await getInventory();
  const stockSections = [
    {
      id: "medications-stock-title",
      title: "Medicamentos",
      singular: "medicamento",
      href: "/medicamentos",
      createHref: "/medicamentos#novo-medicamento",
      items: items.filter((item) => item.kind === "medicamento"),
    },
    {
      id: "items-stock-title",
      title: "Itens",
      singular: "item",
      href: "/itens",
      createHref: "/itens#novo-item",
      items: items.filter((item) => item.kind === "item"),
    },
  ];

  return (
    <>
      <ScheduledEntryRefresh at={nextScheduledEntryAt} />
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

      {stockSections.map((section) => (
        <section aria-labelledby={section.id} key={section.id}>
          <div className="section-heading">
            <div>
              <h2 id={section.id}>{section.title}</h2>
              <p>{section.singular === "medicamento" ? "Saldo estimado e previsão de reposição · toque no saldo para detalhes" : "Compra mais recente + o que ainda restava"}</p>
            </div>
            <Link
              href={section.href}
              aria-label={`Ver cadastro de ${section.title.toLocaleLowerCase("pt-BR")}`}
            >
              Ver cadastro
            </Link>
          </div>

          {section.items.length > 0 ? (
            section.singular === "medicamento" ? (
              <HomeMedicationStockList items={section.items} />
            ) : (
              <div className="stock-list">
                {section.items.map((item) => (
                  <article className="stock-row" key={item.id}>
                    <div className="item-avatar" aria-hidden="true">
                      {item.name.charAt(0).toLocaleUpperCase("pt-BR")}
                    </div>
                    <div className="stock-info">
                      <h3>{medicationTitle(item.name, item.medication)}</h3>
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
            )
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                {section.singular === "medicamento" ? (
                  <Pill aria-hidden="true" size={24} />
                ) : (
                  <Sparkles aria-hidden="true" size={24} />
                )}
              </span>
              <h3>Comece cadastrando um {section.singular}</h3>
              <p>
                Cadastre o primeiro {section.singular} para depois registrar as
                entradas.
              </p>
              <Link className="button button-secondary" href={section.createHref}>
                Cadastrar primeiro {section.singular}
              </Link>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
