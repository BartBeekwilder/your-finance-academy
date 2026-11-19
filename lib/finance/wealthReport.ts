import { accountFlows, balanceSheet, live, num, summarize } from "./calc";
import { valueAt } from "./wrapped";
import type { FinanceData, Holding } from "./types";

// The monthly report's second page, "Your wealth" (Bart, 19 Nov): the
// investments one by one with their month in a small chart, the money on
// the accounts through the month, the balance sheet against the month
// before, and benchmarks — your own growth against the world market
// (an MSCI World ETF's price, fetched by the report page) for the month and
// the year so far. Ported to the apps later.

/** Price points [unix ms, price] of the benchmark (null while not loaded). */
export type BenchPoints = [number, number][] | null;

const priceAt = (pts: [number, number][], t: number) => {
  let v: number | null = null;
  for (const [pt, p] of pts) {
    if (pt > t) break;
    v = p;
  }
  return v;
};
const change = (a: number | null, b: number | null) => (a != null && b != null && Math.abs(a) > 0.005 ? b / a - 1 : null);

export type HoldingMonth = { holding: Holding; start: number | null; end: number | null; pct: number | null; series: number[] };

export function wealthMonth(data: FinanceData, month: Date, now: Date, bench: BenchPoints) {
  const y = month.getFullYear(), mo = month.getMonth();
  const first = new Date(y, mo, 1);
  const days = new Date(y, mo + 1, 0).getDate();
  const current = y === now.getFullYear() && mo === now.getMonth();
  const end = current ? now : new Date(y, mo, days, 23, 59, 59);
  const before = new Date(y, mo, 0, 23, 59, 59);
  const yearStart = new Date(y, 0, 0, 23, 59, 59); // 31 December before

  // Money on the accounts (not investment accounts), at the end of each day.
  const accounts = live(data.accounts).filter((a) => a.type !== "investment");
  // Balances are kept as on 1 January of this year: an earlier moment
  // reads as that (the books have no account history before it).
  const liquidAt = (at: Date) => {
    if (at.getFullYear() < now.getFullYear()) return accounts.reduce((s, a) => s + num(a.balance), 0);
    const f = accountFlows(data, at);
    return accounts.reduce((s, a) => s + num(a.balance) + (f.get(a.id) ?? 0), 0);
  };
  const lastDay = current ? now.getDate() : days;
  const liquidity = Array.from({ length: lastDay }, (_, i) => liquidAt(i + 1 === lastDay ? end : new Date(y, mo, i + 1, 23, 59, 59)));
  const liqStart = mo === 0 ? accounts.reduce((s, a) => s + num(a.balance), 0) : liquidAt(before);

  // Investments one by one: their value through the month (market prices).
  const holdings: HoldingMonth[] = live(data.holdings).map((h) => {
    const pts = data.market?.[h.id] ?? [];
    const added = new Date(h.date_added);
    const start = added > before ? (h.cost_basis != null ? num(h.cost_basis) : valueAt(data, h, added.getTime())) : valueAt(data, h, before.getTime());
    const endV = valueAt(data, h, end.getTime());
    const series = pts.filter(([t]) => t > before.getTime() && t <= end.getTime()).map(([, v]) => v);
    if (start != null) series.unshift(start);
    return { holding: h, start, end: endV, pct: change(start, endV), series };
  }).filter((x) => x.end != null).sort((a, b) => (b.end ?? 0) - (a.end ?? 0));
  const invStart = holdings.reduce((s, x) => s + (x.start ?? 0), 0);
  const invEnd = holdings.reduce((s, x) => s + (x.end ?? 0), 0);

  // The balance sheet at the end of this month and the one before.
  const sheet = balanceSheet(data, now, first);
  const prev = balanceSheet(data, now, new Date(y, mo - 1, 1));
  const lastYear = balanceSheet(data, now, new Date(y - 1, 11, 1));

  // Where the month's growth came from: kept from income + debt paid off, against the investments' gain.
  const s = summarize(data.transactions.filter((x) => new Date(x.date) <= end), first);
  const work = s.income - s.spent + Math.max(prev.totalDebt - sheet.totalDebt, 0);
  const invGain = invEnd - invStart;

  // Benchmarks: your equity and investments against the world market.
  const ytdInvStart = live(data.holdings).reduce((sum, h) => {
    const added = new Date(h.date_added);
    const v = added > yearStart ? (h.cost_basis != null ? num(h.cost_basis) : valueAt(data, h, added.getTime())) : valueAt(data, h, yearStart.getTime());
    return sum + (v ?? 0);
  }, 0);
  const market = bench?.length
    ? { month: change(priceAt(bench, before.getTime()), priceAt(bench, end.getTime())), year: change(priceAt(bench, yearStart.getTime()), priceAt(bench, end.getTime())) }
    : null;

  return {
    days,
    liquidity,
    liqStart,
    liqEnd: liquidity.at(-1) ?? liqStart,
    holdings,
    invStart,
    invEnd,
    invPct: change(invStart, invEnd),
    sheet: { assets: sheet.totalAssets, debts: sheet.totalDebt, equity: sheet.equity },
    prev: { assets: prev.totalAssets, debts: prev.totalDebt, equity: prev.equity },
    equityPct: change(prev.equity, sheet.equity),
    equityYear: change(lastYear.equity, sheet.equity),
    invYear: change(ytdInvStart, invEnd),
    savingsRate: s.income > 0 ? (s.income - s.spent) / s.income : null,
    work,
    invGain,
    fromWork: work + Math.max(invGain, 0) > 0.005 ? Math.max(work, 0) / (Math.max(work, 0) + Math.max(invGain, 0)) : null,
    market,
  };
}

export type WealthMonth = ReturnType<typeof wealthMonth>;

/** The annual report's wealth page: each month's growth against the world
 *  market, and the year so far (months still to come are left out). */
export function wealthYear(data: FinanceData, year: number, now: Date, bench: BenchPoints) {
  const last = year < now.getFullYear() ? 11 : year === now.getFullYear() ? now.getMonth() : -1;
  const months = Array.from({ length: last + 1 }, (_, m) => {
    const w = wealthMonth(data, new Date(year, m, 1), now, bench);
    return { m, equity: w.sheet.equity, equityPct: w.equityPct, inv: w.invEnd, invPct: w.invPct, market: w.market?.month ?? null, liq: w.liqEnd, liqStart: w.liqStart, hasInv: w.holdings.length > 0 };
  });
  const end = months.at(-1);
  const final = end ? wealthMonth(data, new Date(year, end.m, 1), now, bench) : null;
  return {
    months,
    hasInv: months.some((x) => x.hasInv),
    equityYear: final?.equityYear ?? null,
    invYear: final?.invYear ?? null,
    marketYear: final?.market?.year ?? null,
    liqStart: months[0]?.liqStart ?? 0,
  };
}

export type WealthYear = ReturnType<typeof wealthYear>;
