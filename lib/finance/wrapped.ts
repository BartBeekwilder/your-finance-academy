// Month Wrapped — the closed month told in a few cards (like Spotify
// Wrapped), shown while closing it: the headline numbers, where the money
// went (variable spending), every category against its budget (or, without one, against its
// own average) as rings, the investments' month, the change in equity and
// a few facts about the month.

import { balanceSheet, budgetIn, live, spendByCategory, summarize } from "./calc";
import type { Category, FinanceData, Holding } from "./types";

export type RingRow = {
  category: Category;
  spent: number;
  /** The budget, or — without one — the average of the three months before. */
  target: number;
  kind: "budget" | "average";
};

export type HoldingMonth = { holding: Holding; start: number; end: number; change: number; share: number | null };

const inMonth = (iso: string, m: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
};

/** A holding's market value at a moment, from data.market (last price on or
 *  before it); null without prices. */
function valueAt(data: FinanceData, h: Holding, t: number) {
  const pts = data.market?.[h.id];
  if (!pts?.length || pts[0][0] > t) return null;
  let v = pts[0][1];
  for (const [pt, val] of pts) {
    if (pt > t) break;
    v = val;
  }
  return v;
}

export function monthWrapped(data: FinanceData, month: Date, now: Date) {
  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const s = summarize(data.transactions, month);
  const p = summarize(data.transactions, prev);
  const saved = s.income - s.spent, savedBefore = p.income - p.spent;

  // Where it went: categories by spending, and the biggest single
  // (variable) expense — a mortgage would always win otherwise.
  const byCat = spendByCategory(data, month);
  const expenses = live(data.transactions).filter((t) => t.type === "expense" && inMonth(t.date, month));
  const biggest = expenses.filter((t) => !t.is_fixed_expense).sort((a, b) => Number(b.amount) - Number(a.amount))[0] ?? null;

  // Rings: variable categories with spending, a budget or an average.
  const budgets = live(data.budgets);
  const earlier = [1, 2, 3].map((k) => spendByCategory(data, new Date(month.getFullYear(), month.getMonth() - k, 1)));
  const rings: RingRow[] = live(data.categories)
    .filter((c) => !c.is_income_category && !c.parent_id && !c.is_fixed_expense)
    .map((category) => {
      const spent = byCat.find((e) => e.category.id === category.id)?.spent ?? 0;
      const budget = budgetIn(budgets, category.id, month);
      const average = earlier.reduce((sum, m) => sum + (m.find((e) => e.category.id === category.id)?.spent ?? 0), 0) / 3;
      return budget != null ? { category, spent, target: budget, kind: "budget" as const } : { category, spent, target: average, kind: "average" as const };
    })
    .filter((r) => r.target > 0 || r.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  // Investments: each holding's month — from its value on the 1st (or what
  // was paid, if bought this month) to its value at the month's end.
  const holdings: HoldingMonth[] = [];
  for (const h of live(data.holdings)) {
    const added = Date.parse(h.date_added) || 0;
    if (added >= end.getTime()) continue;
    const endV = valueAt(data, h, end.getTime() - 1);
    if (endV == null) continue;
    const boughtNow = added >= month.getTime();
    const startV = boughtNow ? Number(h.cost_basis) || endV : valueAt(data, h, month.getTime());
    if (startV == null) continue;
    holdings.push({ holding: h, start: startV, end: endV, change: endV - startV, share: startV ? endV / startV - 1 : null });
  }
  holdings.sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  const invStart = holdings.reduce((a, h) => a + h.start, 0), invEnd = holdings.reduce((a, h) => a + h.end, 0);

  // Equity at the end of this month against the end of the last.
  const equity = balanceSheet(data, now, month).equity;
  const equityBefore = balanceSheet(data, now, prev).equity;

  // Facts: number of expenses, the most expensive day, days without spending.
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const perDay = Array.from({ length: days }, () => 0);
  for (const t of expenses) if (!t.is_fixed_expense) perDay[new Date(t.date).getDate() - 1] += Number(t.amount);
  const topDay = perDay.reduce((best, v, i) => (v > perDay[best] ? i : best), 0);
  const lastDay = now.getFullYear() === month.getFullYear() && now.getMonth() === month.getMonth() ? now.getDate() : days;
  const noSpend = perDay.slice(0, lastDay).filter((v) => v === 0).length;

  return {
    income: s.income,
    spent: s.spent,
    fixed: s.fixed,
    saved,
    savingsRate: s.income > 0 ? saved / s.income : 0,
    savedBefore,
    // Variable spending only — fixed costs are the same every month.
    top: byCat.filter((e) => !e.category.is_fixed_expense).slice(0, 4).map((e) => ({ category: e.category, spent: e.spent, share: s.variable ? e.spent / s.variable : 0 })),
    biggest,
    rings,
    kept: rings.filter((r) => r.target > 0 && r.spent <= r.target + 0.005).length,
    investments: holdings.length ? { start: invStart, end: invEnd, change: invEnd - invStart, share: invStart ? invEnd / invStart - 1 : null, best: holdings[0], worst: holdings[holdings.length - 1], count: holdings.length } : null,
    equity,
    equityChange: equity - equityBefore,
    facts: { expenses: expenses.length, topDay: perDay[topDay] > 0 ? { date: new Date(month.getFullYear(), month.getMonth(), topDay + 1), amount: perDay[topDay] } : null, noSpend },
  };
}

export type Wrapped = ReturnType<typeof monthWrapped>;
