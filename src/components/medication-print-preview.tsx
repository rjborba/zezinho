"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

import styles from "./medication-print.module.css";

export function MedicationPrintPreview({ children }: { children: ReactNode }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ scale: 1, previewScale: 1, ready: false });

  useEffect(() => {
    const preview = previewRef.current;
    const paper = paperRef.current;
    const sheet = sheetRef.current;
    const content = contentRef.current;
    if (!preview || !paper || !sheet || !content) return;
    let active = true;

    const fit = () => {
      // Keep the measured screen layout stable while the browser paginates it.
      if (!active || window.matchMedia("print").matches) return;
      // Absolute positioning keeps the unscaled content from creating extra pages.
      // Leave room for per-row rounding differences in the browser's PDF layout.
      const availableHeight = sheet.clientHeight - 24;
      const fits = (scale: number) => {
        // Widen before scaling so the table still fills the printable width.
        content.style.width = `${sheet.clientWidth / scale}px`;
        return content.scrollHeight * scale <= availableHeight;
      };
      let scale = 1;
      if (!fits(scale)) {
        let low = 0;
        let high = 1;
        for (let step = 0; step < 12; step++) {
          const candidate = (low + high) / 2;
          if (fits(candidate)) low = candidate;
          else high = candidate;
        }
        scale = low || 1 / 4096;
      }
      content.style.width = `${sheet.clientWidth / scale}px`;
      const previewScale = Math.min(1, preview.clientWidth / paper.offsetWidth);
      content.style.transform = `scale(${scale})`;
      setLayout((previous) => previous.ready && previous.scale === scale && previous.previewScale === previewScale
        ? previous : { scale, previewScale, ready: true });
    };

    const observer = new ResizeObserver(fit);
    observer.observe(preview);
    observer.observe(content);
    void document.fonts.ready.then(fit);
    window.addEventListener("afterprint", fit);
    return () => { active = false; observer.disconnect(); window.removeEventListener("afterprint", fit); };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <Link href="/medicamentos" className={styles.back}><ArrowLeft size={18} aria-hidden="true" /> Medicamentos</Link>
        <div className={styles.actions}>
          <p>Uma folha A4 · Todos os medicamentos ativos</p>
          <button type="button" className="button button-primary" disabled={!layout.ready} onClick={() => window.print()}><Printer size={18} aria-hidden="true" /> Imprimir / Salvar PDF</button>
        </div>
        <p className={styles.hint}>Na impressão, use papel A4, escala de 100% e desative cabeçalhos e rodapés do navegador.</p>
        {layout.ready && layout.scale < 0.75 && <p className={styles.hint} role="status">A lista foi reduzida para caber em uma folha. Confira se o texto está legível antes de imprimir.</p>}
      </div>
      <div ref={previewRef} className={styles.preview} style={{ "--preview-scale": layout.previewScale } as CSSProperties} aria-label="Prévia de impressão em uma folha A4">
        <div ref={paperRef} className={styles.paper}>
          <div ref={sheetRef} className={styles.sheet}>
            <div ref={contentRef} className={styles.content} style={{ "--content-scale": layout.scale } as CSSProperties}>{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
