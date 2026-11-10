import { accountFlows, balanceSheet, live, num, spendByCategoryYear, summarize } from "./calc";
import { combined, perYear } from "./mortgage";
import { renewal, totals } from "./insurance";
import { homes } from "./realEstate";
import { CHECKIN_PREFIX } from "./checkin";
import { valueAt } from "./wrapped";
import { yearWrapped, type MonthTotals } from "./yearWrapped";
import type { Category, FinanceData, InsurancePolicy, YearClose } from "./types";

// Close the year — everything the year close needs, from the data. The
// app keeps each account's balance at the START of the year (the screens
// add each month on top), so closing the year also moves those balances on
// to the new year. Until it's closed, a year that has ended is told "as of
// its last second": the start balances still belong to it. After the close
// the start balances it had are kept with the close (profile.year_closes),
// so Year Wrapped can still be shown later.

export const YEAR_CLOSE_PREFIX = "year-close:";
export const YEAR_CLOSE_POINTS = 500;

const closeOf = (data: FinanceData, year: number) => (data.profile.year_closes ?? []).find((c) => c.year === year) ?? null;

/** The data as it was in `year`: a closed year gets back the account
 *  balances it started with. */
export function asOfYear(data: FinanceData, year: number): FinanceData {
  const c = closeOf(data, year);
  if (!c) return data;
  return { ...data, accounts: data.accounts.map((a) => (a.id in c.accounts_start ? { ...a, balance: String(c.accounts_start[a.id]) } : a)) };
}

/** "Now" for a year: its last second once it's over, else now. */
export const yearNow = (year: number, now: Date) => (year < now.getFullYear() ? new Date(year, 11, 31, 23, 59, 59) : now);

/** The year that can be closed: last year, once its December is closed and
 *  the year itself isn't yet. */
export function closableYear(data: FinanceData, now: Date): number | null {
  const year = now.getFullYear() - 1;
  const december = live(data.monthCloses ?? []).some((c) => c.month.slice(0, 7) === `${year}-12`);
  return december && !closeOf(data, year) ? year : null;
}

export const yearClosed = (data: FinanceData, year: number): YearClose | null => closeOf(data, year);

const months = (data: FinanceData, year: number): MonthTotals[] =>
  Array.from({ length: 12 }, (_, m) => {
    const s = summarize(data.transactions, new Date(year, m, 1));
    return { income: s.income, spent: s.spent, fixed: s.fixed, variable: s.variable };
  });

/** Last year's months: from its transactions, else from imported year
 *  totals spread evenly; null without anything. */
function lastYearMonths(data: FinanceData, year: number): MonthTotals[] | null {
  if (live(data.transactions).some((t) => new Date(t.date).getFullYear() === year)) return months(data, year);
  const income = (data.yearIncomeTotals ?? []).find((r) => r.year === year);
  const spent = (data.yearCategoryTotals ?? []).filter((r) => r.year === year).reduce((s, r) => s + num(r.amount), 0);
  if (!income && !spent) return null;
  const m = { income: num(income?.amount) / 12, spent: spent / 12, fixed: 0, variable: spent / 12 };
  return Array.from({ length: 12 }, () => ({ ...m }));
}

export function yearCloseData(source: FinanceData, year: number, now: Date) {
  const data = asOfYear(source, year);
  const at = yearNow(year, now);
  const lastMonth = year < now.getFullYear() ? 11 : now.getMonth();
  const tx = live(data.transactions).filter((t) => new Date(t.date).getFullYear() === year);
  const expenses = tx.filter((t) => t.type === "expense");

  // Equity at the end of each month (months still to come: as it stands now).
  const equityByMonth: number[] = [];
  for (let m = 0; m < 12; m++) equityByMonth.push(m <= lastMonth ? balanceSheet(data, at, new Date(year, m, 1)).equity : equityByMonth[m - 1]);
  const equityStart = balanceSheet(data, at, new Date(year - 1, 11, 1)).equity;

  // Investments: each holding from the year's start (or what was paid, if
  // bought during the year) to its value at the year's end.
  const start = new Date(year, 0, 1).getTime(), end = at.getTime();
  let invStart = 0, invEnd = 0, priced = 0;
  for (const h of live(data.holdings)) {
    const added = Date.parse(h.date_added) || 0;
    if (added > end) continue;
    const endV = valueAt(data, h, end);
    if (endV == null) continue;
    const startV = added >= start ? num(h.cost_basis) || endV : valueAt(data, h, start);
    if (startV == null) continue;
    invStart += startV;
    invEnd += endV;
    priced++;
  }

  const wrap = yearWrapped(
    {
      year,
      months: months(data, year),
      lastYear: lastYearMonths(data, year - 1),
      expenses: expenses.map((t) => ({ amount: num(t.amount), date: new Date(t.date), note: t.note, category_id: t.category_id, fixed: t.is_fixed_expense })),
      categories: spendByCategoryYear(data, year).filter((e) => !e.category.is_fixed_expense).map((e) => ({ id: e.category.id, spent: e.spent })),
      equityByMonth,
      equityStart,
      investments: priced ? { start: invStart, end: invEnd } : null,
      closes: live(data.monthCloses ?? []).filter((c) => c.month.startsWith(String(year))).length,
      badges: live(data.achievements ?? []).filter((a) => a.earned_at.startsWith(String(year)) && !a.code.startsWith(CHECKIN_PREFIX) && !a.code.startsWith(YEAR_CLOSE_PREFIX)).length,
    },
    at,
  );

  // For the tax return: the balance sheet on the last day of the year (the
  // stand on 1 January), the mortgage interest paid and the gross income.
  const sheet = balanceSheet(data, at, new Date(year, 11, 1));
  const mortgageInterest = homes(data).reduce((s, h) => s + (perYear(combined(h.parts)).find((r) => r.year === year)?.interest ?? 0), 0);
  const income = tx.filter((t) => t.type === "income");
  const tax = {
    assets: sheet.assets.filter((l) => Math.abs(l.value) > 0.005),
    liabilities: sheet.liabilities.filter((l) => Math.abs(l.value) > 0.005),
    totalAssets: sheet.totalAssets,
    totalDebt: sheet.totalDebt,
    equity: sheet.equity,
    mortgageInterest,
    hasHome: homes(data).length > 0,
    net: income.reduce((s, t) => s + num(t.amount), 0),
    gross: income.reduce((s, t) => s + num(t.gross_amount ?? t.amount), 0),
    grossKnown: income.some((t) => t.gross_amount != null),
    payslips: (data.documents ?? []).filter((d) => d.kind === "payslip" && d.month?.startsWith(String(year))).length,
  };

  // Yearly costs: fixed costs per category against the year before, and the
  // insurance policies coming up for renewal in the next twelve months.
  const fixedBy = (y: number) => {
    const out = new Map<string, number>(), months = new Set<number>();
    for (const t of live(data.transactions)) {
      if (t.type !== "expense" || !t.is_fixed_expense || new Date(t.date).getFullYear() !== y) continue;
      months.add(new Date(t.date).getMonth());
      const c = data.categories.find((x) => x.id === t.category_id);
      const top = c?.parent_id ? data.categories.find((x) => x.id === c.parent_id) ?? c : c;
      const k = top?.id ?? "";
      out.set(k, (out.get(k) ?? 0) + num(t.amount));
    }
    return { out, months: months.size };
  };
  // The year before only compares when it's (nearly) complete: a year that
  // began in November would show every fixed cost +1000%.
  const now_ = fixedBy(year), before_ = fixedBy(year - 1);
  const fixedNow = now_.out, fixedBefore = before_.months >= 10 ? before_.out : new Map<string, number>();
  const fixed = [...fixedNow.entries()]
    .map(([id, spent]) => ({ category: data.categories.find((c) => c.id === id) ?? null, spent, before: fixedBefore.get(id) ?? null }))
    .sort((a, b) => b.spent - a.spent);
  const policies = live(data.insurancePolicies ?? []);
  const input = (p: InsurancePolicy) => ({ kind: p.kind, premium: num(p.premium), period: p.period, deductible: num(p.deductible), renewalDate: p.renewal_date, noticeMonths: p.notice_months });
  const renewals = policies
    .map((p) => ({ policy: p, r: renewal(input(p), now) }))
    .filter((x): x is { policy: InsurancePolicy; r: NonNullable<ReturnType<typeof renewal>> } => !!x.r && x.r.daysToRenewal <= 366)
    .sort((a, b) => a.r.next.getTime() - b.r.next.getTime());
  const costs = { fixed, fixedTotal: [...fixedNow.values()].reduce((a, b) => a + b, 0), fixedBeforeTotal: fixedBefore.size ? [...fixedBefore.values()].reduce((a, b) => a + b, 0) : null, renewals, insurancePerYear: totals(policies.map(input)).perYear };

  // Opening balances for the new year: each account's start of the year
  // plus what came in and went out on it during the year.
  const flows = accountFlows(data, at);
  const accounts = live(data.accounts).map((a) => ({ account: a, start: num(a.balance), flow: flows.get(a.id) ?? 0, proposed: num(a.balance) + (flows.get(a.id) ?? 0) }));

  return { year, wrap, tax, costs, accounts, closed: closeOf(source, year) };
}

export type YearCloseData = ReturnType<typeof yearCloseData>;

/** A category by id, for the cards. */
export const categoryById = (data: FinanceData, id: string): Category | undefined => data.categories.find((c) => c.id === id);
