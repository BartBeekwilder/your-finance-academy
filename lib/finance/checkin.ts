// Check-ins: "my books are up to date through today". The user ticks a short
// checklist (expenses, income, account balances) once per period — daily,
// twice a week or weekly, on the weekdays they pick (Monday + Thursday
// and Monday by default) — and
// earns bonus points on top of the daily visit. A check-in also counts every
// day it covers as kept up (the Tracking ring, streaks, the calendar and the
// daily points): back to the day after the check-in before, or — the first
// time — to the 1st of that month. A check-in is stored as an
// achievement with code `checkin:YYYY-MM-DD` (its points with it), so it
// syncs and counts towards the level like any badge, with no table of its own.
// Pure (no imports), so it's tested with plain node and ported to the apps.

export type CheckinInterval = "daily" | "twice-weekly" | "weekly";
export const CHECKIN_POINTS = 15;
export const CHECKIN_PREFIX = "checkin:";

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The weekdays a check-in period starts on (0 = Sunday … 6 = Saturday).
 *  The user picks them; without a choice twice a week is Monday and
 *  Thursday, weekly Monday. */
export const DEFAULT_DAYS: Record<Exclude<CheckinInterval, "daily">, number[]> = { "twice-weekly": [1, 4], weekly: [1] };

/** The chosen start days for an interval — the right number of them
 *  (2 for twice a week, 1 for weekly), else the defaults. */
export function startDays(interval: CheckinInterval, days?: number[] | null): number[] {
  if (interval === "daily") return [];
  const want = interval === "twice-weekly" ? 2 : 1;
  const ok = [...new Set((days ?? []).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))];
  return ok.length === want ? ok.sort((a, b) => a - b) : DEFAULT_DAYS[interval];
}

/** The period `d` falls in: its first and last day. A period starts on one
 *  of the chosen weekdays and runs until the day before the next one. */
export function periodOf(d: Date, interval: CheckinInterval, days?: number[] | null) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (interval === "daily") return { start: day, end: day };
  const starts = startDays(interval, days);
  let back = 0;
  while (!starts.includes(addDays(day, -back).getDay())) back++;
  const start = addDays(day, -back);
  let ahead = 1;
  while (!starts.includes(addDays(start, ahead).getDay())) ahead++;
  return { start, end: addDays(start, ahead - 1) };
}

/** The days checked in, oldest first, from the achievement rows. */
export function checkinDays(achievements: { code: string; deleted_at?: string | null }[]) {
  return achievements
    .filter((a) => !a.deleted_at && a.code.startsWith(CHECKIN_PREFIX))
    .map((a) => a.code.slice(CHECKIN_PREFIX.length))
    .sort();
}

/** Where the check-ins stand on `today`: the last one, whether this period
 *  is done, and the run of periods in a row with one (the current period
 *  counts once done; until then the run up to the period before). */
export function checkinState(days: string[], today: Date, interval: CheckinInterval, weekdays?: number[] | null) {
  const last = days.length ? days[days.length - 1] : null;
  const keyOf = (d: Date) => dayKey(periodOf(d, interval, weekdays).start);
  const periods = new Set(days.map((k) => keyOf(parse(k))));
  const current = periodOf(today, interval, weekdays);
  const done = periods.has(dayKey(current.start));
  let streak = 0;
  let p = done ? current.start : addDays(current.start, -1);
  while (periods.has(keyOf(p))) {
    streak++;
    p = addDays(periodOf(p, interval, weekdays).start, -1);
  }
  return { last: last ? parse(last) : null, done, streak, period: current };
}

/** What changed since the last check-in, for the checklist's hints:
 *  expenses and income entered with a date after it. */
export function sinceLast(
  transactions: { type: string; date: string; deleted_at?: string | null }[],
  last: Date | null,
) {
  const from = last ? dayKey(last) : "";
  let expenses = 0, income = 0;
  for (const t of transactions) {
    if (t.deleted_at || t.date.slice(0, 10) <= from) continue;
    if (t.type === "expense") expenses++;
    else if (t.type === "income") income++;
  }
  return { expenses, income };
}

/** Every day the check-ins cover (see the top): `checkinDays` → day keys. */
export function coveredDays(days: string[]) {
  const out: string[] = [];
  let prev: Date | null = null;
  for (const key of days) {
    const end = parse(key);
    let d: Date = prev ? addDays(prev, 1) : new Date(end.getFullYear(), end.getMonth(), 1);
    // Never more than a month back, however long the gap.
    const floor = addDays(end, -30);
    if (d < floor) d = floor;
    for (; d <= end; d = addDays(d, 1)) out.push(dayKey(d));
    prev = end;
  }
  return out;
}

/** Days kept up (the Tracking ring, streaks, the calendar): the days the
 *  check-ins cover. Before the very first check-in, the days the app was
 *  used still count, so earlier history keeps its rings. */
export function trackedDays(activity: string[], checkins: string[]) {
  const first = checkins.length ? checkins[0] : null;
  const before = activity.map((d) => d.slice(0, 10)).filter((d) => first === null || d < first.slice(0, 8) + "01");
  return [...new Set([...before, ...coveredDays(checkins)])].sort();
}

/** The days still open on `today`: what a check-in through today would
 *  newly cover — from the day after the last check-in (the first time: the
 *  1st of this month), at most a month back. Oldest first. */
export function openDays(days: string[], today: Date) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const last = days.length ? parse(days[days.length - 1]) : null;
  let d = last ? addDays(last, 1) : new Date(end.getFullYear(), end.getMonth(), 1);
  const floor = addDays(end, -30);
  if (d < floor) d = floor;
  const out: string[] = [];
  for (; d <= end; d = addDays(d, 1)) out.push(dayKey(d));
  return out;
}
