"use client";

import { intlLocale, t } from "@/lib/i18n";
import { loanSchedule } from "@/lib/finance/loans";
import { ArrowRight, Check, ChevronLeft, ChevronRight, CreditCard, Flame, HandCoins, Plus, Split, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { money, monthName, monthYear, shortMonth } from "@/lib/finance/format";
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
  /** The runway goal in months (default 6). */
  runwayGoal?: number;
  /** The balance sheet, post by post (what was entered). */
  assets?: { name: string; amount: number }[];
  debts?: { name: string; amount: number }[];
  fixedLines?: { name: string; amount: number; day?: number }[];
  /** Loans with what's left, the rate and the monthly payment (Debt-free card). */
  loans?: { name: string; balance: number; rate: number; monthly: number }[];
  /** The mortgage (all parts), month by month from now. */
  mortgage?: { owed: number; monthly: number; months: { date: Date; balance: number; interest: number }[] } | null;
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
  // Key figures (from what was entered).
  const invested = f.invest?.total ?? 0;
  const home = (f.assets ?? []).find((a) => a.name === t("Home"))?.amount ?? 0;
  const mortgage = (f.debts ?? []).find((a) => a.name === t("Mortgage"))?.amount ?? 0;
  const figures = f.income > 0 ? keyFigures({ income: f.income, fixed: f.fixed, budgets: f.budgets, left: f.left, equity: f.equity, home, mortgage }, currency) : [];
  const fi = monthly > 0 ? freedom({ monthly, have: f.cash + invested, left: f.left }) : null;
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
          <IntroGlance f={f} currency={currency} />
          {/* What's coming; each one jumps straight to its card. */}
          <div className="pf-tour-pills">
            {([["balance", t("Balance sheet")], ["income", t("Live income")], ["fixed", t("Fixed costs")], ["budgets", t("Budgets")], ["invest", t("Investments")], ["checkin", t("Check-ins")], ["close", t("Month close")]] as const).map(([k, x], i) => (
              <button key={k} type="button" style={{ ["--d" as string]: `${0.35 + i * 0.07}s` }} onClick={(e) => { e.stopPropagation(); jump(k); }}>{x}</button>
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
              <span className="pf-wr-title">{t("Your balance sheet — like a company's.")}</span>
              <BalanceBuild assets={assets} debts={debts} left={f.left} currency={currency} />
              <p className="pf-wr-line">{t("Left, everything you own. Right, who it belongs to: the bank and other lenders (debts), and you (equity). Both sides always add up to the same — that's a real balance sheet. Most money apps stop at one net-worth number; here you see where it comes from, and it moves live: loans go down every month, investments follow the market, and every euro you save lands in your equity.")}</p>
            </>
          ),
        }]
      : []),
    ...(f.income > 0
      ? [{ key: "income", kicker: t("Live income"), tone: tones.green, body: <IncomeLive income={f.income} spending={f.fixed + f.budgets} currency={currency} /> }]
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
              <small>
                {f.left > 0 && f.goal.amount / f.goal.months <= f.left
                  ? t("{share} of what's left goes to this goal", { share: `${Math.round(((f.goal.amount / f.goal.months) / f.left) * 100)}%` })
                  : t("That's more than you have left each month — a longer term makes it fit.")}
              </small>
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
              <RunwayDrain months={runway} goal={f.runwayGoal ?? 6} cash={f.cash} monthly={monthly} left={f.left} currency={currency} />
            </>
          ),
        }]
      : []),
    ...(figures.length
      ? [{
          key: "figures",
          kicker: t("Your numbers"),
          tone: tones.violet,
          body: (
            <>
              <span className="pf-wr-title">{t("The figures that tell you how you're doing.")}</span>
              <div className="pf-tour-figs">
                {figures.map((x, i) => (
                  <div key={x.key} className="pf-tour-fig" style={{ ["--d" as string]: `${0.3 + i * 0.12}s` }} data-tone={x.tone}>
                    <span>{x.label}</span>
                    <b className="pf-rounded">{x.value}</b>
                    {x.bar != null && <i><em style={{ ["--f" as string]: Math.max(0, Math.min(1, x.bar)) }} /></i>}
                    <small>{x.note}</small>
                  </div>
                ))}
              </div>
              <p className="pf-wr-line">{t("They move along with your books — the dashboard keeps them live.")}</p>
            </>
          ),
        }]
      : []),
    ...(fi
      ? [{
          key: "freedom",
          kicker: t("Financial freedom"),
          tone: tones.green,
          body: (
            <>
              <span className="pf-wr-title">{t("Your freedom number.")}</span>
              <Count value={fi.target} currency={currency} color="#4ade80" />
              <p className="pf-wr-line">{t("25 times what you spend in a year: from this amount, invested, you could live off about 4% a year — for good.")}</p>
              <div className="pf-tour-fi">
                <div><span>{t("Already there")}</span><b className="pf-rounded">{Math.round(fi.share * 100)}%</b></div>
                <i><em style={{ ["--f" as string]: Math.min(1, fi.share) }} /></i>
                <small>
                  {fi.years == null
                    ? t("Save something each month to start moving towards it.")
                    : fi.years <= 0
                      ? t("You're there already.")
                      : t("You keep {left} a month. Invest that every month at 5% growth a year (a cautious average) and you reach this amount in about {n} years, in {year}.", { left: money(f.left, currency), n: Math.ceil(fi.years), year: new Date().getFullYear() + Math.ceil(fi.years) })}
                </small>
              </div>
            </>
          ),
        }]
      : []),
    ...(f.debtFree || f.mortgage?.months.length
      ? [{
          key: "debt",
          kicker: t("Debt-free"),
          tone: tones.amber,
          body: (
            <>
              <span className="pf-wr-huge pf-rounded" style={{ color: "#fbbf24" }}>{monthYear(f.debtFree ?? f.mortgage!.months[f.mortgage!.months.length - 1].date)}</span>
              <p className="pf-wr-line">
                {f.debtFree && f.mortgage?.months.length
                  ? t("Your loans are paid off then; your mortgage in {month}. Both go down by themselves every month.", { month: monthYear(f.mortgage.months[f.mortgage.months.length - 1].date) })
                  : f.debtFree
                    ? t("Your loans go down by themselves every month.")
                    : t("Your mortgage is paid off then. It goes down by itself every month.")}
              </p>
              <DebtDown loans={f.loans ?? []} mortgage={f.mortgage ?? null} currency={currency} />
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
          <OpenSummary f={f} />
          <button type="button" className="pf-button pf-ob-reveal-open" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            {openLabel} <ArrowRight size={16} />
          </button>
        </>
      ),
    },
  ];

  const [i, setI0] = useState(0);
  // A card by its key (the intro's pills); a card that isn't there → the next one.
  function jump(key: string) {
    const k = cards.findIndex((c) => c.key === key);
    setI(k >= 0 ? k : i + 1);
  }
  // The card being left slides out (to the left going forward, to the right
  // going back) while the next one slides in behind it, like a carousel.
  const [leaving, setLeaving] = useState<{ k: number; dir: 1 | -1; n: number } | null>(null);
  const card = cards[Math.min(i, cards.length - 1)];
  const last = i >= cards.length - 1;
  const setI = (to: number) => {
    const n = Math.max(0, Math.min(to, cards.length - 1));
    if (n === i) return;
    setLeaving((l) => ({ k: i, dir: n > i ? 1 : -1, n: (l?.n ?? 0) + 1 }));
    setI0(n);
  };
  const next = () => (last ? onOpen() : setI(i + 1));
  const prev = () => setI(i - 1);
  // One height for the whole tour, so the window doesn't change shape from
  // card to card: on the first frame every card is laid out (hidden) in the
  // same grid cell, the tallest sets the height, then they're dropped.
  const track = useRef<HTMLDivElement>(null);
  const [tall, setTall] = useState<number | null>(null);
  // …and the tour scales as one (same factor for every card) to fit the
  // window, so a smaller window shows the same cards, just smaller.
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    if (tall == null) {
      setTall(el.offsetHeight);
      return;
    }
    const inner = el.closest(".pf-ob-inner");
    if (!inner) return;
    // Everything in the onboarding card besides the cards, plus its padding.
    const other = inner.getBoundingClientRect().height - el.getBoundingClientRect().height + 58;
    setFit(Math.max(0.55, Math.min(1, (window.innerHeight - 72 - other) / tall)));
  }, [tall]);
  useEffect(() => {
    const again = () => setTall(null);
    window.addEventListener("resize", again);
    return () => window.removeEventListener("resize", again);
  }, []);
  // Swiping the card: left → next, right → back (a tap still goes on).
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
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
      <div className="pf-tour-stage">
        <div
          ref={track}
          className="pf-tour-track"
          style={tall ? { height: tall, zoom: fit } : undefined}
          onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY, moved: false })}
          onPointerUp={(e) => {
            const s0 = swipe.current;
            if (!s0) return;
            const dx = e.clientX - s0.x;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s0.y)) {
              s0.moved = true;
              if (dx < 0) next();
              else prev();
            }
          }}
        >
        {tall == null && cards.map((c) => (
          <div key={`size-${c.key}`} className="pf-wr-card pf-tour-sizer" aria-hidden>
            <div className="pf-wr-body">
              <span className="pf-wr-kicker">{c.kicker}</span>
              {c.body}
            </div>
          </div>
        ))}
        <div key={card.key} className="pf-wr-card pf-tour-card" data-dir={leaving?.dir ?? 1} style={{ background: card.tone }} onClick={() => { if (!swipe.current?.moved) next(); swipe.current = null; }}>
          <div className="pf-wr-body">
            <span className="pf-wr-kicker">{card.kicker}</span>
            {card.body}
          </div>
        </div>
        {leaving && cards[leaving.k] && (
          <div key={`leave${leaving.n}`} className="pf-wr-card pf-tour-leaving" data-dir={leaving.dir} style={{ background: cards[leaving.k].tone }} aria-hidden onAnimationEnd={(e) => e.target === e.currentTarget && setLeaving(null)}>
            <div className="pf-wr-body">
              <span className="pf-wr-kicker">{cards[leaving.k].kicker}</span>
              {cards[leaving.k].body}
            </div>
          </div>
        )}
        </div>
        {i > 0 && (
          <button type="button" className="pf-tour-arrow" data-side="left" aria-label={t("Back")} onClick={(e) => { e.stopPropagation(); prev(); }}>
            <ChevronLeft size={20} />
          </button>
        )}
        <button type="button" className="pf-tour-arrow" data-side="right" aria-label={last ? openLabel : t("Next")} onClick={(e) => { e.stopPropagation(); next(); }}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="pf-tour-foot">
        <button type="button" className="pf-link" disabled={i === 0} onClick={prev}>{t("Back")}</button>
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
function Count({ value, currency, color, plain, whole }: { value: number; currency?: string; color?: string; plain?: boolean; whole?: boolean }) {
  const [target, setTarget] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTarget(value));
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const [shown] = useTween([target], 1100);
  if (plain) return <>{shown.toLocaleString(intlLocale(), whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</>;
  return <span className="pf-wr-huge pf-rounded" style={{ color }}>{money(shown, currency ?? "EUR")}</span>;
}

/** The balance sheet building itself: assets one by one, then debts, then
 *  the equity bar. Bar widths share one scale. */
function BalanceBuild({ assets, debts, left, currency }: { assets: { name: string; amount: number }[]; debts: { name: string; amount: number }[]; left: number; currency: string }) {
  const total = assets.reduce((x, a) => x + a.amount, 0);
  const owed = debts.reduce((x, d) => x + d.amount, 0);
  const equity = total - owed;
  // Both sides on one scale: the larger total is a full bar.
  const max = Math.max(1, total, owed);
  let k = 0;
  const row = (a: { name: string; amount: number }, tone: string, cls = "") => (
    <div key={`${tone}${a.name}${k}`} className={`pf-tour-post ${cls}`} style={{ ["--d" as string]: `${0.3 + k++ * 0.16}s`, ["--w" as string]: `${(Math.abs(a.amount) / max) * 100}%`, ["--c" as string]: tone }}>
      <span>{a.name}</span>
      <b className="pf-rounded">{money(a.amount, currency)}</b>
      <i />
    </div>
  );
  const sum = (label: string, value: number) => (
    <div className="pf-tour-sum" style={{ ["--d" as string]: `${0.5 + k * 0.16}s` }}>
      <span>{label}</span>
      <b className="pf-rounded">{money(value, currency)}</b>
    </div>
  );
  // Negative equity: when, at what's left to save each month, it turns positive.
  const months = equity < 0 && left > 0 ? Math.ceil(-equity / left) : null;
  const when = months != null ? new Date(new Date().getFullYear(), new Date().getMonth() + months, 1) : null;
  return (
    <>
      <div className="pf-tour-sheet">
        <div>
          <small>{t("Assets")}</small>
          {assets.map((a) => row(a, "#7cc4ff"))}
          {sum(t("Total"), total)}
        </div>
        <div>
          <small>{t("Liabilities")} + {t("Equity")}</small>
          {debts.length ? debts.map((d) => row(d, "#ff8a80")) : <span className="pf-tour-none" style={{ ["--d" as string]: `${0.3 + k++ * 0.16}s` }}>{t("No debts")}</span>}
          {row({ name: t("Equity"), amount: equity }, equity >= 0 ? "#c4b5fd" : "#ff6961", "pf-tour-post-equity")}
          {sum(t("Total"), owed + equity)}
        </div>
      </div>
      <div className="pf-tour-balanced" style={{ ["--d" as string]: `${0.7 + k * 0.16}s` }}>
        <span>✓</span> {t("In balance: {a} = {b}", { a: money(total, currency), b: money(owed + equity, currency) })}
      </div>
      {equity < 0 && (
        <div className="pf-tour-turn" style={{ ["--d" as string]: `${0.9 + k * 0.16}s` }}>
          {months != null && when ? (
            <>
              <small>{t("Your equity turns positive in")}</small>
              <b className="pf-rounded"><Count value={months} plain whole /> {t("months")}</b>
              <small>{t("Around {month}, saving {left} a month.", { month: monthYear(when), left: money(left, currency) })}</small>
            </>
          ) : (
            <small>{t("Save something each month and your equity starts climbing towards zero.")}</small>
          )}
        </div>
      )}
    </>
  );
}

/** Income accruing by the second over the month. */
/** Debt-free: what's left of every loan, year by year (stacked), down to
 *  zero, with the sums behind it and each loan's last month. */
const LOAN_TONES = ["#fbbf24", "#fb923c", "#f472b6", "#a78bfa", "#60a5fa"];
function DebtDown({ loans, mortgage, currency }: { loans: { name: string; balance: number; rate: number; monthly: number }[]; mortgage: RevealFigures["mortgage"] | null; currency: string }) {
  const start = new Date();
  const stand = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const plans = [
    ...(mortgage?.months.length ? [{ name: t("Mortgage"), balance: mortgage.owed, monthly: mortgage.monthly, rows: mortgage.months }] : []),
    ...loans.filter((l) => l.balance > 0 && l.monthly > 0).map((l) => ({ ...l, rows: loanSchedule({ balance: l.balance.toFixed(2), rate: l.rate.toFixed(2), monthly: l.monthly.toFixed(2), start_date: stand }) as { date: Date; balance: number; interest: number }[] })),
  ];
  if (!plans.length) return null;
  const months = Math.max(...plans.map((p) => p.rows.length));
  const years = Math.max(1, Math.ceil(months / 12));
  const step = years > 12 ? 2 : 1;
  const cols = Array.from({ length: Math.ceil(years / step) + 1 }, (_, k) => k * step * 12);
  const owed = plans.reduce((s2, p) => s2 + p.balance, 0);
  const left = (p: (typeof plans)[number], m: number) => (m === 0 ? p.balance : (p.rows[m - 1]?.balance ?? 0));
  const interest = plans.reduce((s2, p) => s2 + p.rows.reduce((s3, x) => s3 + x.interest, 0), 0);
  return (
    <div className="pf-tour-debt">
      <div className="pf-tour-debt-plot" aria-hidden>
        {cols.map((m, k) => (
          <i key={m} style={{ ["--d" as string]: `${0.3 + k * 0.05}s` }}>
            <span>
              {plans.map((p, j) => {
                const v = left(p, m);
                return v > 0 ? <em key={j} style={{ height: `${(v / owed) * 100}%`, background: LOAN_TONES[j % LOAN_TONES.length] }} /> : null;
              })}
            </span>
            <small>{start.getFullYear() + Math.round(m / 12)}</small>
          </i>
        ))}
      </div>
      <div className="pf-tour-debt-stats">
        <span><small>{t("Owed now")}</small><b className="pf-rounded">{money(owed, currency)}</b></span>
        <span><small>{t("Paid off a month")}</small><b className="pf-rounded">{money(plans.reduce((s2, p) => s2 + p.monthly, 0), currency)}</b></span>
        <span><small>{t("Interest still to pay")}</small><b className="pf-rounded">{money(interest, currency)}</b></span>
      </div>
      <div className="pf-tour-debt-list">
        {plans.map((p, j) => (
          <span key={j}><i style={{ background: LOAN_TONES[j % LOAN_TONES.length] }} />{p.name}<b className="pf-rounded">{p.rows.length ? monthYear(p.rows[p.rows.length - 1].date) : "—"}</b></span>
        ))}
      </div>
    </div>
  );
}

/** The last card: what's set up, and what happens next. */
function OpenSummary({ f }: { f: RevealFigures }) {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const payday = f.payday ? new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= f.payday ? 1 : 0), f.payday) : null;
  const ready: [string, number][] = [
    [t("Balance sheet"), [...(f.assets ?? []), ...(f.debts ?? [])].filter((a) => a.amount > 0).length],
    [t("Fixed costs"), (f.fixedLines ?? []).length],
    [t("Budgets"), (f.budgetLines ?? []).length],
    [t("Investments"), f.invest?.items.length ?? 0],
    [t("Loans"), (f.loans ?? []).length],
  ];
  const day = (d: Date) => d.toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" });
  const next: [string, string][] = [
    [day(tomorrow), t("Your first check-in: tick off the day, earn points")],
    ...(payday ? [[day(payday), t("Payday: your income comes in")] as [string, string]] : []),
    [day(lastDay), t("Close the month and see your Month Wrapped")],
  ];
  return (
    <div className="pf-tour-open">
      <div className="pf-tour-open-ready">
        {ready.filter(([, n]) => n > 0).map(([label, n], k) => (
          <span key={label} style={{ ["--d" as string]: `${0.25 + k * 0.08}s` }}><Check size={13} /> {label}<b>{n}</b></span>
        ))}
        {f.goal && <span style={{ ["--d" as string]: "0.7s" }}><Check size={13} /> {f.goal.name}</span>}
      </div>
      <div className="pf-tour-open-next">
        <small>{t("Coming up")}</small>
        {next.map(([when, what], k) => (
          <div key={k} style={{ ["--d" as string]: `${0.5 + k * 0.1}s` }}><b>{when}</b><span>{what}</span></div>
        ))}
      </div>
    </div>
  );
}

/** The intro's glance: equity ticking on at what's left to save per second,
 *  and the month in four numbers. */
function IntroGlance({ f, currency }: { f: RevealFigures; currency: string }) {
  const now = useNow(250);
  const [opened] = useState(() => Date.now());
  const d = new Date(now);
  const monthMs = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() * 86_400_000;
  const equity = f.equity + (f.left / monthMs) * (now - opened);
  const tiles: [string, number, string][] = [
    [t("Comes in"), f.income, "#4ade80"],
    [t("Fixed costs"), f.fixed, "#fff"],
    [t("Budgets"), f.budgets, "#fff"],
    [t("Left to save"), f.left, f.left >= 0 ? "#40c8e0" : "#ff6961"],
  ];
  return (
    <div className="pf-tour-glance">
      <div className="pf-tour-glance-eq">
        <small>{t("Your equity, now")}</small>
        <LiveAmount value={equity} currency={currency} size="2.2rem" color="#fff" />
      </div>
      <div className="pf-tour-glance-grid">
        {tiles.map(([label, v, c], k) => (
          <div key={label} style={{ ["--d" as string]: `${0.2 + k * 0.08}s` }}>
            <small>{label}</small>
            <b className="pf-rounded" style={{ color: c }}>{money(v, currency)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The month as a chart, like the dashboard's: income and spending both
 *  spread over the month, solid up to now and dashed to the month's end;
 *  the gap between them is what's saved. The dot is now, moving. */
function MonthChart({ income, spending, frac, currency, days }: { income: number; spending: number; frac: number; currency: string; days: number }) {
  const W = 300, H = 130, top = Math.max(income, spending, 1) * 1.08;
  const x = (f: number) => f * W;
  const y = (v: number) => H - (v / top) * H;
  const nx = x(frac);
  const saved = income - spending;
  return (
    <div className="pf-tour-chart">
      <div className="pf-tc-plot">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="pf-tc-gap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#40c8e0" stopOpacity="0.35" />
            <stop offset="1" stopColor="#40c8e0" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} className="pf-tc-grid" />)}
        {/* What's saved so far: between the two lines, up to now. */}
        <polygon points={`0,${H} ${nx},${y(income * frac)} ${nx},${y(spending * frac)}`} fill="url(#pf-tc-gap)" />
        <line x1="0" y1={H} x2={nx} y2={y(income * frac)} className="pf-tc-in" />
        <line x1={nx} y1={y(income * frac)} x2={W} y2={y(income)} className="pf-tc-in pf-tc-ahead" />
        <line x1="0" y1={H} x2={nx} y2={y(spending * frac)} className="pf-tc-out" />
        <line x1={nx} y1={y(spending * frac)} x2={W} y2={y(spending)} className="pf-tc-out pf-tc-ahead" />
        <line x1={nx} x2={nx} y1="0" y2={H} className="pf-tc-now" />
      </svg>
      {/* Dots in HTML so they stay round on a stretched chart. */}
      <i className="pf-tc-dot" style={{ left: `${frac * 100}%`, top: `${(y(income * frac) / H) * 100}%`, background: "#4ade80" }} />
      <i className="pf-tc-dot" style={{ left: `${frac * 100}%`, top: `${(y(spending * frac) / H) * 100}%`, background: "#ff6961" }} />
      </div>
      <div className="pf-tc-axis"><span>1</span><span style={{ left: `${frac * 100}%` }}>{t("Now")}</span><span>{days}</span></div>
      <div className="pf-tc-key">
        <span><i style={{ background: "#4ade80" }} /> {t("Income")} <b className="pf-rounded">{money(income, currency)}</b></span>
        <span><i style={{ background: "#ff6961" }} /> {t("Spending")} <b className="pf-rounded">{money(spending, currency)}</b></span>
        <span><i style={{ background: "#40c8e0" }} /> {t("Saved by the end")} <b className="pf-rounded" style={{ color: saved >= 0 ? "#40c8e0" : "#ff6961" }}>{money(saved, currency)}</b></span>
      </div>
    </div>
  );
}

function IncomeLive({ income, spending, currency }: { income: number; spending: number; currency: string }) {
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
      </div>
      <MonthChart income={income} spending={spending} frac={frac} currency={currency} days={days} />
      <p className="pf-wr-line">
        {t("Your {income} a month is spread evenly over every day and second of the month — {rate} a second. So on the 10th you already see a third of it, and your balance is right every day, not just after payday.", { income: money(income, currency), rate: new Intl.NumberFormat(intlLocale(), { style: "currency", currency, minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(perSecond) })}
      </p>
    </>
  );
}

/** Fixed costs booked on the 1st, used up through the month. */
function FixedLive({ lines: all, total, currency }: { lines: { name: string; amount: number; day?: number }[]; total: number; currency: string }) {
  // In the order they're booked.
  const lines = [...all].sort((a, b) => (a.day ?? 1) - (b.day ?? 1));
  const now = useNow(250);
  const frac = monthFraction(now);
  return (
    <>
      <span className="pf-wr-title">{t("Fixed costs book themselves.")}</span>
      <small className="pf-tour-stampnote">{t("Each one books itself every month, on its own day.")}</small>
      <div className="pf-tour-fixed">
        {lines.slice(0, 5).map((l, i) => (
          <div key={l.name} style={{ ["--d" as string]: `${0.3 + i * 0.12}s` }}>
            {/* A calendar leaf: booked on the 1st of the month. */}
            <span className="pf-tour-stamp" title={t("Booked on day {n} of the month", { n: l.day ?? 1 })}><small>{shortMonth(new Date(now))}</small>{l.day ?? 1}</span>
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
          // The track runs to 125% of the budget: the budget is a tick at 80%,
          // spending over it turns red past the tick — all inside the bar.
          <div key={b.name} style={{ ["--d" as string]: `${0.3 + i * 0.15}s`, ["--f" as string]: Math.min(fills[i], 1) / 1.25, ["--o" as string]: Math.max(0, Math.min(fills[i], 1.25) - 1) / 1.25 }} data-over={fills[i] > 1}>
            <span>{b.name}</span>
            <small className="pf-rounded">{money(b.amount * fills[i], currency)} / {money(b.amount, currency)}</small>
            <i><em /><u /><s /></i>
          </div>
        ))}
      </div>
      <p className="pf-wr-line">{t("Each bar fills as you spend; the line is your budget, and going over turns red. A forecast tells you where the month ends up — and the ring on Progress closes when you stay within.")}</p>
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

/** The key figures: savings rate, fixed costs as a share of income, what an
 *  hour of work brings in, free to spend per day, equity in months of
 *  living, and the mortgage against the home (loan-to-value). Each with a
 *  rule of thumb, so the number means something. */
function keyFigures(x: { income: number; fixed: number; budgets: number; left: number; equity: number; home: number; mortgage: number }, currency: string) {
  const pctOf = (v: number) => `${Math.round(v * 100)}%`;
  const cur = (v: number) => money(v, currency);
  const out: { key: string; label: string; value: string; note: string; bar: number | null; tone: "good" | "ok" | "bad" }[] = [];
  const rate = x.left / x.income;
  out.push({ key: "rate", label: t("Savings rate"), value: pctOf(rate), bar: rate / 0.3, note: t("20% or more is strong."), tone: rate >= 0.2 ? "good" : rate >= 0.1 ? "ok" : "bad" });
  const fixedShare = x.fixed / x.income;
  out.push({ key: "fixed", label: t("Fixed costs of income"), value: pctOf(fixedShare), bar: fixedShare, note: t("Under 50% leaves room to breathe."), tone: fixedShare <= 0.5 ? "good" : fixedShare <= 0.65 ? "ok" : "bad" });
  out.push({ key: "hour", label: t("An hour of your work"), value: cur(x.income / 173.3), bar: null, note: t("Net, at 40 hours a week — a {dinner} dinner costs {h} of work.", { dinner: money(40, currency), h: hoursLabel(40 / (x.income / 173.3)) }), tone: "ok" });
  const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  out.push({ key: "day", label: t("Free to spend per day"), value: cur(x.budgets / days), bar: null, note: t("{budgets} of budgets this month ÷ {days} days. Groceries, going out, shopping: this much a day keeps you on budget.", { budgets: cur(x.budgets), days }), tone: "ok" });
  const living = x.fixed + x.budgets;
  if (living > 0) out.push({ key: "months", label: t("Equity in months of living"), value: `${Math.max(0, x.equity / living).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, bar: null, note: t("How many months your whole equity would carry you."), tone: x.equity > 0 ? "good" : "bad" });
  if (x.home > 0 && x.mortgage > 0) {
    const ltv = x.mortgage / x.home;
    out.push({ key: "ltv", label: t("Mortgage of home value"), value: pctOf(ltv), bar: ltv, note: t("Loan-to-value: lower means more of the home is yours."), tone: ltv <= 0.8 ? "good" : ltv <= 1 ? "ok" : "bad" });
  }
  return out;
}

/** "1 h 12 min" for a number of hours. */
function hoursLabel(h: number) {
  const m = Math.round(h * 60);
  return m < 60 ? t("{m} min", { m }) : t("{h} h {m} min", { h: Math.floor(m / 60), m: m % 60 });
}

/** The freedom number (25× a year's spending, the 4% rule), the share of it
 *  already there (cash + investments), and the years to get there saving
 *  `left` a month at 5% growth a year (null: never, at this rate). */
function freedom({ monthly, have, left }: { monthly: number; have: number; left: number }) {
  const target = monthly * 12 * 25;
  const share = target > 0 ? have / target : 0;
  if (have >= target) return { target, share, years: 0 };
  if (left <= 0) return { target, share, years: null };
  const r = 1.05 ** (1 / 12) - 1;
  let v = have;
  for (let m = 1; m <= 12 * 80; m++) {
    v = v * (1 + r) + left;
    if (v >= target) return { target, share, years: m / 12 };
  }
  return { target, share, years: null };
}

/** The runway as a row of months that light up. */
/** Runway as a story: your accounts emptying month by month if no income
 *  came in (the bar per month is what's left), the healthy 3–6 month zone,
 *  the sum behind it, and what it takes to reach six months. */
function RunwayDrain({ months, goal, cash, monthly, left, currency }: { months: number; goal: number; cash: number; monthly: number; left: number; currency: string }) {
  const n = Math.min(13, Math.max(goal + 1, Math.ceil(months) + 1));
  const start = new Date();
  const empty = new Date(start.getFullYear(), start.getMonth() + Math.floor(months), 1);
  const toSix = Math.max(0, monthly * goal - cash);
  const monthsToSix = left > 0 ? Math.ceil(toSix / left) : null;
  return (
    <div className="pf-tour-drain">
      <div className="pf-tour-drain-plot" aria-hidden>
        {/* The goal (Settings): enough to get through that many months without income. */}
        <span className="pf-tour-drain-goal" style={{ left: `${(goal / n) * 100}%` }}><small>{t("Goal: {n} months", { n: goal })}</small></span>
        {Array.from({ length: n }, (_, k) => {
          const v = Math.max(0, cash - monthly * k);
          return (
            <i key={k} style={{ ["--h" as string]: `${(v / Math.max(cash, 1)) * 100}%`, ["--d" as string]: `${0.3 + k * 0.06}s` }} data-gone={v <= 0}>
              <small>{shortMonth(new Date(start.getFullYear(), start.getMonth() + k, 1))}</small>
            </i>
          );
        })}
      </div>
      {/* How far along: 0 → 6 months, the minimum (3) ticked. */}
      <div className="pf-tour-drain-meter">
        <div><i style={{ width: `${Math.min(months / goal, 1) * 100}%` }} />{goal > 3 && <span style={{ left: `${(3 / goal) * 100}%` }} />}</div>
        <small>
          <span>{t("{n} of {goal} months", { n: months.toLocaleString(intlLocale(), { maximumFractionDigits: 1 }), goal })}</span>
          <span>{months >= goal ? t("Goal reached") : months >= 3 ? t("Past the minimum of 3 months") : t("Below the minimum of 3 months")}</span>
        </small>
      </div>
      <div className="pf-tour-drain-sum pf-rounded">
        <span>{money(cash, currency)}<small>{t("in your accounts")}</small></span>
        <b>÷</b>
        <span>{money(monthly, currency)}<small>{t("a month of fixed costs and budgets")}</small></span>
        <b>=</b>
        <span style={{ color: "#fbbf24" }}>{months.toLocaleString(intlLocale(), { maximumFractionDigits: 1 })}<small>{t("months")}</small></span>
      </div>
      <small className="pf-tour-drain-note">
        {toSix <= 0
          ? t("Your goal of {n} months is reached: a healthy buffer.", { n: goal })
          : monthsToSix != null
            ? t("Without income the money would run out in {month}. To reach {goal} months you need {amount} more — about {n} months of saving what's left.", { month: monthYear(empty), amount: money(toSix, currency), n: monthsToSix, goal })
            : t("Without income the money would run out in {month}. To reach {goal} months you need {amount} more.", { month: monthYear(empty), amount: money(toSix, currency), goal })}
      </small>
    </div>
  );
}

