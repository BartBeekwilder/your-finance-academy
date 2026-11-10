// Year Wrapped — the closed year told in story cards (like Month Wrapped,
// but for twelve months), shown when the year is closed after December.
// Pure: the caller (yearCloseModel.ts) hands in each month's totals, the
// year's expenses and the balance-sheet stands, so this can be tested
// without the app around it.

export type MonthTotals = { income: number; spent: number; fixed: number; variable: number };

export type YearExpense = { amount: number; date: Date; note: string | null; category_id: string | null; fixed: boolean };

export type YearInput = {
  year: number;
  /** Twelve months, January first. */
  months: MonthTotals[];
  /** Last year's twelve months, when there was data (else null). */
  lastYear: MonthTotals[] | null;
  /** The year's expenses (spread parts included, as the screens count them). */
  expenses: YearExpense[];
  /** Variable spending per top-level category for the year, biggest first. */
  categories: { id: string; spent: number }[];
  /** Equity at the end of each month, January first (twelve values). */
  equityByMonth: number[];
  /** Equity at the end of the year before. */
  equityStart: number;
  /** The investments from the year's start (or purchase) to its end; null without prices. */
  investments: { start: number; end: number } | null;
  /** Months of this year closed in the app. */
  closes: number;
  /** Badges earned this year. */
  badges: number;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const totals = (months: MonthTotals[]) => {
  const income = sum(months.map((m) => m.income)), spent = sum(months.map((m) => m.spent));
  return { income, spent, fixed: sum(months.map((m) => m.fixed)), variable: sum(months.map((m) => m.variable)), saved: income - spent };
};
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function yearWrapped(y: YearInput, now: Date) {
  const tot = totals(y.months);
  const before = y.lastYear ? totals(y.lastYear) : null;

  // Saved per month; the best and the toughest month among months with
  // anything booked (an empty month is neither).
  const saved = y.months.map((m) => m.income - m.spent);
  const used = y.months.map((m, i) => ({ i, saved: saved[i], any: m.income > 0 || m.spent > 0 })).filter((m) => m.any);
  const best = used.length ? used.reduce((a, b) => (b.saved > a.saved ? b : a)) : null;
  const toughest = used.length > 1 ? used.reduce((a, b) => (b.saved < a.saved ? b : a)) : null;
  const plusMonths = used.filter((m) => m.saved > 0).length;

  // Where it went: the top categories of variable spending, and the biggest
  // single variable expense (a mortgage would always win otherwise).
  const top = y.categories.slice(0, 5).map((c) => ({ ...c, share: tot.variable ? c.spent / tot.variable : 0 }));
  const variable = y.expenses.filter((e) => !e.fixed);
  const biggest = variable.reduce<YearExpense | null>((a, e) => (!a || e.amount > a.amount ? e : a), null);

  // Facts: the most expensive day, and days without (variable) spending up
  // to today when the year isn't over yet.
  const perDay = new Map<string, { date: Date; amount: number }>();
  for (const e of variable) {
    const k = dayKey(e.date);
    const d = perDay.get(k) ?? { date: new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate()), amount: 0 };
    d.amount += e.amount;
    perDay.set(k, d);
  }
  const topDay = [...perDay.values()].reduce<{ date: Date; amount: number } | null>((a, d) => (!a || d.amount > a.amount ? d : a), null);
  const first = new Date(y.year, 0, 1), last = new Date(y.year, 11, 31);
  const end = now < last ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : last;
  const days = now < first ? 0 : Math.round((end.getTime() - first.getTime()) / 86_400_000) + 1;
  const noSpend = Math.max(days - [...perDay.values()].filter((d) => d.date <= end).length, 0);

  const equityEnd = y.equityByMonth[11] ?? y.equityStart;
  const inv = y.investments;

  return {
    year: y.year,
    ...tot,
    savingsRate: tot.income > 0 ? tot.saved / tot.income : 0,
    lastYear: before && { ...before, savingsRate: before.income > 0 ? before.saved / before.income : 0 },
    savedByMonth: saved,
    best,
    toughest,
    plusMonths,
    activeMonths: used.length,
    top,
    biggest,
    equityStart: y.equityStart,
    equityEnd,
    equityChange: equityEnd - y.equityStart,
    equityByMonth: y.equityByMonth,
    investments: inv && inv.start > 0 ? { ...inv, change: inv.end - inv.start, share: inv.end / inv.start - 1 } : null,
    facts: { expenses: y.expenses.length, topDay, noSpend, closes: y.closes, badges: y.badges },
  };
}

export type YearWrap = ReturnType<typeof yearWrapped>;

/** The savings goals offered for next year: this year's savings, and 10%
 *  and 20% more — rounded to a friendly amount. Nothing when nothing was saved. */
export function nextYearGoals(saved: number) {
  if (saved <= 0) return [];
  const round = (v: number) => {
    const step = v >= 10_000 ? 500 : v >= 1_000 ? 100 : 10;
    return Math.round(v / step) * step;
  };
  return [...new Set([1, 1.1, 1.2].map((f) => round(saved * f)))];
}
