import type { Metadata } from "next";
import { CalendarModal } from "@/components/calendar-modal";
import { CalendarSchedule } from "@/components/calendar-schedule";

export const metadata: Metadata = { title: "Agenda de medicamentos" };

export default function CalendarPage() {
  return (
    <CalendarModal>
      <CalendarSchedule />
    </CalendarModal>
  );
}
