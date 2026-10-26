"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/modal";

export function CalendarModal({ children, returnToPrevious = false }: {
  children: ReactNode;
  returnToPrevious?: boolean;
}) {
  const router = useRouter();

  return (
    <Modal
      title="Agenda de medicamentos"
      fullscreen
      compactHeader
      closeLabel="Fechar agenda"
      onClose={() => returnToPrevious ? router.back() : router.replace("/")}
    >
      <div className="calendar-modal-content">{children}</div>
    </Modal>
  );
}
