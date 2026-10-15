import type { Budget, Category, FinanceData, Holding, Money, Transaction } from "./types";

// Same rules as the iOS app's BudgetCalculator / DashboardView, so a given
// month's totals read identically on both platforms.

export const num = (v: Money | null | undefined) => (v ? Number(v) : 0);

export const live = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deleted_at === null);

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function inMonth(t: Transaction, month: Date) {
  // Compare in local time — the ISO string is UTC, so slicing it would put
  // a just-after-midnight transaction on the 1st into the previous month.
  return monthKey(new Date(t.date)) === monthKey(month);
}

/** A category's own id plus its direct subcategories' ids — spend logged on a
 *  subcategory counts toward the parent (Category.selfAndSubcategoryIDs). */
export function selfAndChildren(category: Category, categories: Category[]) {
  return new Set([category.id, ...categories.filter((c) => c.parent_id === category.id).map((c) => c.id)]);
}

export type MonthSummary = {
  income: number;
  spent: number;
  fixed: number;
  variable: number;
  balance: number;
};

export function summarize(transactions: Transaction[], month: Date): MonthSummary {
  let income = 0, fixed = 0, variable = 0;
  for (const t of live(transactions)) {
    if (!inMonth(t, month)) continue;
    const a = num(t.amount);
    if (t.type === "income") income += a;
    else if (t.is_fixed_expense) fixed += a;
    else variable += a;
  }
  const spent = fixed + variable;
  return { income, spent, fixed, variable, balance: income - spent };
}

export type CategorySpend = {
  category: Category;
  spent: number;
  budget: number | null;
  isOverBudget: boolean;
};

export function spendByCategory(data: FinanceData, month: Date): CategorySpend[] {
  const categories = live(data.categories);
  const tx = live(data.transactions).filter((t) => t.type === "expense" && inMonth(t, month));
  const budgets = live(data.budgets).filter((b) => b.month.slice(0, 7) === monthKey(month));

  return categories
    .filter((c) => !c.is_income_category && c.parent_id === null)
    .map((category) => {
      const ids = selfAndChildren(category, categories);
      const spent = tx.filter((t) => t.category_id && ids.has(t.category_id)).reduce((s, t) => s + num(t.amount), 0);
      const b: Budget | undefined = budgets.find((x) => x.category_id === category.id);
      const budget = b ? num(b.amount) : null;
      return { category, spent, budget, isOverBudget: budget !== null && spent > budget };
    })
    .filter((e) => e.spent > 0)
    .sort((a, b) => b.spent - a.spent);
}

export type MonthPoint = { month: Date; income: number; expense: number };

export function last12Months(transactions: Transaction[], now = new Date()): MonthPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const s = summarize(transactions, month);
    return { month, income: s.income, expense: s.spent };
  });
}

/** Fraction of the month elapsed, for the iOS-style "live" pace figures. */
export function monthProgress(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return (now.getTime() - start) / (end - start);
}

/** Cost basis of holdings bought in `currency`. Holdings in other currencies
 *  are left out (and counted) rather than summed as if they were the same
 *  money — they join the total once exchange rates are synced in. */
export function investedIn(holdings: Holding[], currency: string) {
  let total = 0, skipped = 0;
  for (const h of live(holdings)) {
    if (!h.cost_basis) continue;
    if ((h.cost_basis_currency ?? currency) === currency) total += num(h.cost_basis);
    else skipped++;
  }
  return { total, skipped };
}
