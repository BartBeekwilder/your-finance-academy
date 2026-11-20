"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { balanceSheet, expectedByCategory, liveFixed, netWorthFigures, projectedNetIncome, summarize } from "@/lib/finance/calc";
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

type View = "flow" | "build" | "grav";
type Levers = { inc: number; sp: number; mkt: number; house: number; months: number };
type Debt = { label: string; value: number };
type Base = {
  income: number; fixed: number; repay: number; variable: number; cash: number; invest: number; home: number; mortgage: number; otherDebt: number; otherDebts?: Debt[];
  // Looking back: the markets' real moves, today's real stand, the captions.
  marketMove?: number; homeMove?: number; end?: { cash: number; invest: number; home: number; mortgage: number; otherDebts: Debt[] }; capMonth?: string; capAfter?: string;
};
type Mode = "ahead" | "back";
type Model = { equity: number; eqNow: number; n: number; parts: { key: string; v: number; c: string }[] };
type Engine = {
  setLevers: (l: Partial<Levers>) => void;
  setBase: (b: Base) => void;
  setView: (v: View) => View;
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
  const fixedAll = Math.max(liveFixed(data, now), expected.reduce((t, e) => t + Math.max(e.fixed, e.usualFix), 0));
  const usualVar = expected.reduce((t, e) => t + e.usualVar, 0);
  const variable = usualVar > 0 ? usualVar : expected.reduce((t, e) => t + Math.max(e.expected - Math.max(e.fixed, e.usualFix), 0), 0);
  // The mortgage's repayment this month: part of the payment, but it lowers
  // the debt instead of leaving (equity stays; it moves from money to home).
  const repay = homes(data).reduce((t, h) => t + h.parts.reduce((s, p) => {
    const row = summarizePart(p, now).thisMonth;
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
  };
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

/** This year so far, as it really went: the balance sheet on 1 January (the
 *  end of December), the income and spending booked since (per month on
 *  average), what the mortgage really went down, what the market did, and
 *  today's real balance sheet as the end. */
export function lookBackBase(data: FinanceData, now: Date) {
  const y = now.getFullYear(), cur = now.getMonth(), n = cur + 1;
  const start = stand(balanceSheet(data, now, new Date(y - 1, 11, 1)), investmentsValue(data, new Date(y - 1, 11, 31, 23, 59)).total);
  const end = stand(balanceSheet(data, now, new Date(y, cur, 1)), investmentsValue(data, now).total);
  let income = 0, fixed = 0, variable = 0;
  for (let m = 0; m <= cur; m++) {
    const s = summarize(data.transactions, new Date(y, m, 1));
    income += s.income; fixed += s.fixed; variable += s.variable;
  }
  const repaid = Math.max(start.mortgage - end.mortgage, 0);
  return {
    months: n,
    base: {
      ...start,
      income: income / n,
      // The mortgage payments are in the fixed costs; their repayment part
      // made the debt smaller instead of leaving.
      fixed: Math.max(fixed - repaid, 0) / n,
      repay: Math.min(repaid, fixed) / n,
      variable: variable / n,
      marketMove: end.invest - start.invest,
      homeMove: end.home - start.home,
      end: { cash: end.cash, invest: end.invest, home: end.home, mortgage: end.mortgage, otherDebts: end.otherDebts },
      capMonth: t("PER MONTH, ON AVERAGE"),
      capAfter: t("TODAY"),
    },
  };
}

/** Loads the shared drawing script once. */
let loading: Promise<void> | null = null;
function loadEngine() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.PFMoneyModel) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/moneymodel.js?v=2";
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
    perMonth: t("{amount} a month"), capMonth: t("PER MONTH"), capAfter: t("AFTER THE PERIOD"), capResult: t("RESULT"),
    hintFlow: t("Point at a stream or block for an explanation"), hint3d: t("Drag to turn · point at a block or planet"),
    tipIncome: t("What comes in this month. Everything you keep starts here."),
    tipMonth: t("All that comes in this month, and where it goes."),
    tipFixed: t("Fixed costs without the repayment. Gone is gone: this lowers your equity."),
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
  };
}

const START: Levers = { inc: 0, sp: 0, mkt: 0, house: 0, months: 12 };

export default function MoneyModel({ data, now, currency }: { data: FinanceData; now: Date; currency: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [view, setView] = useState<View>("flow");
  const [levers, setLevers] = useState<Levers>(START);
  const [model, setModel] = useState<Model | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("ahead");
  const ahead = useMemo(() => moneyModelBase(data, now), [data, now]);
  const back = useMemo(() => lookBackBase(data, now), [data, now]);
  const base = mode === "back" ? back.base : ahead;
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

  const pickView = (v: View) => setView(engine.current?.setView(v) ?? v);
  const move = (k: keyof Levers, v: number) => {
    const next = { ...levers, [k]: v };
    setLevers(next);
    engine.current?.setLevers(next);
  };
  const reset = () => {
    setLevers(START);
    engine.current?.setLevers(START);
  };
  const pct = (v: number) => `${v > 0 ? "+" : ""}${v}%`;
  const LEVERS: { key: keyof Levers; label: string; hint: string; min: number; max: number; show: string }[] = [
    { key: "inc", label: t("Income"), hint: t("Your usual net income per month"), min: -30, max: 30, show: pct(levers.inc) },
    { key: "sp", label: t("Variable spending"), hint: t("Everything that isn't a fixed cost"), min: -30, max: 50, show: pct(levers.sp) },
    { key: "mkt", label: t("Stock market"), hint: t("The price of your investments"), min: -40, max: 40, show: pct(levers.mkt) },
    { key: "house", label: t("Housing market"), hint: t("The value of your home"), min: -20, max: 20, show: pct(levers.house) },
    { key: "months", label: t("Period"), hint: t("How many months run on"), min: 1, max: 60, show: levers.months === 1 ? t("1 month") : t("{n} months", { n: levers.months }) },
  ];
  const PART: Record<string, string> = {
    work: t("From work (income − spending)"),
    repay: t("From repayment (less debt)"),
    market: t("From the stock market"),
    housing: t("From the housing market"),
    other: t("Other changes"),
  };
  const maxPart = model ? Math.max(...model.parts.map((p) => Math.abs(p.v)), 1) : 1;

  return (
    <section className="pf-mm">
      <div className="pf-mm-head">
        <p className="pf-mm-lede">{t("How your income, spending, investments, home and debts make your equity together. Move the levers and see what moves.")}</p>
        <div className="pf-mm-switches">
          <Segmented label={t("Period")} value={mode} onChange={setMode} options={[{ value: "ahead", label: t("Ahead") }, { value: "back", label: t("This year so far") }]} />
          <Segmented label={t("View")} value={view} onChange={pickView} options={[{ value: "flow", label: t("Money flow") }, { value: "build", label: t("Wealth building") }, { value: "grav", label: t("Gravity") }]} />
        </div>
      </div>
      <div className="pf-mm-main">
        <div ref={stageRef} className="pf-mm-stage">{failed && <p className="pf-mm-failed">{t("The model couldn't load. Reload the page to try again.")}</p>}</div>
        <aside className="pf-mm-side">
          <div className="pf-card pf-mm-card">
            <h3>{t("Equity")}</h3>
            {model && (
              <>
                <b className="pf-rounded pf-mm-eq">{money(model.equity, currency)}</b>
                <span className="pf-mm-from">
                  {mode === "back"
                    ? t("1 Jan {amount} · {change} so far this year", { amount: money(model.eqNow, currency), change: money(model.equity - model.eqNow, currency, { signed: true }) })
                    : t("now {amount} · {change} after {n} mo", { amount: money(model.eqNow, currency), change: money(model.equity - model.eqNow, currency, { signed: true }), n: model.n })}
                </span>
                <div className="pf-mm-parts">
                  {model.parts.map((p) => (
                    <div key={p.key} className="pf-mm-part">
                      <span>{PART[p.key]}</span>
                      <span className="pf-rounded">{money(p.v, currency, { signed: true })}</span>
                      <i data-neg={p.v < 0 || undefined} style={{ ["--w" as string]: `${(Math.abs(p.v) / maxPart) * 50}%`, ["--c" as string]: p.c }} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {mode === "ahead" && <div className="pf-card pf-mm-card">
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
          </div>}
          <p className="pf-mm-note">
            {mode === "back"
              ? t("What really happened since 1 January: your balance sheet then and today, and the income and spending you booked in between (per month on average).")
              : t("Your own books: a usual month (salary and average spending) and your balances today.")}
          </p>
        </aside>
      </div>
    </section>
  );
}
