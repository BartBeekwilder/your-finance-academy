// The demo's time limit: a visitor gets DEMO_MINUTES to look around, then
// the demo closes with an invitation to create an account. The start is
// remembered in this browser (localStorage and a cookie — the earliest
// wins, so clearing one doesn't restart it) for DEMO_RESET_DAYS. Pure
// functions + a small storage layer, so iOS and Android can port it 1:1.
//
// Not a lock: a private window gets a fresh demo. It's there so the demo is
// a taste, not a free copy of the app to browse endlessly.

export const DEMO_MINUTES = 10;
export const DEMO_RESET_DAYS = 30;

const KEY = "pf-demo-start";
const COOKIE = "pf_demo";
const MINUTE = 60_000;
const DAY = 86_400_000;

/** Milliseconds left of a demo that started at `start` (0 = over). */
export function demoLeft(start: number, now: number, minutes = DEMO_MINUTES) {
  return Math.max(0, start + minutes * MINUTE - now);
}

/** A remembered start still counts (not older than the reset period, not in the future). */
export function demoStartValid(start: number | null, now: number, days = DEMO_RESET_DAYS): start is number {
  return start != null && Number.isFinite(start) && start <= now + MINUTE && now - start < days * DAY;
}

/** The earliest valid start among the remembered ones, else null. */
export function earliestStart(starts: (number | null)[], now: number) {
  const ok = starts.filter((s): s is number => demoStartValid(s, now));
  return ok.length ? Math.min(...ok) : null;
}

/** "9:05" for a number of milliseconds. */
export function clock(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// --- This browser ---

function readCookie(): number | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(\\d+)`));
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

function readStored(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function remember(start: number) {
  try {
    localStorage.setItem(KEY, String(start));
  } catch {}
  try {
    document.cookie = `${COOKIE}=${start}; path=/; max-age=${DEMO_RESET_DAYS * 86_400}; samesite=lax`;
  } catch {}
}

/** When this browser's demo started, or null if it hasn't (or long ago). */
export function demoStarted(now = Date.now()): number | null {
  const start = earliestStart([readStored(), readCookie()], now);
  if (start != null) remember(start); // both stores agree from here
  return start;
}

/** Starts the demo clock (keeps an earlier start). */
export function startDemoClock(now = Date.now()): number {
  const start = demoStarted(now) ?? now;
  remember(start);
  return start;
}

/** This browser has had its demo time. */
export const demoUsed = (now = Date.now()) => {
  const s = demoStarted(now);
  return s != null && demoLeft(s, now) === 0;
};
