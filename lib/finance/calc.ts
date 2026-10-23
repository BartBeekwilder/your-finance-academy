import { t } from "@/lib/i18n";
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
  /** The part of `spent` that is fixed costs (rent, subscriptions…). */
  fixed: number;
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
      const own = tx.filter((t) => t.category_id && ids.has(t.category_id));
      const spent = own.reduce((s, t) => s + num(t.amount), 0);
      const fixed = own.filter((t) => t.is_fixed_expense).reduce((s, t) => s + num(t.amount), 0);
      const b: Budget | undefined = budgets.find((x) => x.category_id === category.id);
      const budget = b ? num(b.amount) : null;
      return { category, spent, fixed, budget, isOverBudget: budget !== null && spent > budget };
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

/** The month's net income for the live Income/Balance tiles — iOS
 *  IncomeManager.projectedAmounts: that month's income record if there is
 *  one, else the expected net income from settings, else (income never set
 *  up) whatever income was actually entered. */
export function projectedNetIncome(data: FinanceData, month: Date) {
  const record = live(data.incomeRecords).find((r) => r.month.slice(0, 7) === monthKey(month));
  if (record) return num(record.net_amount);
  if (data.profile.expected_net_monthly !== null) return num(data.profile.expected_net_monthly);
  return summarize(data.transactions, month).income;
}

export type CategoryMonth = { month: Date; total: number; budget: number | null; future: boolean };

/** Jan–Dec of `now`'s year for one category (subcategories included): spend
 *  per month and that month's budget. A month uses its own budget row, else
 *  the latest earlier one (budgets carry forward), else the current month's.
 *  Shared by the dashboard cards and the category sheet so they agree. */
export function categoryYear(data: FinanceData, category: Category, now: Date) {
  const ids = selfAndChildren(category, live(data.categories));
  const expenses = live(data.transactions).filter((t) => t.type === "expense" && t.category_id && ids.has(t.category_id));
  const budgets = live(data.budgets)
    .filter((b) => b.category_id === category.id)
    .map((b) => ({ key: b.month.slice(0, 7), amount: num(b.amount) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const current = budgets.find((b) => b.key === monthKey(now));
  const budgetFor = (key: string) =>
    [...budgets].reverse().find((b) => b.key <= key)?.amount ?? current?.amount ?? budgets[0]?.amount ?? null;

  const totals = new Map<string, number>();
  for (const t of expenses) {
    const key = monthKey(new Date(t.date));
    totals.set(key, (totals.get(key) ?? 0) + num(t.amount));
  }
  const year = now.getFullYear();
  const months: CategoryMonth[] = Array.from({ length: 12 }, (_, m) => {
    const key = monthKey(new Date(year, m, 1));
    return { month: new Date(year, m, 1), total: totals.get(key) ?? 0, budget: budgetFor(key), future: m > now.getMonth() };
  });
  return { months, expenses };
}

/** Spend per top-level expense category over a whole calendar year
 *  (subcategories included), biggest first. For the current year that is
 *  1 January up to now. Accepts a Date (its year) or a year number. */
export function spendByCategoryYear(data: FinanceData, when: Date | number): { category: Category; spent: number }[] {
  const categories = live(data.categories);
  const year = typeof when === "number" ? when : when.getFullYear();
  const tx = live(data.transactions).filter((t) => t.type === "expense" && new Date(t.date).getFullYear() === year);
  return categories
    .filter((c) => !c.is_income_category && c.parent_id === null)
    .map((category) => {
      const ids = selfAndChildren(category, categories);
      return { category, spent: tx.filter((t) => t.category_id && ids.has(t.category_id)).reduce((s, t) => s + num(t.amount), 0) };
    })
    .filter((e) => e.spent > 0)
    .sort((a, b) => b.spent - a.spent);
}

/** Calendar years that have at least one transaction, oldest first, always
 *  including `now`'s year. */
export function yearsWithData(data: FinanceData, now: Date): number[] {
  const years = new Set(live(data.transactions).map((t) => new Date(t.date).getFullYear()));
  years.add(now.getFullYear());
  return [...years].filter((y) => y <= now.getFullYear()).sort((a, b) => a - b);
}

/** Day-by-day running totals for `now`'s month, using the same live rules
 *  as the dashboard tiles: income accrues evenly toward the month's
 *  projected net; fixed costs are spread evenly; variable spending counts
 *  on the day it happened. Day 1..today; the last point is "now", so it
 *  matches the tiles exactly. */
export function monthToDate(data: FinanceData, now: Date) {
  const year = now.getFullYear(), m = now.getMonth();
  const start = new Date(year, m, 1).getTime();
  const days = new Date(year, m + 1, 0).getDate();
  const monthMs = days * 86_400_000;
  const income = projectedNetIncome(data, now);
  const s = summarize(data.transactions, now);
  const variableByDay = new Array(days + 1).fill(0);
  for (const t of live(data.transactions)) {
    const d = new Date(t.date);
    if (t.type !== "expense" || t.is_fixed_expense || d.getFullYear() !== year || d.getMonth() !== m) continue;
    variableByDay[d.getDate()] += num(t.amount);
  }
  const points: { day: number; income: number; spent: number }[] = [];
  let variable = 0;
  for (let day = 1; day <= now.getDate(); day++) {
    variable += variableByDay[day];
    // End of each finished day; "now" for today.
    const at = day === now.getDate() ? now.getTime() : start + day * 86_400_000;
    const f = Math.min(1, (at - start) / monthMs);
    points.push({ day, income: income * f, spent: s.fixed * f + variable });
  }
  return { points, days };
}

/** Forecast for this month and the rest of `now`'s year, per month (not
 *  cumulative): income at the projected net (this month in full), spending at
 *  the average of the year's finished months — this month never less than
 *  what is already entered. Used by the tile sparklines' dotted line and the
 *  Expenses page, so they agree. */
export function yearForecast(data: FinanceData, now: Date) {
  const year = now.getFullYear(), current = now.getMonth();
  const finished = Array.from({ length: current }, (_, m) => summarize(data.transactions, new Date(year, m, 1)).spent).filter((v) => v > 0);
  const thisMonth = summarize(data.transactions, new Date(year, current, 1));
  const avgSpent = finished.length ? finished.reduce((a, b) => a + b, 0) / finished.length : thisMonth.spent;
  return Array.from({ length: 12 - current }, (_, i) => {
    const m = current + i;
    return {
      month: m,
      income: projectedNetIncome(data, new Date(year, m, 1)),
      spent: i === 0 ? Math.max(thisMonth.spent, avgSpent) : avgSpent,
    };
  });
}

/** Net worth over the year, on the live tiles' rules — the same model as
 *  iOS (DashboardView.netWorthYearlyTrend): account balances + holdings (at
 *  cost) are the starting point on 1 January; finished months move it by
 *  what was entered (income − spending), this month by the live Balance
 *  (projected income × fraction − fixed × fraction − variable), the months
 *  ahead by the forecast. `base` is the net worth at the start of this month. */
export function netWorthFigures(data: FinanceData, now: Date) {
  const currency = data.profile.currency_code;
  const accounts = live(data.accounts);
  const accountsTotal = accounts.reduce((t, a) => t + num(a.balance), 0);
  const holdingsTotal = investedIn(data.holdings, currency).total;
  const year = now.getFullYear(), current = now.getMonth();
  const finished = Array.from({ length: current }, (_, m) => {
    const s = summarize(data.transactions, new Date(year, m, 1));
    return s.income - s.spent;
  });
  const startOfYear = accountsTotal + holdingsTotal;
  const base = startOfYear + finished.reduce((a, b) => a + b, 0);
  const days = new Date(year, current + 1, 0).getDate();
  const thisMonth = summarize(data.transactions, new Date(year, current, 1));
  const projected = projectedNetIncome(data, new Date(year, current, 1));
  const monthStart = new Date(year, current, 1).getTime();
  /** This month's live change at time `at` (ms) — the Balance tile. */
  const liveChange = (at: number) => {
    const f = Math.min(Math.max((at - monthStart) / (days * 86_400_000), 0), 1);
    return projected * f - (thisMonth.fixed * f + thisMonth.variable);
  };
  const forecast = yearForecast(data, now).map((f) => ({ month: f.month, change: f.income - f.spent }));
  return { accountsTotal, holdingsTotal, base, startOfYear, finished, liveChange, forecast, thisMonth, projected, days };
}

export type BalanceLine = { id: string; name: string; value: number; kind: "manual" | "auto"; hint?: string };

/** The balance sheet at the end of `month` (or now, for the current month),
 *  on the net worth model:
 *   Assets      — the user's own posts (home, car…); Accounts = account
 *                 balances on 1 January + what each month added (income −
 *                 spending), this month as actually entered; Investments at
 *                 cost; and, in the current month only, Prepaid (fixed costs
 *                 paid for the rest of the month) and Receivable (income
 *                 earned so far but not yet received).
 *   Liabilities — the user's posts (mortgage, loans…), plus Income received
 *                 in advance when more came in than has been earned yet.
 *   Equity      — assets − liabilities.
 *  Accounts + investments + prepaid + receivable − received in advance is
 *  exactly the live net worth, so equity = net worth + own assets − own
 *  liabilities. A post's month value is that month's stand, else the latest
 *  earlier one (before its first stand: the first one); the current month
 *  uses its current value. */
export function balanceSheet(data: FinanceData, now: Date, month: Date) {
  const year = now.getFullYear(), current = now.getMonth();
  const m = month.getFullYear() < year ? -1 : month.getMonth();
  const isCurrent = month.getFullYear() === year && m === current;
  const nw = netWorthFigures(data, now);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const values = live(data.balanceValues ?? []);
  const postValue = (item: FinanceData["balanceItems"][number]) => {
    if (isCurrent) return num(item.current_value);
    const rows = values.filter((v) => v.item_id === item.id).sort((a, b) => b.month.localeCompare(a.month));
    // The latest stand up to this month; before the first stand, the first
    // one (a post entered today is assumed to have been there all along).
    const at = rows.find((v) => v.month.slice(0, 7) <= key(month)) ?? rows[rows.length - 1];
    return at ? num(at.value) : num(item.current_value);
  };
  const posts = live(data.balanceItems ?? []).sort((a, b) => a.sort_order - b.sort_order);

  const assets: BalanceLine[] = [];
  const liabilities: BalanceLine[] = [];
  for (const p of posts) (p.side === "asset" ? assets : liabilities).push({ id: p.id, name: p.name || t("Untitled"), value: postValue(p), kind: "manual" });

  let cash = nw.accountsTotal + nw.finished.slice(0, Math.max(m + 1, 0)).reduce((a, b) => a + b, 0);
  if (isCurrent) {
    const s = nw.thisMonth;
    const f = Math.min(Math.max((now.getTime() - new Date(year, current, 1).getTime()) / (nw.days * 86_400_000), 0), 1);
    cash = nw.base - nw.holdingsTotal + s.income - s.spent;
    const prepaid = s.fixed * (1 - f);
    const earned = nw.projected * f - s.income;
    assets.push({ id: "accounts", name: t("Accounts"), value: cash, kind: "auto", hint: t("Start of the year + what each month added") });
    assets.push({ id: "investments", name: t("Investments"), value: nw.holdingsTotal, kind: "auto", hint: t("Holdings at cost") });
    if (prepaid > 0.005) assets.push({ id: "prepaid", name: t("Prepaid"), value: prepaid, kind: "auto", hint: t("Fixed costs paid for the rest of the month") });
    if (earned > 0.005) assets.push({ id: "receivable", name: t("Receivable"), value: earned, kind: "auto", hint: t("Income earned so far, not yet received") });
    if (earned < -0.005) liabilities.push({ id: "advance", name: t("Income received in advance"), value: -earned, kind: "auto", hint: t("Received, not yet earned this month") });
  } else {
    assets.push({ id: "accounts", name: t("Accounts"), value: cash, kind: "auto", hint: t("Start of the year + what each month added") });
    assets.push({ id: "investments", name: t("Investments"), value: nw.holdingsTotal, kind: "auto", hint: t("Holdings at cost") });
  }

  const totalAssets = assets.reduce((t, l) => t + l.value, 0);
  const totalDebt = liabilities.reduce((t, l) => t + l.value, 0);
  const equity = totalAssets - totalDebt;
  return { assets, liabilities, totalAssets, totalDebt, equity, isCurrent };
}
