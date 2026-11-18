import type { FinanceData, Transaction } from "./types";
import { balanceSheet, live, num, spendByCategory, summarize } from "./calc";

// The month as a report (Premium › PDF): the month in three numbers against
// the month before, spending per day (fixed costs apart), the categories
// against their budgets, the fixed costs, the biggest expenses and equity at
// the month's end. Ported to the apps later.

const sameMonth = (iso: string, m: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
};

export function monthReport(data: FinanceData, month: Date, now: Date) {
  const m = new Date(month.getFullYear(), month.getMonth(), 1);
  const prevMonth = new Date(m.getFullYear(), m.getMonth() - 1, 1);
  const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const s = summarize(data.transactions, m);
  const prev = summarize(data.transactions, prevMonth);
  const tx = live(data.transactions).filter((t) => sameMonth(t.date, m));
  const expenses = tx.filter((t) => t.type === "expense" && !t.advance);

  // Per day: fixed and other spending apart (a stacked bar), income as a mark.
  const perDay = Array.from({ length: days }, (_, i) => ({ day: i + 1, fixed: 0, variable: 0, income: 0 }));
  for (const t of tx) {
    const d = perDay[new Date(t.date).getDate() - 1];
    if (!d) continue;
    if (t.type === "income") d.income += num(t.amount);
    else if (t.advance) continue;
    else if (t.is_fixed_expense) d.fixed += num(t.amount);
    else d.variable += num(t.amount);
  }
  const peak = perDay.reduce((best, d) => (d.variable > best.variable ? d : best), perDay[0]);
  const noSpend = perDay.filter((d, i) => d.fixed + d.variable === 0 && new Date(m.getFullYear(), m.getMonth(), i + 1) <= now).length;

  const byAmount = (a: Transaction, b: Transaction) => num(b.amount) - num(a.amount);
  const fixed = expenses.filter((t) => t.is_fixed_expense).sort(byAmount);
  const biggest = expenses.filter((t) => !t.is_fixed_expense).sort(byAmount).slice(0, 5);

  // Equity at the month's end (a month in progress: as it stands now).
  const end = m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth() ? now : new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59);
  const equity = balanceSheet(data, end > now ? now : end, m).equity;
  const equityBefore = balanceSheet(data, end > now ? now : end, prevMonth).equity;

  return {
    month: m,
    income: s.income,
    spent: s.spent,
    fixedTotal: s.fixed,
    variableTotal: s.variable,
    saved: s.income - s.spent,
    savingsRate: s.income > 0 ? (s.income - s.spent) / s.income : 0,
    prev: { income: prev.income, spent: prev.spent, saved: prev.income - prev.spent, has: prev.income > 0 || prev.spent > 0 },
    perDay,
    peak: peak.variable > 0 ? peak : null,
    noSpend,
    categories: spendByCategory(data, m),
    fixed,
    biggest,
    equity,
    equityChange: equity - equityBefore,
    inProgress: end >= now,
  };
}

export type MonthReport = ReturnType<typeof monthReport>;
