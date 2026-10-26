"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { ItemForm } from "@/components/item-form";
import { Modal } from "@/components/modal";
import type { RecordKind } from "@/lib/types";

export function ItemCreateDialog({ kind, disabled }: { kind: RecordKind; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="creation-control">
      <button id={kind === "medicamento" ? "novo-medicamento" : "novo-item"} className="button button-primary" type="button" disabled={disabled} onClick={() => { setMessage(""); setOpen(true); }}>
        <Plus aria-hidden="true" size={20} /> Adicionar
      </button>
      {message && <p className="form-message success creation-message" role="status"><Check aria-hidden="true" size={18} />{message}</p>}
      {open && (
        <Modal title={kind === "medicamento" ? "Novo medicamento" : "Novo item"} busy={busy} onClose={() => setOpen(false)}>
          <ItemForm kind={kind} disabled={disabled} onCancel={() => setOpen(false)} onPendingChange={setBusy} onSuccess={(result) => { setMessage(result); setOpen(false); }} />
        </Modal>
      )}
    </div>
  );
}
