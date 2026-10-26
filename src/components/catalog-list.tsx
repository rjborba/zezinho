"use client";

import { useId, useState } from "react";
import { Archive } from "lucide-react";

import { ItemRow, type EditableItem } from "@/components/item-row";
import { Modal } from "@/components/modal";
import { matchesCatalogSearch } from "@/lib/catalog-search";
import type { RecordKind } from "@/lib/types";

export function CatalogList({ items, archivedItems, kind, disabled }: {
  items: EditableItem[];
  archivedItems: EditableItem[];
  kind: RecordKind;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const searchId = useId();
  const singular = kind === "medicamento" ? "medicamento" : "item";
  const plural = kind === "medicamento" ? "medicamentos" : "itens";
  const titleId = `active-${plural}-title`;
  const filteredItems = items.filter((item) => matchesCatalogSearch(item, query));

  return (
    <>
      <section aria-labelledby={titleId}>
        <div className="section-heading catalog-heading">
          <div>
            <h2 id={titleId}>Ativos</h2>
            <p role="status">{filteredItems.length} {filteredItems.length === 1 ? singular : plural}</p>
          </div>
          <button
            className="archive-button catalog-archive-button"
            type="button"
            aria-haspopup="dialog"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive aria-hidden="true" size={17} />
            Arquivados ({archivedItems.length})
          </button>
        </div>
        {kind === "medicamento" && (
          <div className="field-group catalog-search">
            <label htmlFor={searchId}>Buscar medicamento ativo</label>
            <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Princípio ativo ou nome comercial" />
          </div>
        )}
        {filteredItems.length > 0 ? (
          <div className="simple-list">
            {filteredItems.map((item) => <ItemRow key={item.id} item={item} disabled={disabled} />)}
          </div>
        ) : (
          <p className="list-placeholder">{query.trim() ? `Nenhum ${singular} ativo encontrado.` : `Nenhum ${singular} ativo.`}</p>
        )}
      </section>
      {archiveOpen && (
        <ArchivedCatalog items={archivedItems} kind={kind} disabled={disabled} onClose={() => setArchiveOpen(false)} />
      )}
    </>
  );
}

function ArchivedCatalog({ items, kind, disabled, onClose }: {
  items: EditableItem[];
  kind: RecordKind;
  disabled: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const singular = kind === "medicamento" ? "medicamento" : "item";
  const plural = kind === "medicamento" ? "medicamentos" : "itens";
  const filteredItems = items.filter((item) => matchesCatalogSearch(item, query));

  return (
    <Modal title={kind === "medicamento" ? "Medicamentos arquivados" : "Itens arquivados"} onClose={onClose}>
      <p className="catalog-archive-description">
        Os {plural} arquivados ficam fora da lista de ativos. Desarquive para voltar à lista.
      </p>
      <div className="field-group catalog-search">
        <label htmlFor={searchId}>Buscar {singular} arquivado</label>
        <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kind === "medicamento" ? "Princípio ativo ou nome comercial" : "Nome do item"} />
      </div>
      <p className="catalog-archive-count" role="status">{filteredItems.length} {filteredItems.length === 1 ? `${singular} arquivado` : `${plural} arquivados`}</p>
      {filteredItems.length > 0 ? (
        <div className="simple-list archived-list">
          {filteredItems.map((item) => <ItemRow key={item.id} item={item} disabled={disabled} />)}
        </div>
      ) : (
        <p className="list-placeholder">{query.trim() ? `Nenhum ${singular} arquivado encontrado.` : `Nenhum ${singular} arquivado.`}</p>
      )}
    </Modal>
  );
}
