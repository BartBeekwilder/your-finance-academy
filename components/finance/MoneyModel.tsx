"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { ownMarkets } from "@/lib/finance/yearPercents";
import { balanceSheet, balanceYears, expectedByCategory, live, liveFixed, netWorthFigures, projectedNetIncome, spendByCategoryYear, summarize } from "@/lib/finance/calc";
import { ALL, compareYears } from "@/lib/finance/compare";
import { investmentsValue } from "@/lib/finance/quotes";
import { homes } from "@/lib/finance/realEstate";
import { summarize as summarizePart } from "@/lib/finance/mortgage";
import { money } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import Segmented from "./Segmented";

// Dashboard › Money model (Bart, 19 Nov 2026): how income, spending,
// repayment and the markets move equity, on the user's own books — drawn by
// public/moneymodel.js (shared with the homepage's sun model) as a money
// flow, a wealth building or a gravity model, with levers beside it.

type View = "flow" | "build" | "grav" | "time";
type Levers = { inc: number; sp: number; mkt: number; house: number; months: number };
type Debt = { label: string; value: number };
type Layer = { label: string; value: number };
type Base = {
  income: number; fixed: number; repay: number; variable: number; cash: number; invest: number; home: number; mortgage: number; otherDebt: number; otherDebts?: Debt[];
  // Looking back: the markets' real moves, today's real stand, the captions.
  // The solar system: what each planet is made of (Bart, 20 Nov). Flows are
  // weights (scaled to the period), investments their values.
  layers?: { income?: Layer[]; spending?: Layer[]; repayment?: Layer[]; investments?: Layer[] };
  marketMove?: number; homeMove?: number; end?: { cash: number; invest: number; home: number; mortgage: number; otherDebts: Debt[] }; capMonth?: string; capAfter?: string;
};
type Mode = "ahead" | "back";
type Model = { equity: number; eqNow: number; n: number; parts: { key: string; v: number; c: string }[] };
type Engine = {
  setLevers: (l: Partial<Levers>) => void;
  setBase: (b: Base) => void;
  setView: (v: View) => View;
  setYears: (y: TimeYear[]) => void;
  setYear: (i: number) => void;
  setTimeMode: (m: "source" | "balance") => void;
  onModel: (f: (m: Model) => void) => () => void;
  destroy: () => void;
};
declare global {
  interface Window {
    PFMoneyModel?: { create: (opts: Record<string, unknown>) => Engine };
  }
}

/** The month (as expected) and the balances as they stand today. */
export function moneyModelBase(data: FinanceData, now: Date): Base {
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const nw = netWorthFigures(data, now);
  // A usual month on the app's ONE expected rule (expectedByCategory, as
  // Expenses and Budgets): fixed costs for the whole month — what's booked,
  // what's still to book this month, never less than they usually are — and
  // the usual variable spending (average of the finished months; this
  // month's one-offs would otherwise be multiplied by the period).
  const expected = [...expectedByCategory(data, month, now).values()];
  // Fixed costs for the whole month: booked + still to come, the usual amount only where nothing is booked yet.
  const fixedAll = Math.max(liveFixed(data, now), expected.reduce((t, e) => t + e.fixedMonth, 0));
  const usualVar = expected.reduce((t, e) => t + e.usualVar, 0);
  const variable = usualVar > 0 ? usualVar : expected.reduce((t, e) => t + Math.max(e.expected - e.fixedMonth, 0), 0);
  // The mortgage's repayment this month: part of the payment, but it lowers
  // the debt instead of leaving (equity stays; it moves from money to home).
  // A usual month: the scheduled repayment, not one-off extras booked this
  // month (those lower the debt — the balances below — but aren't usual).
  const repay = homes(data).reduce((t, h) => t + h.parts.reduce((s, p) => {
    const row = summarizePart({ ...p, lumps: [] }, now).thisMonth;
    return s + (row ? row.repayment + row.extra : 0);
  }, 0), 0);
  const repayIn = Math.min(repay, fixedAll);
  const st = stand(balanceSheet(data, now, month), nw.holdingsTotal);
  return {
    income: projectedNetIncome(data, month) || nw.projected,
    fixed: fixedAll - repayIn,
    repay: repayIn,
    variable,
    ...st,
    layers: planetLayers(data, now),
  };
}

/** What the solar system's planets are made of: income and spending per
 *  category (the last twelve months / this year), the repayment per mortgage
 *  part, each holding at its market value (else what was paid). */
function planetLayers(data: FinanceData, now: Date): NonNullable<Base["layers"]> {
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const top = (id: string | null | undefined) => { const c = id ? cats.get(id) : undefined; const p = c?.parent_id ? cats.get(c.parent_id) : c; return p?.name ?? t("No category"); };
  const since = new Date(now.getFullYear() - 1, now.getMonth(), 1).getTime();
  const income = new Map<string, number>();
  for (const x of live(data.transactions)) {
    if (x.type !== "income" || new Date(x.date).getTime() < since) continue;
    const k = top(x.category_id);
    income.set(k, (income.get(k) ?? 0) + Number(x.amount));
  }
  const spending = spendByCategoryYear(data, now).map((r) => ({ label: r.category.name, value: r.spent }));
  const repayment = homes(data).flatMap((h) => h.parts.map((p) => ({ label: p.name || t("Mortgage"), value: (() => { const row = summarizePart({ ...p, lumps: [] }, now).thisMonth; return row ? row.repayment + row.extra : 0; })() })));
  const investments = live(data.holdings).map((h) => {
    const pts = data.market?.[h.id];
    return { label: h.name || h.symbol, value: pts?.length ? pts[pts.length - 1][1] : Number(h.cost_basis ?? 0) };
  });
  return { income: [...income].map(([label, value]) => ({ label, value })), spending, repayment, investments };
}

/** A balance sheet as the model's stand: home, investments, everything else
 *  you own (accounts, a car, prepaid — what makes the sheet add up), the
 *  mortgage, and every other debt on its own line. */
function stand(bs: ReturnType<typeof balanceSheet>, invest: number) {
  const home = bs.assets.filter((a) => a.id.startsWith("property-")).reduce((t, a) => t + a.value, 0);
  const mortgage = bs.liabilities.filter((l) => l.id.startsWith("mortgage-")).reduce((t, l) => t + l.value, 0);
  const otherDebts = bs.liabilities.filter((l) => !l.id.startsWith("mortgage-") && l.value > 0.5).map((l) => ({ label: l.name, value: l.value }));
  return { cash: bs.totalAssets - home - invest, invest, home, mortgage, otherDebt: otherDebts.reduce((t, d) => t + d.value, 0), otherDebts };
}

type Stand = ReturnType<typeof stand>;

/** A year-end from Balance over time › Years (imported year-end totals,
 *  homes between purchase and today, mortgages on schedule, investments at
 *  market or cost) as the model's stand. */
function yearStand(by: ReturnType<typeof balanceYears>, year: number): Stand | null {
  const i = by.years.indexOf(year);
  if (i < 0) return null;
  const at = (s: { values: number[] }) => s.values[i] ?? 0;
  const home = by.assets.filter((a) => a.id.startsWith("property-")).reduce((t, a) => t + at(a), 0);
  const invest = by.assets.filter((a) => a.id === "investments").reduce((t, a) => t + at(a), 0);
  const cash = by.assets.reduce((t, a) => t + at(a), 0) - home - invest;
  const debts = by.funding.filter((f) => f.id !== "equity");
  const mortgage = debts.filter((f) => f.id.startsWith("mortgage-")).reduce((t, f) => t + at(f), 0);
  const otherDebts = debts.filter((f) => !f.id.startsWith("mortgage-") && at(f) > 0.5).map((f) => ({ label: f.name, value: at(f) }));
  return { cash, invest, home, mortgage, otherDebt: otherDebts.reduce((t, d) => t + d.value, 0), otherDebts };
}

/** A period to look back on: one calendar year (`from` = `to`), this year so
 *  far (= now's year), or everything since `from` (to = now's year). */
export type LookBack = { from: number; to: number };

/** The periods there's data for: this year so far, every earlier year whose
 *  start and end are known (imported year-end stands), and "all since" the
 *  first of them. */
export function lookBackPeriods(data: FinanceData, now: Date): { key: string; label: string; p: LookBack }[] {
  const y0 = now.getFullYear();
  const snaps = new Set((data.yearSnapshots ?? []).map((s) => s.year).filter((y) => y < y0));
  const out = [{ key: "now", label: t("This year so far"), p: { from: y0, to: y0 } }];
  for (let y = y0 - 1; y > y0 - 30; y--) if (snaps.has(y) && snaps.has(y - 1)) out.push({ key: String(y), label: String(y), p: { from: y, to: y } });
  const first = Math.min(...snaps);
  if (Number.isFinite(first) && first + 1 < y0) out.push({ key: "all", label: t("All since {year}", { year: first + 1 }), p: { from: first + 1, to: y0 } });
  return out;
}

/** A period as it really went: the balance sheet at its start and end (today
 *  for this year), the income and spending in between (this year: booked;
 *  earlier years: booked plus the imported year totals — per month on
 *  average), what the mortgage really went down, what the markets did. What
 *  the books don't explain shows as Other changes. */
export function lookBackBase(data: FinanceData, now: Date, p: LookBack) {
  const y0 = now.getFullYear(), cur = now.getMonth();
  const by = balanceYears(data, now);
  const start = p.from === y0
    ? stand(balanceSheet(data, now, new Date(y0 - 1, 11, 1)), investmentsValue(data, new Date(y0 - 1, 11, 31, 23, 59)).total)
    : yearStand(by, p.from - 1);
  const end = p.to === y0 ? stand(balanceSheet(data, now, new Date(y0, cur, 1)), investmentsValue(data, now).total) : yearStand(by, p.to);
  if (!start || !end) return null;
  // Income and spending per year: earlier years as Compare sees them (the
  // year's transactions, then the imported total's remainder); this year
  // what's booked so far. Fixed or variable follows the category.
  const fixedCat = new Map(data.categories.map((c) => [c.id, c.is_fixed_expense]));
  const back = y0 - p.from;
  const spend = compareYears(data, now, { back, type: "expense" });
  const inc = compareYears(data, now, { back, type: "income" }).get(ALL) ?? [];
  let income = 0, fixed = 0, variable = 0, n = 0;
  for (let y = p.from; y <= p.to; y++) {
    if (y === y0) {
      for (let m = 0; m <= cur; m++) {
        const s = summarize(data.transactions, new Date(y, m, 1));
        income += s.income; fixed += s.fixed; variable += s.variable;
      }
      n += cur + 1;
      continue;
    }
    const total = (row?: { year: number; values: (number | null)[] }[]) => (row?.find((r) => r.year === y)?.values ?? []).reduce<number>((a, b) => a + (b ?? 0), 0);
    income += total(inc);
    for (const [key, rows] of spend) {
      if (key === ALL) continue;
      const v = total(rows);
      if (fixedCat.get(key)) fixed += v; else variable += v;
    }
    n += 12;
  }
  // A home bought within the period: its price isn't the housing market.
  const fromT = new Date(p.from, 0, 1).getTime();
  const toT = p.to === y0 ? now.getTime() : new Date(p.to, 11, 31, 23, 59).getTime();
  // Repayments booked in the period (mortgage or loan): not spending, they
  // left the money and made a debt smaller. The rest of what the mortgage
  // went down was the repayment part of its payments (in the fixed costs).
  const booked = (data.repayments ?? []).filter((x) => Date.parse(x.date) >= fromT && Date.parse(x.date) <= toT);
  const partIds = new Set(homes(data).flatMap((h) => h.parts.map((x) => x.id)));
  const bookedAll = booked.reduce((tt, x) => tt + Number(x.amount), 0);
  const bookedMortgage = booked.filter((x) => partIds.has(x.repays ?? "")).reduce((tt, x) => tt + Number(x.amount), 0);
  const repaid = Math.max(start.mortgage - end.mortgage - bookedMortgage, 0);
  const bought = homes(data).reduce((t, h) => {
    const d = h.property.purchase_date ? Date.parse(h.property.purchase_date) : NaN;
    return t + (d >= fromT && d <= toT ? Number(h.property.purchase_price ?? h.property.value) || 0 : 0);
  }, 0);
  // Holdings bought within the period (before price history they're at cost):
  // money put in, not the market. This year both ends use today's quantities.
  const putIn = p.from === y0 ? 0 : data.holdings.filter((h) => !h.deleted_at && Date.parse(h.date_added) >= fromT && Date.parse(h.date_added) <= toT).reduce((t, h) => t + (Number(h.cost_basis) || 0), 0);
  return {
    months: n,
    base: {
      ...start,
      income: income / n,
      // The mortgage payments are in the fixed costs; their repayment part
      // made the debt smaller instead of leaving.
      fixed: Math.max(fixed - repaid, 0) / n,
      repay: (Math.min(repaid, fixed) + bookedAll) / n,
      variable: variable / n,
      marketMove: end.invest - start.invest - putIn,
      homeMove: end.home - start.home - bought,
      end: { cash: end.cash, invest: end.invest, home: end.home, mortgage: end.mortgage, otherDebts: end.otherDebts },
      capMonth: t("PER MONTH, ON AVERAGE"),
      capAfter: p.to === y0 ? t("TODAY") : t("31 DEC {year}", { year: p.to }),
    } as Base,
  };
}

/** One year of the time machine: where equity stood at the end, what that
 *  year added from each source, what you owned and owed at its end, and
 *  whether it's a forecast. */
export type TimeYear = {
  year: number; equity: number; debts: number; start: number; forecast?: boolean;
  /** Moments to mark in front of the tower (a home bought that year). */
  events?: { kind: "home"; name: string; price: number; date: string }[];
  assets: { home: number; invest: number; cash: number };
  parts: { work: number; repay: number; market: number; housing: number; other: number };
};

/** Every year there's data for, oldest first, chained so each year starts
 *  where the one before ended (any gap between two stands goes to Other). */
export function timeline(data: FinanceData, now: Date): TimeYear[] {
  const years = lookBackPeriods(data, now).filter((p) => p.p.from === p.p.to).map((p) => p.p.from).sort((a, b) => a - b);
  const out: TimeYear[] = [];
  let running: number | null = null;
  for (const y of years) {
    const lb = lookBackBase(data, now, { from: y, to: y });
    if (!lb) continue;
    const b = lb.base, e = b.end!;
    const start = b.cash + b.invest + b.home - b.mortgage - (b.otherDebts ?? []).reduce((t, d) => t + d.value, 0);
    const equity = e.cash + e.invest + e.home - e.mortgage - e.otherDebts.reduce((t, d) => t + d.value, 0);
    const n = lb.months;
    const work = (b.income - b.fixed - b.repay - b.variable) * n, repay = b.repay * n;
    const market = b.marketMove ?? 0, housing = b.homeMove ?? 0;
    const from = running ?? start;
    out.push({
      year: y, equity, start: from,
      debts: e.mortgage + e.otherDebts.reduce((t, d) => t + d.value, 0),
      assets: { home: e.home, invest: e.invest, cash: e.cash },
      parts: { work, repay, market, housing, other: equity - from - work - repay - market - housing },
    });
    running = equity;
  }
  // A home bought in one of these years gets a little house in front of it.
  for (const h of homes(data)) {
    const d = h.property.purchase_date;
    if (!d) continue;
    const y = out.find((x) => x.year === new Date(d).getFullYear());
    if (y) (y.events ??= []).push({ kind: "home", name: h.property.name || t("Home"), price: Number(h.property.purchase_price ?? h.property.value) || 0, date: d });
  }
  return out;
}

/** The years ahead, as the model expects them: a usual year (the usual month
 *  × 12, as Ahead), the mortgage on its real schedule, other debts as they
 *  are, the markets at the chosen % a year. Starts from today's stand. */
export function forecastYears(data: FinanceData, now: Date, base: Base, last: TimeYear | undefined, mkt: number, house: number, count = 5): TimeYear[] {
  const y0 = now.getFullYear();
  const parts = homes(data).flatMap((h) => h.parts);
  const mortgageAt = (d: Date) => parts.reduce((t, p) => t + summarizePart(p, d).balance, 0);
  let cash = base.cash, invest = base.invest, home = base.home;
  let mortgage = base.mortgage;
  const other = base.otherDebt;
  let equity = last?.equity ?? cash + invest + home - mortgage - other;
  const yearSpend = (base.income - base.fixed - base.variable) * 12;
  const out: TimeYear[] = [];
  for (let i = 1; i <= count; i++) {
    const end = new Date(y0 + i, 11, 31, 23, 59);
    const nextMortgage = parts.length ? Math.max(mortgageAt(end), 0) : mortgage;
    const repay = Math.max(mortgage - nextMortgage, 0);
    const work = yearSpend - repay;
    const market = invest * (mkt / 100), housing = home * (house / 100);
    cash += work; invest += market; home += housing; mortgage = nextMortgage;
    const next = cash + invest + home - mortgage - other;
    out.push({
      year: y0 + i, forecast: true, start: equity, equity: next, debts: mortgage + other,
      assets: { home, invest, cash },
      parts: { work, repay, market, housing, other: next - equity - work - repay - market - housing },
    });
    equity = next;
  }
  return out;
}

/** Loads the shared drawing script once. */
let loading: Promise<void> | null = null;
function loadEngine() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.PFMoneyModel) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/moneymodel.js?v=13";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("moneymodel.js did not load"));
    document.head.appendChild(s);
  });
  return loading;
}

export function moneyModelTexts() {
  return {
    income: t("Income"), yourMonth: t("Your month"), fixed: t("Fixed costs"), variable: t("Variable"), repayment: t("Repayment"),
    leftOver: t("Left over"), market: t("Stock market"), housing: t("Housing market"), cash: t("Money & other assets"),
    investments: t("Investments"), home: t("Home"), assets: t("Assets"), equity: t("Equity"), debts: t("Debts"), spent: t("Spent"),
    spending: t("Spending"), mortgage: t("Mortgage"), otherDebt: t("Other debts"),
    perMonth: t("{amount} a month"), capMonth: t("A USUAL MONTH"), capAfter: t("AFTER THE PERIOD"), capResult: t("RESULT"),
    hintFlow: t("Point at a stream or block for an explanation"), hint3d: t("Drag to turn · point at a block or planet"),
    tipIncome: t("What comes in this month. Everything you keep starts here."),
    tipMonth: t("All that comes in this month, and where it goes."),
    tipFixed: t("A usual month's fixed costs (booked plus still to come), without the repayment part of your mortgage — that one shows as Repayment. Gone is gone: this lowers your equity."),
    tipVariable: t("Groceries, going out, the car: the 'Variable spending' lever works here."),
    tipRepay: t("Leaves your account but makes your mortgage smaller. Your equity stays the same: it moves from money to home minus debt."),
    tipLeftOver: t("Income minus all spending and the repayment. It flows to your accounts every month."),
    tipMarket: t("The market moves your investments without you doing anything. Up: more equity. Down: less."),
    tipHousing: t("When your home gains or loses value, your equity moves with it. Your debt stays the same."),
    tipCash: t("After {n} months: what was there plus what you kept."),
    tipInvest: t("Your investments, at the price of the 'Stock market' lever."),
    tipHome: t("The value of your home. Usually the largest part of what you own."),
    tipAssets: t("Everything you own: money, investments and your home."),
    tipEquity: t("What you own minus what you owe. This is what's really yours."),
    tipDebts: t("Mortgage and other loans. Every repayment makes this smaller."),
    tipSpent: t("Spent in {n} months. This leaves your equity."),
    tipMortgage: t("The basement: your mortgage. Every repayment makes it shallower."),
    tipOtherDebt: t("Other loans, also part of the basement."),
    tipIncomePull: t("Pulls inwards: everything you earn over the period."),
    tipSpendingPush: t("Pushes outwards: fixed costs and variable spending over the period."),
    tipRepayPull: t("Pulls inwards: every repayment makes your debt smaller."),
    tipDebtsPush: t("Pushes outwards: your mortgage and other loans."),
    back: t("Back"),
    homeOwn: t("Your part of the home"),
    tmStart: t("Where you started"), tmWork: t("From work (income − spending)"), tmRepay: t("From repayment (less debt)"),
    tmMarket: t("From the stock market"), tmHousing: t("From the housing market"), tmOther: t("Not explained by your bookings"), tmLoss: t("Losses"),
    tmInYear: t("In {year}: {amount}"), tmLossNote: t("Takes this off your equity."),
    tmOwed: t("Financed with debt"), tmMine: t("Yours (equity)"), tmBought: t("Home bought"), tmExpected: t("expected"), tmSoFar: t("Up to and including this year."),
  };
}

const START: Levers = { inc: 0, sp: 0, mkt: 0, house: 0, months: 12 };

export default function MoneyModel({ data, now, currency }: { data: FinanceData; now: Date; currency: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [view, setView] = useState<View>("flow");
  // The markets start at your own: the last 12 months of your investments,
  // your home's growth per year (Bart, 24 Nov) — ownMarkets, as in the apps.
  const own = useMemo(() => ownMarkets(data, now), [data, now]);
  const clamp = (v: number | null, lo: number, hi: number) => (v == null ? 0 : Math.min(Math.max(v, lo), hi));
  const start = useMemo<Levers>(() => ({ ...START, mkt: clamp(own.market, -40, 40), house: clamp(own.housing, -20, 20) }), [own]);
  const [levers, setLevers] = useState<Levers>(start);
  const [model, setModel] = useState<Model | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("ahead");
  const ahead = useMemo(() => moneyModelBase(data, now), [data, now]);
  const periods = useMemo(() => lookBackPeriods(data, now), [data, now]);
  const [periodKey, setPeriodKey] = useState("now");
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];
  const back = useMemo(() => lookBackBase(data, now, period.p) ?? lookBackBase(data, now, periods[0].p)!, [data, now, period, periods]);
  const base = mode === "back" ? back.base : ahead;
  const y0 = now.getFullYear();
  // The time machine: a tower per year, oldest first; it plays itself once
  // when opened, then the slider or Play moves through the years.
  const past = useMemo(() => timeline(data, now), [data, now]);
  // The years ahead (glass towers): the usual year, the mortgage on schedule,
  // the markets at the chosen % a year.
  const [ahMkt, setAhMkt] = useState(() => clamp(own.market, -5, 12));
  const [ahHouse, setAhHouse] = useState(() => clamp(own.housing, -5, 10));
  const [tmMode, setTmMode] = useState<"source" | "balance">("balance");
  const years = useMemo(() => [...past, ...forecastYears(data, now, ahead, past[past.length - 1], ahMkt, ahHouse)], [past, data, now, ahead, ahMkt, ahHouse]);
  const nowIdx = Math.max(past.length - 1, 0);
  useEffect(() => engine.current?.setTimeMode(tmMode), [tmMode, view]);
  const [yearIdx, setYearIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => engine.current?.setYears(years), [years, view]);
  useEffect(() => engine.current?.setYear(yearIdx), [yearIdx, view]);
  // Play runs to today; started from today (or later) it runs on into the forecast.
  const [playTo, setPlayTo] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setYearIdx((i) => {
      if (i >= playTo) { setPlaying(false); return i; }
      return i + 1;
    }), 1100);
    return () => clearInterval(id);
  }, [playing, playTo]);
  const fmt = (x: number) => money(x, currency, { compact: Math.abs(x) >= 1_000_000 });
  const fmtRef = useRef(fmt);
  useEffect(() => {
    fmtRef.current = fmt;
  });

  // Start the drawing once; it keeps running until the tab closes.
  useEffect(() => {
    let off: (() => void) | undefined, gone = false;
    Promise.all([loadEngine(), import("three")])
      .then(([, THREE]) => {
        if (gone || !stageRef.current || !window.PFMoneyModel) return;
        const e = window.PFMoneyModel.create({ stage: stageRef.current, THREE, T: moneyModelTexts(), money: (x: number) => fmtRef.current(x), base, view: "flow" });
        engine.current = e;
        // Dev only: promo-video recordings drive the model (pf-marketing/scripts/record-web.mjs).
        if (process.env.NODE_ENV !== "production") (window as unknown as { __pfModel?: Engine }).__pfModel = e;
        e.setLevers(levers); // the markets' own start (ownMarkets)
        off = e.onModel((m) => setModel({ ...m, parts: [...m.parts] }));
      })
      .catch(() => setFailed(true));
    return () => {
      gone = true;
      off?.();
      engine.current?.destroy();
      engine.current = null;
    };
    // The base follows below; the drawing itself starts once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Looking back runs exactly the months of this year, without the levers.
  useEffect(() => {
    engine.current?.setBase(base);
    engine.current?.setLevers(mode === "back" ? { ...START, months: back.months } : levers);
    // levers apply through move(); here only the base and the mode switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, mode, back.months]);

  const pickView = (v: View) => {
    if (v === "time") {
      engine.current?.setYears(years);
      setYearIdx(0);
      engine.current?.setYear(0);
      setPlayTo(nowIdx);
      setPlaying(years.length > 1);
    } else setPlaying(false);
    setView(engine.current?.setView(v) ?? v);
  };
  const move = (k: keyof Levers, v: number) => {
    const next = { ...levers, [k]: v };
    setLevers(next);
    engine.current?.setLevers(next);
  };
  const reset = () => {
    setLevers(start);
    engine.current?.setLevers(start);
  };
  const pct = (v: number) => `${v > 0 ? "+" : ""}${v}%`;
  const LEVERS: { key: keyof Levers; label: string; hint: string; min: number; max: number; show: string }[] = [
    { key: "inc", label: t("Income"), hint: t("Your usual net income per month"), min: -30, max: 30, show: pct(levers.inc) },
    { key: "sp", label: t("Variable spending"), hint: t("Everything that isn't a fixed cost"), min: -30, max: 50, show: pct(levers.sp) },
    { key: "mkt", label: t("Stock market"), hint: own.market == null ? t("The price of your investments") : t("Starts at your own last 12 months: {pct}", { pct: pct(own.market) }), min: -40, max: 40, show: pct(levers.mkt) },
    { key: "house", label: t("Housing market"), hint: own.housing == null ? t("The value of your home") : t("Starts at your home's growth per year: {pct}", { pct: pct(own.housing) }), min: -20, max: 20, show: pct(levers.house) },
    { key: "months", label: t("Period"), hint: t("How many months run on"), min: 1, max: 60, show: levers.months === 1 ? t("1 month") : t("{n} months", { n: levers.months }) },
  ];
  const PART: Record<string, string> = {
    work: t("From work (income − spending)"),
    repay: t("From repayment (less debt)"),
    market: t("From the stock market"),
    housing: t("From the housing market"),
    other: t("Not explained by your bookings"),
  };
  const TM_KEYS = ["work", "repay", "market", "housing", "other"] as const;
  const TM_COLOR: Record<string, string> = { work: "#30d158", repay: "#40c8e0", market: "#b58cff", housing: "#5b8def", other: "#a3a9bb" };
  const tm = years[Math.min(yearIdx, years.length - 1)];
  const tmMax = tm ? Math.max(...TM_KEYS.map((k) => Math.abs(tm.parts[k])), 1) : 1;
  const maxPart = model ? Math.max(...model.parts.map((p) => Math.abs(p.v)), 1) : 1;

  return (
    <section className="pf-mm">
      <div className="pf-mm-head">
        <p className="pf-mm-lede">{t("How your income, spending, investments, home and debts make your equity together. Move the levers and see what moves.")}</p>
        <div className="pf-mm-switches">
          {view !== "time" && <Segmented label={t("Period")} value={mode} onChange={setMode} options={[{ value: "ahead", label: t("Ahead") }, { value: "back", label: t("Looking back") }]} />}
          <Segmented label={t("View")} value={view} onChange={pickView} options={[{ value: "flow", label: t("Money flow") }, { value: "time", label: t("Time machine") }, { value: "grav", label: t("Gravity") }]} />
        </div>
      </div>
      {periods.length > 1 && (
        <div className="pf-mm-fold" data-open={mode === "back" && view !== "time"} inert={mode !== "back" || view === "time"}>
          <div>
            <div className="pf-mm-periods" role="group" aria-label={t("Period")}>
              {periods.map((p) => (
                <button key={p.key} type="button" className="pf-chip" data-active={p.key === period.key || undefined} aria-pressed={p.key === period.key} onClick={() => setPeriodKey(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="pf-mm-main">
        <div className="pf-mm-stagewrap">
          <div ref={stageRef} className="pf-mm-stage">{failed && <p className="pf-mm-failed">{t("The model couldn't load. Reload the page to try again.")}</p>}</div>
          <div className="pf-mm-fold" data-open={view === "time" && years.length > 0} inert={view !== "time"}>
            <div>
              <Timeline
                years={years.map((y) => y.year)}
                nowAt={nowIdx}
                at={Math.min(yearIdx, Math.max(years.length - 1, 0))}
                playing={playing}
                onPick={(i) => { setPlaying(false); setYearIdx(i); }}
                onPlay={() => {
                  if (playing) return setPlaying(false);
                  // From today on, play into the forecast; at the end, start over.
                  if (yearIdx >= years.length - 1) { setYearIdx(0); setPlayTo(nowIdx); }
                  else setPlayTo(yearIdx >= nowIdx ? years.length - 1 : nowIdx);
                  setPlaying(true);
                }}
              />
            </div>
          </div>
        </div>
        <aside className="pf-mm-side">
          {view === "time" && tm && (
            <div className="pf-card pf-mm-card pf-mm-swap">
              <h3>{t("Time machine")}</h3>
              <Segmented label={t("View")} value={tmMode} onChange={setTmMode} options={[{ value: "balance", label: t("Owned and owed") }, { value: "source", label: t("Where it came from") }]} />
              <div className="pf-mm-tm-year">
                <b key={tm.year} className="pf-mm-swap">{tm.year}{tm.forecast && <em className="pf-mm-tm-tag">{t("expected")}</em>}</b>
                <span className="pf-rounded">{money(tm.equity, currency)}</span>
              </div>
              <span className="pf-mm-from">{t("{change} in {year}", { change: money(tm.equity - tm.start, currency, { signed: true }), year: tm.year })}</span>
              <div className="pf-mm-parts" key={tm.year}>
                {TM_KEYS.map((k) => (
                  <div key={k} className="pf-mm-part">
                    <span>{PART[k]}</span>
                    <span className="pf-rounded">{money(tm.parts[k], currency, { signed: true })}</span>
                    <i data-neg={tm.parts[k] < 0 || undefined} style={{ ["--w" as string]: `${(Math.abs(tm.parts[k]) / tmMax) * 50}%`, ["--c" as string]: TM_COLOR[k] }} />
                    {k === "other" && Math.abs(tm.parts[k]) >= 1 && <small className="pf-mm-part-note">{t("The difference between your balance sheet and your bookings: income or spending not entered, another value for things you own (a car, for example), or a gap between an imported year-end stand and that year's totals. The fuller you book, the smaller this gets.")}</small>}
                  </div>
                ))}
              </div>
              {tmMode === "balance" && (
                <div className="pf-mm-tm-bal pf-mm-swap">
                  <span>{t("Home")}</span><b className="pf-rounded">{money(tm.assets.home, currency)}</b>
                  <span>{t("Investments")}</span><b className="pf-rounded">{money(tm.assets.invest, currency)}</b>
                  <span>{t("Money & other assets")}</span><b className="pf-rounded">{money(tm.assets.cash, currency)}</b>
                  <span>{t("Debts")}</span><b className="pf-rounded pf-mm-neg">−{money(tm.debts, currency)}</b>
                </div>
              )}
              <div className="pf-mm-tm-ahead">
                <span>{t("The years ahead")}</span>
                <label className="pf-mm-lever">
                  <span>{t("Stock market per year")} <output>{ahMkt > 0 ? "+" : ""}{ahMkt}%</output></span>
                  <input type="range" min={-5} max={12} step={1} value={ahMkt} onChange={(e) => setAhMkt(Number(e.target.value))} />
                </label>
                <label className="pf-mm-lever">
                  <span>{t("Housing market per year")} <output>{ahHouse > 0 ? "+" : ""}{ahHouse}%</output></span>
                  <input type="range" min={-5} max={10} step={1} value={ahHouse} onChange={(e) => setAhHouse(Number(e.target.value))} />
                </label>
              </div>
            </div>
          )}
          {view !== "time" && <div className="pf-card pf-mm-card">
            <h3>{t("Equity")}</h3>
            {model && (
              <>
                <b className="pf-rounded pf-mm-eq">{money(model.equity, currency)}</b>
                <span className="pf-mm-from pf-mm-swap" key={`${mode}-${period.key}`}>
                  {mode === "back" && period.p.from !== y0
                    ? t("1 Jan {year} {amount} · {change} to {end}", { year: period.p.from, amount: money(model.eqNow, currency), change: money(model.equity - model.eqNow, currency, { signed: true }), end: period.p.to === y0 ? t("today") : t("31 Dec {year}", { year: period.p.to }) })
                    : mode === "back"
                    ? t("1 Jan {amount} · {change} so far this year", { amount: money(model.eqNow, currency), change: money(model.equity - model.eqNow, currency, { signed: true }) })
                    : t("now {amount} · {change} after {n} mo", { amount: money(model.eqNow, currency), change: money(model.equity - model.eqNow, currency, { signed: true }), n: model.n })}
                </span>
                <div className="pf-mm-parts">
                  {model.parts.map((p) => (
                    <div key={p.key} className="pf-mm-part">
                      <span>{PART[p.key]}</span>
                      <span className="pf-rounded">{money(p.v, currency, { signed: true })}</span>
                      <i data-neg={p.v < 0 || undefined} style={{ ["--w" as string]: `${(Math.abs(p.v) / maxPart) * 50}%`, ["--c" as string]: p.c }} />
                      {p.key === "other" && Math.abs(p.v) >= 1 && <small className="pf-mm-part-note">{t("The difference between your balance sheet and your bookings: income or spending not entered, another value for things you own (a car, for example), or a gap between an imported year-end stand and that year's totals. The fuller you book, the smaller this gets.")}</small>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>}
          <div className="pf-mm-fold" data-open={mode === "ahead" && view !== "time"} inert={mode !== "ahead" || view === "time"}><div><div className="pf-card pf-mm-card">
            <h3>{t("Levers")}</h3>
            {LEVERS.map((l) => (
              <label key={l.key} className="pf-mm-lever" htmlFor={`mm-${l.key}`}>
                <span>
                  {l.label} <output>{l.show}</output>
                </span>
                <input id={`mm-${l.key}`} type="range" min={l.min} max={l.max} step={1} value={levers[l.key]} onChange={(e) => move(l.key, Number(e.target.value))} />
                <small>{l.hint}</small>
              </label>
            ))}
            <button type="button" className="pf-chip" style={{ justifySelf: "start", padding: "6px 12px" }} onClick={reset}>
              {t("Back to now")}
            </button>
          </div></div></div>
          <p className="pf-mm-note pf-mm-swap" key={`${view === "time" ? "time" : mode}-${period.key}`}>
            {view === "time"
              ? t("A tower per year. Where it came from: your equity built from its sources. Owned and owed: everything you own, red for the part financed with debt, green for the part that's yours. Glass towers are expected. Point at a block for its amount.")
              : mode === "back" && period.p.from !== y0
              ? t("Earlier years come from your imported year totals. How your wealth was split within a year is partly an estimate (your home between purchase and today); what the totals don't explain shows as Other changes.")
              : mode === "back"
              ? t("What really happened since 1 January: your balance sheet then and today, and the income and spending you booked in between (per month on average).")
              : t("Your own books: a usual month (salary and average spending) and your balances today.")}
          </p>
        </aside>
      </div>
    </section>
  );
}

/** The time machine's timeline: a tick per year, a thumb that glides (drag
 *  it, click a year, or use the arrow keys) and Play. */
function Timeline({ years, at, nowAt, playing, onPick, onPlay }: { years: number[]; at: number; nowAt: number; playing: boolean; onPick: (i: number) => void; onPlay: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const n = years.length;
  const pos = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const pick = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || n < 1) return;
    const f = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    const i = Math.round(f * (n - 1));
    if (i !== at) onPick(i);
  };
  return (
    <div className="pf-tl">
      <button type="button" className="pf-tl-play" onClick={onPlay} aria-label={playing ? t("Pause") : t("Play")} data-playing={playing || undefined}>
        <span aria-hidden />
      </button>
      <div
        ref={track}
        className="pf-tl-track"
        data-dragging={dragging || undefined}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragging(true); pick(e.clientX); }}
        onPointerMove={(e) => dragging && pick(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <div className="pf-tl-rail" />
        {nowAt < n - 1 && <div className="pf-tl-ahead" style={{ left: `${pos(nowAt)}%` }} />}
        <div className="pf-tl-fill" style={{ width: `${pos(at)}%` }} />
        {years.map((y, i) => (
          <span key={y} className="pf-tl-tick" data-on={i === at || undefined} data-past={i < at || undefined} data-future={i > nowAt || undefined} data-now={i === nowAt || undefined} style={{ left: `${pos(i)}%` }}>
            <i />
            <b>{y}</b>
          </span>
        ))}
        <div
          className="pf-tl-thumb"
          role="slider"
          tabIndex={0}
          aria-label={t("Year")}
          aria-valuemin={years[0]}
          aria-valuemax={years[n - 1]}
          aria-valuenow={years[at]}
          style={{ left: `${pos(at)}%` }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onPick(Math.min(at + 1, n - 1)); }
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onPick(Math.max(at - 1, 0)); }
          }}
        />
      </div>
    </div>
  );
}
