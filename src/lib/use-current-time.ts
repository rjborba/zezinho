"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let currentTime: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const getSnapshot = () => currentTime;
const getServerSnapshot = () => null;

function refresh() {
  currentTime = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    refresh();
    timer = setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== null) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    }
  };
}

export function useCurrentTime() {
  // The stable server snapshot keeps cached pages from freezing the clock.
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
