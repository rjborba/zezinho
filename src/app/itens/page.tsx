import { Archive, ArchiveRestore, Boxes } from "lucide-react";

import { setItemArchivedAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ItemForm } from "@/components/item-form";
import { SetupNotice } from "@/components/setup-notice";
import { getInventory } from "@/lib/inventory";
import { unitLabel } from "@/lib/units";

export default async function ItemsPage() {
  const { items, archivedItems, configured, error } = await getInventory();

  return (
    <AppShell>
      <header className="page-header">
        <p className="eyebrow">Cadastro</p>
        <h1 className="page-title">Itens</h1>
      </header>

      {!configured && <SetupNotice />}
      {error && (
        <div className="notice notice-error" role="alert">
          Não foi possível carregar os itens.
        </div>
      )}

      <section className="form-card" id="novo-item" aria-labelledby="new-item-title">
        <div className="form-heading">
          <span className="form-icon">
            <Boxes aria-hidden="true" size={22} />
          </span>
          <div>
            <h2 id="new-item-title">Novo item</h2>
          </div>
        </div>
        <ItemForm disabled={!configured} />
      </section>

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
              <article className="simple-row" key={item.id}>
                <div className="item-avatar" aria-hidden="true">
                  {item.name.charAt(0).toLocaleUpperCase("pt-BR")}
                </div>
                <div>
                  <h3>{item.name}</h3>
                  <p>{unitLabel(item.unit, "long")}</p>
                </div>
                <form action={setItemArchivedAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="shouldArchive" value="true" />
                  <button
                    className="archive-button"
                    type="submit"
                    disabled={!configured}
                    aria-label={`Arquivar ${item.name}`}
                  >
                    <Archive aria-hidden="true" size={17} />
                    Arquivar
                  </button>
                </form>
              </article>
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
              <article className="simple-row" key={item.id}>
                <div className="item-avatar" aria-hidden="true">
                  {item.name.charAt(0).toLocaleUpperCase("pt-BR")}
                </div>
                <div>
                  <h3>{item.name}</h3>
                  <p>{unitLabel(item.unit, "long")}</p>
                </div>
                <form action={setItemArchivedAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="shouldArchive" value="false" />
                  <button
                    className="archive-button restore-button"
                    type="submit"
                    disabled={!configured}
                    aria-label={`Desarquivar ${item.name}`}
                  >
                    <ArchiveRestore aria-hidden="true" size={17} />
                    Desarquivar
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="list-placeholder">Nenhum item arquivado.</p>
        )}
      </section>
    </AppShell>
  );
}
