"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, children, busy = false, fullscreen = false, compactHeader = false, closeLabel = "Fechar modal", onClose }: {
  title: string;
  children: ReactNode;
  busy?: boolean;
  fullscreen?: boolean;
  compactHeader?: boolean;
  closeLabel?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`record-modal${fullscreen ? " record-modal-fullscreen" : ""}`}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <div className={`modal-header${compactHeader ? " modal-header-compact" : ""}`}>
        <h2 id={titleId} className={compactHeader ? "sr-only" : undefined}>{title}</h2>
        <button className="modal-close" type="button" aria-label={closeLabel} disabled={busy} onClick={onClose}>
          <X aria-hidden="true" size={22} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
