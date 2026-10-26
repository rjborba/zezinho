import { Clock3, Pill } from "lucide-react";

import { SpecialControlBadge } from "@/components/special-control-badge";
import { medicationPrintGroups, medicationPrintRows, type PrintableMedication } from "@/lib/medication-print";
import { formatDate } from "@/lib/units";

import styles from "./medication-print.module.css";

export function MedicationPrintSheet({ items, generatedAt }: { items: PrintableMedication[]; generatedAt: string }) {
  const rows = medicationPrintRows(items);
  const groups = medicationPrintGroups(items);

  return (
    <>
      <header className={styles.sheetHeader}>
        <div className={styles.sheetBrand}><Pill size={16} aria-hidden="true" /> Zezinho <span>Rotina de cuidados</span></div>
        <div className={styles.sheetTitle}>
          <h1>Medicamentos por horário</h1>
          <span>{rows.length} {rows.length === 1 ? "medicamento" : "medicamentos"}</span>
        </div>
        <p>Horários de Recife <span>·</span> Atualizado em {formatDate(generatedAt)}</p>
      </header>
      <div className={styles.columnLabels} aria-hidden="true"><span>Medicamento · nome comercial · dosagem</span><span>Como tomar · posologia e orientações</span></div>
      {groups.map((group) => (
        <section className={styles.timeGroup} key={group.time} aria-label={group.time || "Sem horário definido"}>
          <header className={styles.groupHeader}>
            <h2><Clock3 size={15} aria-hidden="true" />{group.time || "Sem horário definido"}</h2>
            <span>{group.rows.length} {group.rows.length === 1 ? "medicamento" : "medicamentos"}</span>
          </header>
          <table className={styles.table}>
            <caption className="sr-only">Medicamentos {group.time ? `às ${group.time}` : "sem horário definido"}</caption>
            <colgroup><col className={styles.nameColumn} /><col className={styles.instructionsColumn} /></colgroup>
            <thead className="sr-only"><tr><th scope="col">Medicamento e dosagem</th><th scope="col">Como tomar</th></tr></thead>
            <tbody>
              {group.rows.map((row, index) => (
                <tr key={`${row.id}-${index}`}>
                  <th scope="row">
                    <strong className={styles.medicationName}>{row.name}</strong>
                    <span className={styles.dosage}>{row.dosage}</span>
                    <span className={styles.commercialNames}>{row.commercialNames === "Não informado" ? "Nome comercial não informado" : row.commercialNames}</span>
                    <SpecialControlBadge required={row.requiresSpecialControl} className={styles.specialControlBadge} />
                  </th>
                  <td>
                    <div className={styles.doseDetails}>{row.amountPerDose && <strong>{row.amountPerDose}</strong>}<span>Via: {row.route}</span></div>
                    <span className={styles.posology}>{row.posology}</span>
                    {row.instructions && <span className={styles.instructions}>{row.instructions}</span>}
                    {row.timingNote && row.timingNote !== "Sem horário fixo" && <span className={styles.timingNote}>{row.timingNote === "Não informado" ? "Horário não informado" : row.timingNote}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <footer className={styles.sheetFooter}><span>Zezinho · Plano de medicamentos</span><span>Orientações conforme cadastradas</span></footer>
    </>
  );
}
