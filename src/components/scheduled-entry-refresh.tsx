"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ScheduledEntryRefresh({ at }: { at: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!at) return;
    const timestamp = new Date(at).getTime();
    if (!Number.isFinite(timestamp)) return;
    let timer: ReturnType<typeof setTimeout>;
    let refreshed = false;
    function checkEntry() {
      clearTimeout(timer);
      if (refreshed) return;
      const delay = timestamp - Date.now();
      if (delay <= 0) {
        refreshed = true;
        router.refresh();
      } else {
        // Recheck long waits without exceeding the browser's timer limit.
        timer = setTimeout(checkEntry, Math.min(delay, 86_400_000));
      }
    }
    checkEntry();
    document.addEventListener("visibilitychange", checkEntry);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkEntry);
    };
  }, [at, router]);
  return null;
}
