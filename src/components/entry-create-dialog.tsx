"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, SlidersHorizontal } from "lucide-react";
import { EntryForm } from "@/components/entry-form";
import { Modal } from "@/components/modal";
import { RecordTypeChoice } from "@/components/record-type-choice";
import type { InventoryItem, RecordKind, StockEntryType } from "@/lib/types";

export function EntryCreateDialog({ items, disabled }: { items: InventoryItem[]; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [entryType, setEntryType] = useState<StockEntryType>("purchase");
  const [kind, setKind] = useState<RecordKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const availableItems = items.filter((item) => item.kind === kind && !item.archivedAt);

  return (
    <div className="creation-control">
      <div className="stock-movement-actions">
        <button className="button button-primary" type="button" disabled={disabled} onClick={() => { setEntryType("purchase"); setKind(null); setMessage(""); setOpen(true); }}>
          <Plus aria-hidden="true" size={20} /> Nova entrada
        </button>
        <button className="button button-secondary" type="button" disabled={disabled} onClick={() => { setEntryType("adjustment"); setKind(null); setMessage(""); setOpen(true); }}>
          <SlidersHorizontal aria-hidden="true" size={18} /> Ajustar estoque
        </button>
      </div>
      {message && <p className="form-message success creation-message" role="status"><Check aria-hidden="true" size={18} />{message}</p>}
      {open && (
        <Modal title={entryType === "adjustment" ? "Ajustar estoque" : kind === "medicamento" ? "Entrada de medicamento" : kind === "item" ? "Entrada de item" : "Nova entrada"} busy={busy} onClose={() => setOpen(false)}>
          {kind ? (
            <>
              <button className="modal-back" type="button" disabled={busy} onClick={() => setKind(null)}><ArrowLeft aria-hidden="true" size={18} /> Alterar tipo</button>
              {availableItems.length ? (
                <EntryForm key={`${kind}-${entryType}`} kind={kind} entryType={entryType} items={availableItems} disabled={disabled} onCancel={() => setOpen(false)} onPendingChange={setBusy} onSuccess={(result) => { setMessage(result); setOpen(false); }} />
              ) : (
                <div className="no-items-card">
                  <p>{kind === "medicamento" ? "Cadastre ou desarquive um medicamento antes de registrar uma entrada." : "Cadastre ou desarquive um item antes de registrar uma entrada."}</p>
                  <Link href={kind === "medicamento" ? "/medicamentos#novo-medicamento" : "/itens#novo-item"} onClick={() => setOpen(false)}>Ir para o cadastro <ArrowRight aria-hidden="true" size={18} /></Link>
                </div>
              )}
            </>
          ) : <RecordTypeChoice onSelect={setKind} />}
        </Modal>
      )}
    </div>
  );
}
