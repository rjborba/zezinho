"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, ArchiveRestore, LoaderCircle, Pencil, Pill } from "lucide-react";

import { setItemArchivedAction } from "@/app/actions";
import { ItemForm } from "@/components/item-form";
import { MedicationSummary } from "@/components/medication-summary";
import type { InventoryItem } from "@/lib/types";
import { formatDateOnly, unitLabel } from "@/lib/units";

type EditableItem = Pick<
  InventoryItem,
  "id" | "name" | "unit" | "kind" | "medication" | "lastRestockedAt" | "archivedAt"
>;

function ArchiveButton({
  item,
  disabled,
}: {
  item: EditableItem;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  const archived = item.archivedAt !== null;
  const Icon = archived ? ArchiveRestore : Archive;
  const label = archived ? "Desarquivar" : "Arquivar";

  return (
    <button
      className={`archive-button${archived ? " restore-button" : ""}`}
      type="submit"
      disabled={disabled || pending}
      aria-label={`${label} ${item.name}`}
    >
      {pending ? (
        <LoaderCircle className="spin" aria-hidden="true" size={17} />
      ) : (
        <Icon aria-hidden="true" size={17} />
      )}
      {label}
    </button>
  );
}

export function ItemRow({
  item,
  disabled = false,
}: {
  item: EditableItem;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const editId = `edit-item-${item.id}`;

  return (
    <article className="item-card">
      <div className="simple-row item-row">
        <div className="item-avatar" aria-hidden="true">
          {item.kind === "medicamento" ? <Pill size={22} /> : item.name.charAt(0).toLocaleUpperCase("pt-BR")}
        </div>
        <div>
          <h3>{item.name}</h3>
          {item.kind === "medicamento" && <span className="medication-badge">Medicamento</span>}
          <p>
            {unitLabel(item.unit, "long")} · {" "}
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
        </div>
        <div className="item-row-actions">
          <button
            className="archive-button"
            type="button"
            disabled={disabled || editing}
            aria-label={`Editar ${item.name}`}
            aria-expanded={editing}
            aria-controls={editId}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden="true" size={17} />
            Editar
          </button>
          <form action={setItemArchivedAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input
              type="hidden"
              name="shouldArchive"
              value={String(item.archivedAt === null)}
            />
            <ArchiveButton item={item} disabled={disabled || editing} />
          </form>
        </div>
      </div>
      {item.medication && !editing && <div className="item-medication-details"><MedicationSummary medication={item.medication} /></div>}
      {editing && (
        <div id={editId}>
          <ItemForm
            item={item}
            disabled={disabled}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </article>
  );
}
