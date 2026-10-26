// Next month's budgets, proposed while closing a month: per variable
// expense category the budget that carries on, or — without one — the
// average of the last three months, rounded to a friendly amount. A goal
// ("10% less") scales it down.

// Pure (types only), so it's tested with plain node and ported to the apps.

import type { Budget, Category, FinanceData } from "./types";

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** A category's budget in a month: the latest one set on or before it — a
 *  budget carries on month after month until it's changed. 0 = none. */
export function budgetIn(budgets: Budget[], categoryId: string, month: Date) {
  const key = monthKey(month);
  let best: Budget | null = null;
  for (const b of budgets) {
    if (b.deleted_at || b.category_id !== categoryId || b.month.slice(0, 7) > key) continue;
    if (!best || b.month > best.month) best = b;
  }
  const v = best ? Number(best.amount) : 0;
  return v > 0 ? v : null;
}

/** Friendly budget amounts: €5 steps below 100, €10 below 1,000, else €50. */
export const roundBudget = (v: number) => (v <= 0 ? 0 : v < 100 ? Math.ceil(v / 5) * 5 : v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50);

export type PlanRow = {
  category: Category;
  /** Spent in the month being closed. */
  spent: number;
  /** Average spent over that month and the two before. */
  average: number;
  /** The budget that would carry on into next month (null = none). */
  current: number | null;
  /** current, else the rounded average. */
  suggested: number;
};

export function budgetPlan(data: FinanceData, month: Date): PlanRow[] {
  const keys = [2, 1, 0].map((k) => monthKey(new Date(month.getFullYear(), month.getMonth() - k, 1)));
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const cats = data.categories.filter((c) => !c.deleted_at);
  const top = new Map(cats.map((c) => [c.id, c.parent_id ?? c.id]));
  // Spent per top-level category per month (subcategories count for their parent).
  const spent = new Map<string, number>();
  for (const t of data.transactions) {
    if (t.deleted_at || t.type !== "expense" || !t.category_id) continue;
    const k = monthKey(new Date(t.date));
    if (!keys.includes(k)) continue;
    const id = `${top.get(t.category_id) ?? t.category_id}|${k}`;
    spent.set(id, (spent.get(id) ?? 0) + Number(t.amount));
  }
  return cats
    .filter((c) => !c.is_income_category && !c.parent_id && !c.is_fixed_expense)
    .map((category) => {
      const per = keys.map((k) => spent.get(`${category.id}|${k}`) ?? 0);
      const average = per.reduce((a, b) => a + b, 0) / per.length;
      const current = budgetIn(data.budgets, category.id, next);
      return { category, spent: per[2], average, current, suggested: current ?? roundBudget(average) };
    })
    .filter((r) => r.average > 0 || r.current != null)
    .sort((a, b) => b.suggested - a.suggested);
}

/** A goal applied to a budget: `less` = 0.1 for 10% less, rounded down to
 *  a friendly step (so a goal is always below what it started from). */
export function withGoal(amount: number, less: number) {
  if (!less) return amount;
  const v = amount * (1 - less);
  const step = v < 100 ? 1 : v < 1000 ? 5 : 10;
  return Math.max(step, Math.floor(v / step) * step);
}
