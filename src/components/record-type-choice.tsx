"use client";

import { Package, Pill } from "lucide-react";
import type { RecordKind } from "@/lib/types";

export function RecordTypeChoice({ onSelect }: { onSelect: (kind: RecordKind) => void }) {
  return (
    <div className="type-choice">
      <p>Primeiro, escolha o tipo:</p>
      <div className="type-options">
        <button className="type-option" type="button" onClick={() => onSelect("item")}>
          <Package aria-hidden="true" size={28} />
          <strong>Item</strong>
          <span>Produtos e materiais do dia a dia</span>
        </button>
        <button className="type-option" type="button" onClick={() => onSelect("medicamento")}>
          <Pill aria-hidden="true" size={28} />
          <strong>Medicamento</strong>
          <span>Dosagem, posologia e período de uso</span>
        </button>
      </div>
    </div>
  );
}
