// Daily rings for the activity calendar — the month's three rings, day by
// day, like a watch's activity history:
//   tracking — the books were updated that day (full or empty);
//   budget   — spending so far this month within the allowance so far
//              (full while on track; less full the further over);
//   saving   — saved so far against the savings target so far (a second
//              lap past it).
// And the streaks around them. Pure (types only), so it's tested with plain
// node and ported to the apps.

import type { Transaction } from "./types";

export type DayRing = { day: number; date: Date; tracking: number; budget: number | null; saving: number | null; future: boolean; perfect: boolean };

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function dayRings({
  transactions,
  activeDays,
  month,
  today,
  allowance,
  savingsTarget,
}: {
  transactions: Pick<Transaction, "type" | "amount" | "date" | "is_fixed_expense" | "deleted_at">[];
  activeDays: string[];
  month: Date;
  today: Date;
  /** Variable spending allowed for the whole month (0 = no budget ring). */
  allowance: number;
  /** What the month should save (0 = no saving ring). */
  savingsTarget: number;
}): DayRing[] {
  const y = month.getFullYear(), m = month.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const active = new Set(activeDays.map((d) => d.slice(0, 10)));
  const spent = Array.from({ length: days }, () => 0), saved = Array.from({ length: days }, () => 0);
  for (const t of transactions) {
    if (t.deleted_at) continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    const a = Number(t.amount), i = d.getDate() - 1;
    if (t.type === "income") saved[i] += a;
    else {
      saved[i] -= a;
      if (!t.is_fixed_expense) spent[i] += a;
    }
  }
  const todayKey = key(today);
  let cumSpent = 0, cumSaved = 0;
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(y, m, i + 1);
    cumSpent += spent[i];
    cumSaved += saved[i];
    const future = key(date) > todayKey;
    const share = (i + 1) / days;
    const tracking = active.has(key(date)) ? 1 : 0;
    const allowed = allowance * share;
    const budget = allowance > 0 ? (cumSpent <= allowed + 0.005 ? 1 : allowed / cumSpent) : null;
    const goal = savingsTarget * share;
    const saving = savingsTarget > 0 ? Math.min(Math.max(cumSaved / goal, 0), 2) : null;
    const perfect = !future && tracking >= 1 && (budget == null || budget >= 1) && (saving == null || saving >= 1);
    return { day: i + 1, date, tracking, budget, saving, future, perfect };
  });
}

/** The longest run of consecutive active days ever. */
export function longestStreak(activeDays: string[]) {
  const days = [...new Set(activeDays.map((d) => d.slice(0, 10)))].sort();
  let best = 0, run = 0, prev: Date | null = null;
  for (const k of days) {
    const d = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Days in a row, up to today, on which a ring was full (today counts only
 *  once it is). */
export function ringStreak(rings: DayRing[], which: "budget" | "perfect") {
  const past = rings.filter((r) => !r.future);
  let n = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    const ok = which === "perfect" ? past[i].perfect : (past[i].budget ?? 0) >= 1;
    if (ok) n++;
    else if (i === past.length - 1) continue; // today may still come good
    else break;
  }
  return n;
}
