// Daily rings for the activity calendar — the month's three rings, day by
// day, like a watch's activity history:
//   tracking — the books were updated that day (full or empty);
//   budget   — spending so far this month within the allowance so far;
//              with `budgetPlan`, all budgets together: that day's forecast
//              for the month (variable spending so far + the usual rest +
//              the month's fixed costs) within the total budget
//              (full while on track; less full the further over);
//   saving   — saved so far against the savings target so far (a second
//              lap past it). With `accrue`, on the live tiles' model: the
//              salary and fixed costs spread evenly over the month (they
//              land on one day — payday, the 1st — so day by day the cash
//              alone reads empty until payday), other income and variable
//              spending on their day.
// And the streaks around them. Pure (types only), so it's tested with plain
// node and ported to the apps.

import type { Transaction } from "./types";

// Same as progress.ts budgetTotalRing (kept here so this file stays pure).
const budgetTotalRing = (t: { forecast: number; budget: number }) => (!(t.budget > 0) ? 0 : t.forecast <= t.budget + 0.005 ? 1 : t.budget / t.forecast);

export type DayRing = { day: number; date: Date; tracking: number; budget: number | null; saving: number | null; future: boolean; perfect: boolean };

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type DayTx = Pick<Transaction, "type" | "amount" | "date" | "is_fixed_expense" | "deleted_at">;

export function dayRings<T extends DayTx>({
  transactions,
  activeDays,
  month,
  today,
  allowance,
  savingsTarget,
  accrue,
  budgetPlan,
  underIncome,
}: {
  transactions: T[];
  activeDays: string[];
  month: Date;
  today: Date;
  /** Variable spending allowed for the whole month (0 = no budget ring). */
  allowance: number;
  /** What the month should save (0 = no saving ring). */
  savingsTarget: number;
  /** All budgets together (see the top): total budget, the usual variable
   *  spending for a month, the month's fixed costs, and which transactions
   *  are in a budgeted category. */
  budgetPlan?: { budget: number; usualVar: number; fixedExpected: number; inBudget: (t: T) => boolean };
  /** Spread the month's salary (and the fixed costs) evenly over its days. */
  accrue?: { salary: number; isSalary: (t: T) => boolean };
  /** The budget ring as a daily goal (Bart, 14 Nov): a day is full when its
   *  spending (fixed costs a day's worth each day, the rest on its day)
   *  stays under its income (the salary a day's worth each day, other
   *  income on its day); over, it's income ÷ spending. Needs `accrue`. */
  underIncome?: boolean;
}): DayRing[] {
  const y = month.getFullYear(), m = month.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const active = new Set(activeDays.map((d) => d.slice(0, 10)));
  const spent = Array.from({ length: days }, () => 0), saved = Array.from({ length: days }, () => 0);
  const dayIn = Array.from({ length: days }, () => 0), dayOut = Array.from({ length: days }, () => 0);
  let fixedTotal = 0;
  for (const t of transactions) {
    if (t.deleted_at) continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    const a = Number(t.amount), i = d.getDate() - 1;
    if (t.type === "income") {
      if (!accrue?.isSalary(t)) { saved[i] += a; dayIn[i] += a; }
    } else {
      if (accrue && t.is_fixed_expense) fixedTotal += a;
      else { saved[i] -= a; dayOut[i] += a; }
      if (!t.is_fixed_expense && (!budgetPlan || budgetPlan.inBudget(t))) spent[i] += a;
    }
  }
  // Salary in and fixed costs out, a day's worth each day.
  const perDay = accrue ? (accrue.salary - fixedTotal) / days : 0;
  const todayKey = key(today);
  let cumSpent = 0, cumSaved = 0;
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(y, m, i + 1);
    cumSpent += spent[i];
    cumSaved += saved[i] + perDay;
    const future = key(date) > todayKey;
    const share = (i + 1) / days;
    const tracking = active.has(key(date)) ? 1 : 0;
    const allowed = allowance * share;
    const income = (accrue?.salary ?? 0) / days + dayIn[i], out = fixedTotal / days + dayOut[i];
    const budget = underIncome && accrue
      ? income <= 0 && out <= 0 ? 1 : out <= income + 0.005 ? 1 : Math.max(income, 0) / out
      : budgetPlan
      ? budgetPlan.budget > 0 ? budgetTotalRing({ forecast: cumSpent + budgetPlan.usualVar * (1 - share) + budgetPlan.fixedExpected, budget: budgetPlan.budget }) : null
      : allowance > 0 ? (cumSpent <= allowed + 0.005 ? 1 : allowed / cumSpent) : null;
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

/** Days under your income, as a month goal: the ring is full once
 *  UNDER_INCOME_SHARE of the month's days stayed under that day's income
 *  (`underIncome` rings; today counts once it's full). */
export const UNDER_INCOME_SHARE = 0.8;
export function underIncomeMonth(rings: DayRing[]) {
  const goal = Math.ceil(rings.length * UNDER_INCOME_SHARE);
  const hits = rings.filter((r) => !r.future && (r.budget ?? 0) >= 1).length;
  return { hits, goal, days: rings.length, ring: goal > 0 ? Math.min(hits / goal, 1) : 0 };
}
