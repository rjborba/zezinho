import { AppShell } from "@/components/app-shell";
import { ItemCreateDialog } from "@/components/item-create-dialog";
import { ItemRow } from "@/components/item-row";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";

export default async function ItemsPage() {
  const { items, archivedItems, configured, error } = await getInventory();

  return (
    <AppShell>
      <header className="page-header page-header-with-action">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h1 className="page-title">Itens</h1>
          <p className="page-description">Itens e medicamentos</p>
        </div>
        <ItemCreateDialog disabled={!configured || error} />
      </header>

      {!configured && <SetupNotice />}
      {error && (
        <div className="notice notice-error" role="alert">
          Não foi possível carregar os itens.
        </div>
      )}

      <section aria-labelledby="active-items-title">
        <div className="section-heading">
          <div>
            <h2 id="active-items-title">Não arquivados</h2>
            <p>{items.length === 1 ? "1 item" : `${items.length} itens`}</p>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="simple-list">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={{
                  id: item.id,
                  name: item.name,
                  unit: item.unit,
                  kind: item.kind,
                  medication: item.medication,
                  lastRestockedAt: item.lastRestockedAt,
                  archivedAt: item.archivedAt,
                }}
                disabled={!configured}
              />
            ))}
          </div>
        ) : (
          <p className="list-placeholder">Nenhum item não arquivado.</p>
        )}
      </section>

      <section aria-labelledby="archived-items-title">
        <div className="section-heading">
          <div>
            <h2 id="archived-items-title">Arquivados</h2>
            <p>
              {archivedItems.length === 1
                ? "1 item"
                : `${archivedItems.length} itens`}
            </p>
          </div>
        </div>

        {archivedItems.length > 0 ? (
          <div className="simple-list archived-list">
            {archivedItems.map((item) => (
              <ItemRow
                key={item.id}
                item={{
                  id: item.id,
                  name: item.name,
                  unit: item.unit,
                  kind: item.kind,
                  medication: item.medication,
                  lastRestockedAt: item.lastRestockedAt,
                  archivedAt: item.archivedAt,
                }}
                disabled={!configured}
              />
            ))}
          </div>
        ) : (
          <p className="list-placeholder">Nenhum item arquivado.</p>
        )}
      </section>
    </AppShell>
  );
}
