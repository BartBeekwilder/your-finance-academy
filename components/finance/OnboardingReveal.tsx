"use client";

import { intlLocale, t } from "@/lib/i18n";
import { ArrowRight, Check, CreditCard, Flame, HandCoins, Plus, Sparkles, Split, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { money, monthName, monthYear } from "@/lib/finance/format";
import { useTween } from "./charts";
import LiveAmount from "./LiveAmount";
import { Rings } from "./ProgressParts";

// The setup's finale: a guided tour in story cards (Month Wrapped style) of
// what the books now hold and what the app does with it — live. Each card
// builds itself up piece by piece: the balance sheet post by post, income
// accruing by the second, fixed costs booking themselves, budget bars
// filling and spilling over, investments ticking with the market, a
// transaction being added (which account it comes off, spread out, an
// advance), the check-in that earns points, the month close, and — from
// the figures just entered — the runway and what every second is worth.
// Tap (or →) for the next card, ← back; "Skip the tour" goes to the end.

export type RevealFigures = {
  income: number;
  fixed: number;
  budgets: number;
  left: number;
  cash: number;
  equity: number;
  /** The last loan's payoff month, when there are loans with a payment. */
  debtFree: Date | null;
  /** The balance sheet, post by post (what was entered). */
  assets?: { name: string; amount: number }[];
  debts?: { name: string; amount: number }[];
  fixedLines?: { name: string; amount: number }[];
  budgetLines?: { name: string; amount: number }[];
  /** Investments at their live value (`day`: today's change). */
  invest?: { total: number; day: number; items: { name: string; value: number }[] };
  goal?: { name: string; amount: number; months: number } | null;
  /** The day the salary comes in. */
  payday?: number;
  /** The check-in rhythm, as a sentence ("Twice a week: …"). */
  checkin?: string;
};

type Card = { key: string; kicker: string; tone: string; body: ReactNode };

/** Now, every `ms` — for the live tickers. */
export function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** How far through this month `now` is (0–1). */
export function monthFraction(now: number) {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return (now - start) / (end - start);
}

export default function OnboardingReveal({ f, currency, onOpen, openLabel }: { f: RevealFigures; currency: string; onOpen: () => void; openLabel: string }) {
  const assets = (f.assets ?? []).filter((a) => a.amount > 0);
  const debts = (f.debts ?? []).filter((a) => a.amount > 0);
  const monthly = f.fixed + f.budgets;
  const runway = monthly > 0 ? f.cash / monthly : null;
  const tones = {
    green: "linear-gradient(150deg, #1d6b4f, #0e2a22 70%)",
    blue: "linear-gradient(150deg, #20508a, #0d1f36 70%)",
    violet: "linear-gradient(150deg, #4b2f8a, #1a1233 70%)",
    amber: "linear-gradient(150deg, #8a5a1f, #2a1b0b 70%)",
    rose: "linear-gradient(150deg, #8a2f55, #2a0f1c 70%)",
    teal: "linear-gradient(150deg, #0f6b78, #082a30 70%)",
    brand: "linear-gradient(150deg, #5b4fd6, #0f7f86)",
  };

  const cards: Card[] = [
    {
      key: "intro",
      kicker: t("Your books are open"),
      tone: tones.brand,
      body: (
        <>
          <span className="pf-wr-title">{t("Let us show you what you've built.")}</span>
          <p className="pf-wr-line">{t("Most finance apps show you last month. This one runs live: every figure moves while you watch — income, costs, investments, your equity.")}</p>
          <div className="pf-tour-pills">
            {[t("Balance sheet"), t("Live income"), t("Fixed costs"), t("Budgets"), t("Investments"), t("Check-ins"), t("Month close")].map((x, i) => (
              <span key={x} style={{ ["--d" as string]: `${0.35 + i * 0.07}s` }}>{x}</span>
            ))}
          </div>
        </>
      ),
    },
    ...(assets.length || debts.length
      ? [{
          key: "balance",
          kicker: t("Your balance sheet"),
          tone: tones.violet,
          body: (
            <>
              <span className="pf-wr-title">{t("Where you stand, post by post.")}</span>
              <BalanceBuild assets={assets} debts={debts} equity={f.equity} currency={currency} />
              <p className="pf-wr-line">{t("What you own on the left, what you owe on the right — the difference is your equity. It updates itself: loans go down every month, investments follow the market, and every euro you save lands here.")}</p>
            </>
          ),
        }]
      : []),
    ...(f.income > 0
      ? [{ key: "income", kicker: t("Live income"), tone: tones.green, body: <IncomeLive income={f.income} currency={currency} /> }]
      : []),
    ...(f.fixed > 0
      ? [{ key: "fixed", kicker: t("Fixed costs"), tone: tones.amber, body: <FixedLive lines={f.fixedLines ?? []} total={f.fixed} currency={currency} /> }]
      : []),
    ...(f.budgets > 0
      ? [{ key: "budgets", kicker: t("Budgets"), tone: tones.teal, body: <BudgetDemo lines={f.budgetLines ?? []} currency={currency} /> }]
      : []),
    {
      key: "left",
      kicker: t("Left to save each month"),
      tone: tones.green,
      body: (
        <>
          <Count value={f.left} currency={currency} color={f.left >= 0 ? "#4ade80" : "#ff6961"} />
          <p className="pf-wr-line">{t("{income} comes in; {fixed} is fixed and {budgets} budgeted.", { income: money(f.income, currency), fixed: money(f.fixed, currency), budgets: money(f.budgets, currency) })}</p>
          {f.goal && f.goal.amount > 0 && (
            <div className="pf-tour-goal">
              <span>{f.goal.name}</span>
              <b className="pf-rounded">{money(f.goal.amount / f.goal.months, currency)} {t("a month")}</b>
              <i><span style={{ width: `${Math.min(100, f.left > 0 ? ((f.goal.amount / f.goal.months) / f.left) * 100 : 100)}%` }} /></i>
              <small>{t("{share} of what's left goes to this goal", { share: f.left > 0 ? `${Math.round(((f.goal.amount / f.goal.months) / f.left) * 100)}%` : "—" })}</small>
            </div>
          )}
        </>
      ),
    },
    ...(f.invest && f.invest.total > 0
      ? [{ key: "invest", kicker: t("Investments, live"), tone: tones.blue, body: <InvestLive invest={f.invest} currency={currency} /> }]
      : []),
    { key: "add", kicker: t("Adding what you spend"), tone: tones.rose, body: <QuickAddDemo currency={currency} /> },
    { key: "checkin", kicker: t("Check-ins and points"), tone: tones.violet, body: <CheckinDemo rhythm={f.checkin} /> },
    {
      key: "close",
      kicker: t("Every month"),
      tone: tones.teal,
      body: (
        <>
          <span className="pf-wr-title">{t("How a month goes.")}</span>
          <ol className="pf-tour-steps">
            {[
              { d: "1", t: t("Fixed costs book themselves; your income starts to accrue.") },
              { d: "…", t: t("You add what you spend in seconds; every check-in earns points.") },
              { d: String(f.payday ?? 25), t: t("Payday: the salary lands on your account.") },
              { d: "→", t: t("Close the month: your Month Wrapped, and next month's budgets.") },
            ].map((s, i) => (
              <li key={i} style={{ ["--d" as string]: `${0.3 + i * 0.22}s` }}>
                <b>{s.d}</b>
                <span>{s.t}</span>
              </li>
            ))}
          </ol>
        </>
      ),
    },
    ...(runway !== null && f.cash > 0
      ? [{
          key: "runway",
          kicker: t("Your runway"),
          tone: tones.amber,
          body: (
            <>
              <span className="pf-wr-huge pf-rounded" style={{ color: "#fbbf24" }}>
                <Count value={runway} plain /> <span className="pf-wr-huge-pct">{t("months")}</span>
              </span>
              <p className="pf-wr-line">{t("If no income came in, what's in your accounts would cover your fixed costs and budgets for this long. Saving makes it grow — the dashboard keeps it live.")}</p>
              <Runway months={runway} />
            </>
          ),
        }]
      : []),
    ...(f.debtFree
      ? [{
          key: "debt",
          kicker: t("Debt-free"),
          tone: tones.amber,
          body: (
            <>
              <span className="pf-wr-huge pf-rounded" style={{ color: "#fbbf24" }}>{monthYear(f.debtFree)}</span>
              <p className="pf-wr-line">{t("Your loans go down by themselves every month.")}</p>
            </>
          ),
        }]
      : []),
    {
      key: "open",
      kicker: t("All set"),
      tone: tones.brand,
      body: (
        <>
          <span className="pf-wr-title">{t("Your books are open.")}</span>
          <p className="pf-wr-line">{t("Your dashboard is ready. The month counts along live from here.")}</p>
          <button type="button" className="pf-button pf-ob-reveal-open" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            {openLabel} <ArrowRight size={16} />
          </button>
        </>
      ),
    },
  ];

  const [i, setI] = useState(0);
  const card = cards[Math.min(i, cards.length - 1)];
  const last = i >= cards.length - 1;
  const next = () => (last ? onOpen() : setI(i + 1));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") setI((k) => Math.max(k - 1, 0));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <div className="pf-wr pf-ob-reveal">
      <div className="pf-wr-segs" aria-hidden>
        {cards.map((c, k) => (
          <button key={c.key} type="button" tabIndex={-1} data-state={k < i ? "done" : k === i ? "now" : "ahead"} onClick={() => setI(k)}>
            <i />
          </button>
        ))}
      </div>
      <div key={card.key} className="pf-wr-card" style={{ background: card.tone }} onClick={next}>
        <div className="pf-wr-body">
          <span className="pf-wr-kicker">{card.kicker}</span>
          {card.body}
        </div>
      </div>
      <div className="pf-tour-foot">
        <button type="button" className="pf-link" disabled={i === 0} onClick={() => setI(Math.max(0, i - 1))}>{t("Back")}</button>
        <span>{i + 1} / {cards.length}</span>
        {!last ? (
          <button type="button" className="pf-link" onClick={() => setI(cards.length - 1)}>{t("Skip the tour")}</button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

/** A big number counting up from zero as its card comes in. */
function Count({ value, currency, color, plain }: { value: number; currency?: string; color?: string; plain?: boolean }) {
  const [target, setTarget] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTarget(value));
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const [shown] = useTween([target], 1100);
  if (plain) return <>{shown.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</>;
  return <span className="pf-wr-huge pf-rounded" style={{ color }}>{money(shown, currency ?? "EUR")}</span>;
}

/** The balance sheet building itself: assets one by one, then debts, then
 *  the equity bar. Bar widths share one scale. */
function BalanceBuild({ assets, debts, equity, currency }: { assets: { name: string; amount: number }[]; debts: { name: string; amount: number }[]; equity: number; currency: string }) {
  const max = Math.max(1, ...assets.map((a) => a.amount), ...debts.map((d) => d.amount), Math.abs(equity));
  let k = 0;
  const row = (a: { name: string; amount: number }, tone: string) => (
    <div key={`${tone}${a.name}${k}`} className="pf-tour-post" style={{ ["--d" as string]: `${0.3 + k++ * 0.18}s`, ["--w" as string]: `${(a.amount / max) * 100}%`, ["--c" as string]: tone }}>
      <span>{a.name}</span>
      <b className="pf-rounded">{money(a.amount, currency)}</b>
      <i />
    </div>
  );
  return (
    <div className="pf-tour-sheet">
      <div>
        <small>{t("Assets")}</small>
        {assets.map((a) => row(a, "#7cc4ff"))}
      </div>
      <div>
        <small>{t("Liabilities")}</small>
        {debts.length ? debts.map((d) => row(d, "#ff8a80")) : <span className="pf-tour-none" style={{ ["--d" as string]: `${0.3 + k++ * 0.18}s` }}>{t("No debts")}</span>}
      </div>
      <div className="pf-tour-equity" style={{ ["--d" as string]: `${0.4 + k * 0.18}s` }}>
        <span>{t("Equity")}</span>
        <b className="pf-rounded" style={{ color: equity >= 0 ? "#c4b5fd" : "#ff8a80" }}>{money(equity, currency)}</b>
      </div>
    </div>
  );
}

/** Income accruing by the second over the month. */
function IncomeLive({ income, currency }: { income: number; currency: string }) {
  const now = useNow(200);
  const frac = monthFraction(now);
  const d = new Date(now);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const perSecond = income / (days * 86_400);
  return (
    <>
      <span className="pf-wr-title">{t("Your income doesn't wait for payday.")}</span>
      <div className="pf-tour-live">
        <small>{t("Earned so far in {month}", { month: monthName(d) })}</small>
        <LiveAmount value={income * frac} currency={currency} size="2.4rem" color="#4ade80" />
        <div className="pf-tour-month"><i style={{ width: `${frac * 100}%` }} /><span style={{ left: `${frac * 100}%` }} /></div>
      </div>
      <p className="pf-wr-line">
        {t("Your {income} a month is spread evenly over every day and second of the month — {rate} a second. So on the 10th you already see a third of it, and your balance is right every day, not just after payday.", { income: money(income, currency), rate: new Intl.NumberFormat(intlLocale(), { style: "currency", currency, minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(perSecond) })}
      </p>
    </>
  );
}

/** Fixed costs booked on the 1st, used up through the month. */
function FixedLive({ lines, total, currency }: { lines: { name: string; amount: number }[]; total: number; currency: string }) {
  const now = useNow(250);
  const frac = monthFraction(now);
  return (
    <>
      <span className="pf-wr-title">{t("Fixed costs book themselves.")}</span>
      <div className="pf-tour-fixed">
        {lines.slice(0, 5).map((l, i) => (
          <div key={l.name} style={{ ["--d" as string]: `${0.3 + i * 0.12}s` }}>
            <span className="pf-tour-stamp">1</span>
            <span>{l.name}</span>
            <b className="pf-rounded">{money(l.amount, currency)}</b>
          </div>
        ))}
      </div>
      <div className="pf-tour-live">
        <small>{t("Used up so far this month")}</small>
        <LiveAmount value={total * frac} currency={currency} size="1.8rem" color="#fbbf24" />
      </div>
      <p className="pf-wr-line">{t("Every month they're copied in on their own day — rent, energy, insurance — and counted as used up day by day, so your spending is live from the 1st. Change one and the next months follow.")}</p>
    </>
  );
}

/** Budget bars filling up; one spills over its end. */
function BudgetDemo({ lines, currency }: { lines: { name: string; amount: number }[]; currency: string }) {
  const shown = lines.slice(0, 4);
  const fills = [0.62, 1.18, 0.35, 0.86];
  return (
    <>
      <span className="pf-wr-title">{t("Budgets that show it as it happens.")}</span>
      <div className="pf-tour-budgets">
        {shown.map((b, i) => (
          <div key={b.name} style={{ ["--d" as string]: `${0.3 + i * 0.15}s`, ["--f" as string]: Math.min(fills[i], 1), ["--o" as string]: Math.max(0, fills[i] - 1) }} data-over={fills[i] > 1}>
            <span>{b.name}</span>
            <small className="pf-rounded">{money(b.amount * fills[i], currency)} / {money(b.amount, currency)}</small>
            <i><em /><u /></i>
          </div>
        ))}
      </div>
      <p className="pf-wr-line">{t("Each bar fills as you spend; go over and it spills out of the bar in red. A forecast tells you where the month ends up — and the ring on Progress closes when you stay within.")}</p>
    </>
  );
}

/** The portfolio ticking with the market. */
function InvestLive({ invest, currency }: { invest: NonNullable<RevealFigures["invest"]>; currency: string }) {
  const [shown] = useTween([invest.total], 900);
  return (
    <>
      <span className="pf-wr-title">{t("Your investments move with the market.")}</span>
      <div className="pf-tour-live">
        <small className="pf-tour-livebadge"><span /> {t("Live")}</small>
        <LiveAmount value={shown} currency={currency} size="2.4rem" color="#7cc4ff" roll={Math.abs(shown - invest.total) < 0.005} />
        {invest.day !== 0 && <small style={{ color: invest.day >= 0 ? "#4ade80" : "#ff8a80" }}>{invest.day >= 0 ? "+" : "−"}{money(Math.abs(invest.day), currency)} {t("today")}</small>}
      </div>
      <div className="pf-tour-fixed">
        {invest.items.slice(0, 4).map((x, i) => (
          <div key={x.name} style={{ ["--d" as string]: `${0.3 + i * 0.12}s` }}>
            <span>{x.name}</span>
            <b className="pf-rounded">{money(x.value, currency)}</b>
          </div>
        ))}
      </div>
      <p className="pf-wr-line">{t("Prices come in every 30 seconds while a market is open. Your balance sheet counts them at what they're really worth — and shows what you put in beside it.")}</p>
    </>
  );
}

/** A transaction being added, step by step. */
function QuickAddDemo({ currency }: { currency: string }) {
  const steps: { icon: LucideIcon; text: string }[] = [
    { icon: Plus, text: t("Tap + anywhere, type the amount — sums like 12+8 work too.") },
    { icon: Wallet, text: t("Pick the category; it remembers what you typed last time.") },
    { icon: CreditCard, text: t("Choose what it's paid with: your current account or a credit card — the balance of that account follows.") },
    { icon: Split, text: t("A big purchase? Spread it over months or years.") },
    { icon: HandCoins, text: t("Paid for someone else? Mark it as an advance: it's money you get back, not spending.") },
  ];
  return (
    <>
      <div className="pf-tour-receipt">
        <span className="pf-rounded">{money(12.5, currency)}</span>
        <span className="pf-tour-chip">{t("Groceries")}</span>
        <span className="pf-tour-chip" data-on>{t("Current account")}</span>
        <span className="pf-tour-chip">{t("Credit card")}</span>
      </div>
      <ul className="pf-tour-list">
        {steps.map((s, i) => (
          <li key={i} style={{ ["--d" as string]: `${0.35 + i * 0.16}s` }}>
            <s.icon size={16} />
            <span>{s.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The check-in: three ticks, the points, the streak, the rings. */
function CheckinDemo({ rhythm }: { rhythm?: string }) {
  const items = [t("All expenses entered"), t("All income entered"), t("Account balances match the bank")];
  return (
    <>
      <div className="pf-tour-check">
        <ul>
          {items.map((x, i) => (
            <li key={x} style={{ ["--d" as string]: `${0.4 + i * 0.35}s` }}>
              <span><Check size={13} /></span>
              {x}
            </li>
          ))}
        </ul>
        <div className="pf-tour-score">
          <Rings tracking={0.8} budget={0.55} saving={0.4} size={96} />
          <b className="pf-tour-points">+15</b>
          <span className="pf-tour-flame"><Flame size={14} /> 7</span>
        </div>
      </div>
      <p className="pf-wr-line">
        {t("Now and then a short check-in: are your books up to date? Each one earns points and keeps your streak alive. Points raise your level, the rings show tracking, budgets and saving, and badges come with milestones.")}
        {rhythm ? ` ${t("You chose: {rhythm}.", { rhythm })}` : ""}
      </p>
    </>
  );
}

/** The runway as a row of months that light up. */
function Runway({ months }: { months: number }) {
  const n = Math.min(24, Math.ceil(months));
  return (
    <div className="pf-tour-runway" aria-hidden>
      {Array.from({ length: Math.max(n, 1) }, (_, i) => (
        <i key={i} style={{ ["--d" as string]: `${0.4 + i * 0.05}s`, opacity: i + 1 <= months ? 1 : 0.4 }} />
      ))}
      {months > 24 && <Sparkles size={14} />}
    </div>
  );
}
