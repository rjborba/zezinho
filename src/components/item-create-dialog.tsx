"use client";

import { useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { ItemForm } from "@/components/item-form";
import { Modal } from "@/components/modal";
import { RecordTypeChoice } from "@/components/record-type-choice";
import type { RecordKind } from "@/lib/types";

export function ItemCreateDialog({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RecordKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="creation-control">
      <button id="novo-item" className="button button-primary" type="button" disabled={disabled} onClick={() => { setKind(null); setMessage(""); setOpen(true); }}>
        <Plus aria-hidden="true" size={20} /> Adicionar
      </button>
      {message && <p className="form-message success creation-message" role="status"><Check aria-hidden="true" size={18} />{message}</p>}
      {open && (
        <Modal title={kind === "medicamento" ? "Novo medicamento" : kind === "item" ? "Novo item" : "Adicionar ao cadastro"} busy={busy} onClose={() => setOpen(false)}>
          {kind ? (
            <>
              <button className="modal-back" type="button" disabled={busy} onClick={() => setKind(null)}><ArrowLeft aria-hidden="true" size={18} /> Alterar tipo</button>
              <ItemForm key={kind} kind={kind} disabled={disabled} onCancel={() => setOpen(false)} onPendingChange={setBusy} onSuccess={(result) => { setMessage(result); setOpen(false); }} />
            </>
          ) : <RecordTypeChoice onSelect={setKind} />}
        </Modal>
      )}
    </div>
  );
}
