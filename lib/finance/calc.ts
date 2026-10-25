import { spreadBookValue } from "./spread";
import { investmentsByKind, investmentsValue } from "./quotes";
import { intlLocale, t } from "@/lib/i18n";
import { summarize as summarizePart } from "./mortgage";
import { homes } from "./realEstate";
import type { Account, Budget, Category, FinanceData, Holding, Money, Transaction } from "./types";

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

/** What each account gained this year so far (income − spending booked on
 *  it, up to `now`), by account id. An account's balance today is its
 *  1 January balance plus this. Spending without an account counts on the
 *  default account (as a bank app would); income without one hasn't landed
 *  anywhere yet — see pendingIncome. */
export function accountFlows(data: FinanceData, now: Date) {
  const out = new Map<string, number>();
  const year = now.getFullYear();
  const fallback = live(data.accounts).find((a) => a.is_default)?.id ?? null;
  for (const t of live(data.transactions)) {
    if (t.spread_of) continue; // spread parts are bookkeeping, not cash
    const account = t.account_id ?? (t.type === "expense" ? fallback : null);
    if (!account) continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== year || d > now) continue;
    out.set(account, (out.get(account) ?? 0) + (t.type === "income" ? 1 : -1) * num(t.amount));
  }
  // A spread purchase left the account at once, in full.
  for (const t of live(data.transactions)) {
    const o = t.spread_of;
    if (!o || t.spread_index !== 1) continue;
    const account = o.account_id ?? fallback;
    const d = new Date(o.date);
    if (!account || d.getFullYear() !== year || d > now) continue;
    out.set(account, (out.get(account) ?? 0) - num(o.amount));
  }
  return out;
}

/** Income entered this year without an account: money that's yours but
 *  hasn't landed on an account yet ("still to receive"). Choosing "Received
 *  on" for it moves it to that account. */
export function pendingIncome(data: FinanceData, at: Date) {
  const year = at.getFullYear();
  return live(data.transactions)
    .filter((t) => t.type === "income" && !t.account_id && new Date(t.date).getFullYear() === year && new Date(t.date) <= at)
    .sort((a, b) => b.date.localeCompare(a.date));
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

export type BalanceLine = {
  id: string;
  name: string;
  value: number;
  kind: "manual" | "auto";
  hint?: string;
  /** What an auto line is made of (accounts, kinds of investment) — the
   *  balance table unfolds it. */
  parts?: {
    id: string;
    name: string;
    value: number;
    hint?: string;
    /** An account: what was booked on it up to this sheet's moment, so a
     *  typed balance can be turned back into its 1 January balance. */
    flow?: number;
    /** Where to see / change it (e.g. the Investments page). */
    href?: string;
    /** A heading the part sits under (accounts: by kind, like a bank app). */
    group?: string;
  }[];
};

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

  // Real estate: each property at its value, each mortgage part at its
  // remaining debt at the end of the month (from its schedule).
  const monthEnd = isCurrent ? now : new Date(month.getFullYear(), month.getMonth() + 1, 0);
  for (const { property, parts } of homes(data)) {
    assets.push({ id: `property-${property.id}`, name: property.name || t("Home"), value: num(property.value), kind: "auto", hint: t("From Real estate") });
    for (const part of parts) {
      liabilities.push({ id: `mortgage-${part.id}`, name: part.name || t("Mortgage"), value: summarizePart(part, monthEnd).balance, kind: "auto", hint: t("From Real estate") });
    }
  }

  // Investments at their real (market) value at the end of the month — now
  // for this month; at cost while no quotes are loaded.
  const inv = investmentsValue(data, isCurrent ? now : new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59));
  let cash = nw.accountsTotal + nw.finished.slice(0, Math.max(m + 1, 0)).reduce((a, b) => a + b, 0);
  if (isCurrent) {
    const s = nw.thisMonth;
    const f = Math.min(Math.max((now.getTime() - new Date(year, current, 1).getTime()) / (nw.days * 86_400_000), 0), 1);
    cash = nw.base - nw.holdingsTotal + s.income - s.spent;
    const prepaid = s.fixed * (1 - f);
    const earned = nw.projected * f - s.income;
    const book = spreadBookValue(data, now);
    assets.push({ id: "accounts", name: t("Accounts"), value: cash - book.total, kind: "auto", hint: t("Start of the year + what each month added") });
    assets.push({ id: "investments", name: t("Investments"), value: inv.total, kind: "auto", hint: inv.real ? t("Market value") : t("Holdings at cost") });
    if (book.total > 0.005) assets.push({ id: "spread", name: t("Spread purchases"), value: book.total, kind: "auto", hint: t("Paid, not yet used up (book value)") });
    if (prepaid > 0.005) assets.push({ id: "prepaid", name: t("Prepaid"), value: prepaid, kind: "auto", hint: t("Fixed costs paid for the rest of the month") });
    if (earned > 0.005) assets.push({ id: "receivable", name: t("Receivable"), value: earned, kind: "auto", hint: t("Income earned so far, not yet received") });
    if (earned < -0.005) liabilities.push({ id: "advance", name: t("Income received in advance"), value: -earned, kind: "auto", hint: t("Received, not yet earned this month") });
  } else {
    // Spread purchases: paid at once, used up month by month — the part not
    // yet used comes off Accounts and shows as an asset (book value).
    const book = spreadBookValue(data, month);
    assets.push({ id: "accounts", name: t("Accounts"), value: cash - book.total, kind: "auto", hint: t("Start of the year + what each month added") });
    assets.push({ id: "investments", name: t("Investments"), value: inv.total, kind: "auto", hint: inv.real ? t("Market value") : t("Holdings at cost") });
    if (book.total > 0.005) assets.push({ id: "spread", name: t("Spread purchases"), value: book.total, kind: "auto", hint: t("Paid, not yet used up (book value)") });
  }

  // Breakdowns: Accounts per account (1 January + what was booked on it up
  // to the month's end), the rest of the year's cash flow on its own line;
  // Investments per kind.
  const at = isCurrent ? now : new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
  const acc = assets.find((l) => l.id === "accounts");
  // Income without an account: its own line, out of Accounts.
  const pending = pendingIncome(data, at);
  const pendingTotal = pending.reduce((s2, x) => s2 + num(x.amount), 0);
  if (acc && pendingTotal > 0.005) {
    acc.value -= pendingTotal;
    const cats = new Map(data.categories.map((c) => [c.id, c.name]));
    assets.splice(assets.indexOf(acc) + 1, 0, {
      id: "pending",
      name: t("Amounts to receive"),
      value: pendingTotal,
      kind: "auto",
      hint: t("Income entered, not yet received on an account"),
      parts: pending.map((x) => ({
        id: x.id,
        name: `${x.note || (x.category_id ? cats.get(x.category_id) : "") || t("Income")} · ${new Date(x.date).toLocaleDateString(intlLocale(), { day: "numeric", month: "short" })}`,
        value: num(x.amount),
      })),
    });
  }
  if (acc) {
    const flows = accountFlows(data, at);
    // Grouped by kind in a bank's order (current, savings, credit, cash),
    // each group in the order the accounts were added — so it reads like
    // the bank's own overview.
    const KINDS: Account["type"][] = ["checking", "savings", "credit", "cash"];
    const GROUP: Record<string, string> = { checking: t("Current accounts"), savings: t("Savings accounts"), credit: t("Credit cards"), cash: t("Cash") };
    const parts: NonNullable<BalanceLine["parts"]> = KINDS.flatMap((kind) =>
      live(data.accounts)
        .filter((a) => a.type === kind)
        .map((a) => ({ id: a.id, name: a.name || t("Account"), value: num(a.balance) + (flows.get(a.id) ?? 0), flow: flows.get(a.id) ?? 0, group: GROUP[kind] }))
        // An empty account isn't worth a line (it shows again once it isn't).
        .filter((p) => Math.abs(p.value) >= 0.005),
    );
    const rest = acc.value - parts.reduce((s2, p) => s2 + p.value, 0);
    if (Math.abs(rest) >= 0.005) parts.push({ id: "unassigned", name: t("Correction"), value: rest, hint: t("Difference between your account balances and this year's bookings") });
    if (parts.length) acc.parts = parts;
  }
  const invLine = assets.find((l) => l.id === "investments");
  if (invLine) {
    const KIND: Record<string, string> = { stock: t("Stocks"), crypto: t("Crypto"), metal: t("Metals") };
    const kinds = investmentsByKind(data, at);
    invLine.parts = [...kinds]
      .map(([k, v]) => ({ id: `kind-${k}`, name: `${KIND[k] ?? k} · ${v.count === 1 ? t("1 holding") : t("{n} holdings", { n: v.count })}`, value: v.value, href: "/app/investments" }))
      .sort((a, b) => b.value - a.value);
  }

  const totalAssets = assets.reduce((t, l) => t + l.value, 0);
  const totalDebt = liabilities.reduce((t, l) => t + l.value, 0);
  const equity = totalAssets - totalDebt;
  return { assets, liabilities, totalAssets, totalDebt, equity, isCurrent };
}
