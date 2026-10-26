import { Suspense } from "react";
import Link from "next/link";

import { MedicationPrintPreview } from "@/components/medication-print-preview";
import { MedicationPrintSheet } from "@/components/medication-print-sheet";
import { getInventory } from "@/lib/inventory";
import { medicationPrintRows } from "@/lib/medication-print";

export default function MedicationPrintPage() {
  return <Suspense fallback={<p className="list-placeholder" role="status">Preparando impressão...</p>}><PrintContent /></Suspense>;
}

async function PrintContent() {
  const { items, error } = await getInventory();
  if (error || !medicationPrintRows(items).length) {
    return (
      <main className="page-content">
        <h1 className="page-title">Imprimir medicamentos</h1>
        <p className="notice" role={error ? "alert" : "status"}>{error ? "Não foi possível carregar os medicamentos. Atualize a página para tentar novamente." : "Nenhum medicamento ativo para imprimir."}</p>
        <Link href="/medicamentos" className="button button-secondary">Voltar para Medicamentos</Link>
      </main>
    );
  }
  return <MedicationPrintPreview><MedicationPrintSheet items={items} generatedAt={new Date().toISOString()} /></MedicationPrintPreview>;
}
