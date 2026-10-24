"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// How much the app moves — remembered per browser (Settings › Animations):
//   full   everything: tickers 12× a second, the drifting background, glows.
//   light  for a slower computer: tickers once a second, the background at a
//          low frame rate with fewer strokes, looping glows play once,
//          no backdrop blur (html[data-pf-motion="light"] in finance.css).
//   off    still: tickers stop, the background is one still frame, every CSS
//          animation is off (html[data-pf-motion="off"]).
// The background drift has its own switch (on by default).

export type MotionMode = "full" | "light" | "off";

const MODE = "pf-motion";
const OLD_PAUSED = "pf-motion-paused";
const LAST = "pf-motion-last";
const BACKGROUND = "pf-motion-background";
const listeners = new Set<() => void>();

function readMode(): MotionMode {
  try {
    const v = localStorage.getItem(MODE);
    if (v === "full" || v === "light" || v === "off") return v;
    return localStorage.getItem(OLD_PAUSED) === "1" ? "off" : "full";
  } catch {
    return "full";
  }
}

function readBackground() {
  try {
    return localStorage.getItem(BACKGROUND) !== "0";
  } catch {
    return true;
  }
}

const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function setMotionMode(mode: MotionMode) {
  try {
    const prev = readMode();
    if (prev !== "off") localStorage.setItem(LAST, prev);
    localStorage.setItem(MODE, mode);
    localStorage.removeItem(OLD_PAUSED);
  } catch {}
  notify();
}

export function setBackgroundMotion(on: boolean) {
  try {
    localStorage.setItem(BACKGROUND, on ? "1" : "0");
  } catch {}
  notify();
}

export const useMotionMode = () => useSyncExternalStore(subscribe, readMode, () => "full" as MotionMode);
export const useBackgroundMotion = () => useSyncExternalStore(subscribe, readBackground, () => true);

/** Paused = mode "off" (the sidebar's Pause button). */
export const useMotionPaused = () => useMotionMode() === "off";

/** Pause / resume: off, or back to the mode used before (full or light). */
export function setMotionPaused(paused: boolean) {
  if (paused) return setMotionMode("off");
  let last: MotionMode = "full";
  try {
    const v = localStorage.getItem(LAST);
    if (v === "light") last = "light";
  } catch {}
  setMotionMode(last);
}

/** The current time, re-read every `ms` — once a second at most in light
 *  mode, and not at all while motion is off, the tab is hidden, or when
 *  `enabled` is false (then it holds its last value). */
export function useNow(ms: number, enabled = true) {
  const mode = useMotionMode();
  const [now, setNow] = useState(() => Date.now());
  const every = mode === "light" ? Math.max(ms, 1000) : ms;
  useEffect(() => {
    if (mode === "off" || !enabled) return;
    const t = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, every);
    return () => clearInterval(t);
  }, [every, mode, enabled]);
  return now;
}

// Live amounts: how many decimals the tickers show (Settings › Animations).
//   2  cents only (once a second; a cent takes seconds to move)
//   3  cents + one small digit (twice a second) — default
//   4  cents + two small digits (5× a second)
//   5  cents + three small digits streaming (re-drawn 12× a second)
// Fewer decimals → the live tiles re-render far less often.
export type LiveDecimals = 2 | 3 | 4 | 5;
const DECIMALS = "pf-live-decimals";

function readDecimals(): LiveDecimals {
  try {
    const v = Number(localStorage.getItem(DECIMALS));
    return v === 2 || v === 4 || v === 5 ? v : 3;
  } catch {
    return 3;
  }
}

export function setLiveDecimals(d: LiveDecimals) {
  try {
    localStorage.setItem(DECIMALS, String(d));
  } catch {}
  notify();
}

export const useLiveDecimals = () => useSyncExternalStore(subscribe, readDecimals, () => 3 as LiveDecimals);

/** How often live amounts re-draw for a number of decimals. */
export const tickerMs = (d: LiveDecimals) => ({ 2: 1000, 3: 500, 4: 200, 5: 80 })[d];

/** The ticker clock for live amounts, as often as the decimals need. */
export function useTickerNow(enabled = true) {
  return useNow(tickerMs(useLiveDecimals()), enabled);
}
