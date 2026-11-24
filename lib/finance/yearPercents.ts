import { balanceSheet, live, netWorthFigures, num } from "./calc";
import { summarize as summarizePart } from "./mortgage";
import { investmentsValue } from "./quotes";
import { homes } from "./realEstate";
import type { FinanceData, Transaction } from "./types";

// Key figures › "This year in percent" (Bart, 24 Nov): how this year is going
// against last year, each tile on the same period (1 January to today, and
// last year up to the same day) so half a year isn't set against a whole one.
// Without transactions for last year's period, the imported year totals
// stand in, pro rata to today. Ported 1:1 to the apps (YearPercents.swift).

export type YearTile = {
  key: string;
  label: string;
  /** "pct": a change (0.12 = +12%); "share": a part of a whole (0.2 = 20%, no sign);
   *  "pts": percentage points (0.04 = +4); "money": an amount. */
  unit: "pct" | "share" | "pts" | "money";
  value: number;
  tone: "good" | "bad" | "neutral";
  note: string;
  /** Amounts for the note's {placeholders} (formatted as money). */
  money?: Record<string, number>;
  /** Other placeholders (already text). */
  text?: Record<string, string>;
  /** Placeholders that are a change in percent (formatted signed, in the language). */
  pct?: Record<string, number>;
};

const DAY = 86_400_000;

export function yearPercents(data: FinanceData, now: Date): YearTile[] {
  const y = now.getFullYear();
  const jan = new Date(y, 0, 1), lyJan = new Date(y - 1, 0, 1);
  const lyNow = new Date(y - 1, now.getMonth(), Math.min(now.getDate(), new Date(y - 1, now.getMonth() + 1, 0).getDate()), now.getHours(), now.getMinutes());
  // How much of last year had passed by this day: for imported totals.
  const part = (lyNow.getTime() - lyJan.getTime()) / (new Date(y, 0, 1).getTime() - lyJan.getTime());
  const tx = live(data.transactions).filter((t) => !t.advance);
  const fixedCat = new Set(live(data.categories).filter((c) => c.is_fixed_expense).map((c) => c.id));
  const sum = (from: Date, to: Date, keep: (t: Transaction) => boolean) =>
    tx.filter((t) => { const d = new Date(t.date); return d >= from && d <= to && keep(t); }).reduce((s, t) => s + num(t.amount), 0);
  const isIncome = (t: Transaction) => t.type === "income";
  const isSpend = (t: Transaction) => t.type === "expense";
  const isFixed = (t: Transaction) => t.type === "expense" && t.is_fixed_expense;
  const imported = (rows: { year: number; amount: unknown; category_id?: string | null }[] | undefined, keep: (r: { category_id?: string | null }) => boolean = () => true) =>
    (rows ?? []).filter((r) => r.year === y - 1 && keep(r)).reduce((s, r) => s + num(r.amount as never), 0) * part;
  const pair = (keep: (t: Transaction) => boolean, fallback: () => number) => {
    const cur = sum(jan, now, keep);
    const before = sum(lyJan, lyNow, keep);
    return { cur, prev: before > 0 ? before : fallback() };
  };
  const out: YearTile[] = [];
  const vs = (key: string, label: string, p: { cur: number; prev: number }, lowerIsBetter: boolean) => {
    if (!(p.prev > 0) || !(p.cur > 0)) return;
    const change = p.cur / p.prev - 1;
    out.push({ key, label, unit: "pct", value: change, tone: Math.abs(change) < 0.005 ? "neutral" : (change < 0) === lowerIsBetter ? "good" : "bad", note: "{now} so far, against {then} by this day last year.", money: { now: p.cur, then: p.prev } });
  };

  // 1. Investments: the market since 1 January, new money left out.
  if (data.market && live(data.holdings).length) {
    const start = investmentsValue(data, new Date(jan.getTime() - 1)).total;
    const value = investmentsValue(data, now).total;
    const putIn = live(data.holdings).filter((h) => Date.parse(h.date_added) >= jan.getTime()).reduce((s, h) => s + num(h.cost_basis), 0);
    const base = start + putIn, gain = value - start - putIn;
    if (base > 1) out.push({ key: "invest", label: "Investments this year", unit: "pct", value: gain / base, tone: gain >= 0 ? "good" : "bad", note: "{amount} from the market since 1 January, new money not counted.", money: { amount: gain } });
  }

  // 2–4. Income, spending, fixed costs against last year's same period.
  const income = pair(isIncome, () => imported(data.yearIncomeTotals));
  const spending = pair(isSpend, () => imported(data.yearCategoryTotals));
  const fixed = pair(isFixed, () => imported(data.yearCategoryTotals, (r) => !!r.category_id && fixedCat.has(r.category_id)));
  vs("income", "Income vs last year", income, false);
  vs("spending", "Spending vs last year", spending, true);
  vs("fixed", "Fixed costs vs last year", fixed, true);

  // 5. Savings rate, in percentage points.
  if (income.cur > 0 && income.prev > 0) {
    const a = (income.cur - spending.cur) / income.cur, b = (income.prev - spending.prev) / income.prev;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    out.push({ key: "rate", label: "Savings rate vs last year", unit: "pts", value: a - b, tone: Math.abs(a - b) < 0.005 ? "neutral" : a > b ? "good" : "bad", note: "{now} so far, against {then} by this day last year.", text: { now: pct(a), then: pct(b) } });
  }

  // 6. Equity since 1 January.
  const e0 = balanceSheet(data, now, new Date(y - 1, 11, 1)).equity;
  const e1 = balanceSheet(data, now, new Date(y, now.getMonth(), 1)).equity;
  if (e0 !== 0 || e1 !== 0) {
    const d = e1 - e0;
    out.push(e0 > 1
      ? { key: "equity", label: "Equity since January", unit: "pct", value: d / e0, tone: d >= 0 ? "good" : "bad", note: "{amount} since 1 January.", money: { amount: d } }
      : { key: "equity", label: "Equity since January", unit: "money", value: d, tone: d >= 0 ? "good" : "bad", note: "From {then} on 1 January.", money: { then: e0 } });
  }

  // 7. Liquidity since 1 January (the dashboard's live number).
  const nw = netWorthFigures(data, now);
  const liq = nw.base + nw.liveChange(now.getTime());
  if (nw.startOfYear > 1) {
    const d = liq - nw.startOfYear;
    out.push({ key: "liquidity", label: "Liquidity since January", unit: "pct", value: d / nw.startOfYear, tone: d >= 0 ? "good" : "bad", note: "{amount} since 1 January.", money: { amount: d } });
  }

  // 8. Mortgage: how much of it is paid off, and what this year took off.
  const parts = homes(data).flatMap((h) => h.parts);
  const principal = parts.reduce((s, p) => s + p.principal, 0);
  if (principal > 0) {
    const bal = (at: Date) => parts.reduce((s, p) => s + (at < p.start ? p.principal : summarizePart(p, at).balance), 0);
    const nowBal = bal(now), janBal = bal(new Date(jan.getTime() - 1));
    out.push({ key: "mortgage", label: "Mortgage paid off", unit: "share", value: 1 - nowBal / principal, tone: "good", note: "{amount} paid off this year.", money: { amount: Math.max(janBal - nowBal, 0) } });
  }

  // 9. Home value since purchase, and per year.
  const bought = homes(data).filter((h) => h.property.purchase_date && num(h.property.purchase_price) > 0);
  if (bought.length) {
    const price = bought.reduce((s, h) => s + num(h.property.purchase_price), 0);
    const value = bought.reduce((s, h) => s + num(h.property.value), 0);
    const first = Math.min(...bought.map((h) => Date.parse(h.property.purchase_date!)));
    const years = Math.max((now.getTime() - first) / (365.25 * DAY), 0.5);
    const total = value / price - 1, perYear = Math.pow(value / price, 1 / years) - 1;
    out.push({ key: "home", label: "Home value", unit: "pct", value: total, tone: total >= 0 ? "good" : "bad", note: "{pct} a year since you bought it.", pct: { pct: perYear } });
  }

  // 10. Equity growth per year since the first year-end stand.
  const snaps = (data.yearSnapshots ?? []).filter((s) => s.year < y).sort((a, b) => a.year - b.year);
  if (snaps.length) {
    const s0 = snaps[0], start = num(s0.assets) - num(s0.liabilities);
    const years = Math.max((now.getTime() - new Date(s0.year, 11, 31).getTime()) / (365.25 * DAY), 0.5);
    out.push(start > 1 && e1 > 0
      ? { key: "growth", label: "Equity growth per year", unit: "pct", value: Math.pow(e1 / start, 1 / years) - 1, tone: e1 >= start ? "good" : "bad", note: "On average since {year}, from your year-end figures.", text: { year: String(s0.year) } }
      : { key: "growth", label: "Equity growth per year", unit: "money", value: (e1 - start) / years, tone: e1 >= start ? "good" : "bad", note: "On average since {year}, from your year-end figures.", text: { year: String(s0.year) } });
  }
  return out;
}

/** Where the money model's market sliders start (Bart, 24 Nov: "my last 12
 *  months"): the stock market at what your own investments did over the last
 *  twelve months (new money left out), the housing market at your home's
 *  growth per year since you bought it — in whole percents, null when unknown.
 *  Ported 1:1 to the apps (YearPercents.ownMarkets). */
export function ownMarkets(data: FinanceData, now: Date): { market: number | null; housing: number | null } {
  let market: number | null = null;
  const held = live(data.holdings);
  if (data.market && held.length) {
    const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const before = held.filter((h) => Date.parse(h.date_added) <= from.getTime());
    const start = before.length ? investmentsValue({ ...data, holdings: before }, from).total : 0;
    const putIn = held.filter((h) => Date.parse(h.date_added) > from.getTime()).reduce((s, h) => s + num(h.cost_basis), 0);
    const value = investmentsValue(data, now).total;
    if (start + putIn > 1) market = Math.round(((value - start - putIn) / (start + putIn)) * 100);
  }
  let housing: number | null = null;
  const bought = homes(data).filter((h) => h.property.purchase_date && num(h.property.purchase_price) > 0);
  if (bought.length) {
    const price = bought.reduce((s, h) => s + num(h.property.purchase_price), 0);
    const value = bought.reduce((s, h) => s + num(h.property.value), 0);
    const first = Math.min(...bought.map((h) => Date.parse(h.property.purchase_date!)));
    const years = Math.max((now.getTime() - first) / (365.25 * DAY), 0.5);
    housing = Math.round((Math.pow(value / price, 1 / years) - 1) * 100);
  }
  return { market, housing };
}
