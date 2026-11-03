// Check-ins: "my books are up to date through today". The user ticks a short
// checklist (expenses, income, account balances) once per period — daily,
// twice a week (Mon–Wed, Thu–Sun) or weekly (Mon–Sun), their choice — and
// earns bonus points on top of the daily visit. A check-in is stored as an
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

/** The period `d` falls in: its first and last day. Weeks start on Monday. */
export function periodOf(d: Date, interval: CheckinInterval) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (interval === "daily") return { start: day, end: day };
  const monday = addDays(day, -((day.getDay() + 6) % 7));
  if (interval === "weekly") return { start: monday, end: addDays(monday, 6) };
  // Twice a week: Monday–Wednesday, Thursday–Sunday.
  const thursday = addDays(monday, 3);
  return day < thursday ? { start: monday, end: addDays(monday, 2) } : { start: thursday, end: addDays(monday, 6) };
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
export function checkinState(days: string[], today: Date, interval: CheckinInterval) {
  const last = days.length ? days[days.length - 1] : null;
  const keyOf = (d: Date) => dayKey(periodOf(d, interval).start);
  const periods = new Set(days.map((k) => keyOf(parse(k))));
  const current = periodOf(today, interval);
  const done = periods.has(dayKey(current.start));
  let streak = 0;
  let p = done ? current.start : addDays(current.start, -1);
  while (periods.has(keyOf(p))) {
    streak++;
    p = addDays(periodOf(p, interval).start, -1);
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
