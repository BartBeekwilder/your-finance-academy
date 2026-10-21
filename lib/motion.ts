"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// A switch that pauses the dashboard's motion — for development on a slow
// machine. Paused, the live tickers stop updating, the background lines
// stop drawing and every CSS animation freezes (html[data-pf-paused] in
// finance.css). Everything else works as normal. Remembered per browser.

const KEY = "pf-motion-paused";
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setMotionPaused(paused: boolean) {
  try {
    if (paused) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

export function useMotionPaused() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => false,
  );
}

/** The current time, re-read every `ms` — except while motion is paused or
 *  the tab is hidden (then it holds its last value), or when `enabled` is false. */
export function useNow(ms: number, enabled = true) {
  const paused = useMotionPaused();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (paused || !enabled) return;
    const t = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, ms);
    return () => clearInterval(t);
  }, [ms, paused, enabled]);
  return now;
}
