"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { money, monthName } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import { monthWrapped, type RingRow, type Wrapped } from "@/lib/finance/wrapped";
import { useTween } from "./charts";
import CategoryIcon from "./CategoryIcon";
import { AssetIcon, pct, tone } from "./Portfolio";

// Month Wrapped: the closed month as story cards (Spotify Wrapped style) —
// tap the right side or → for the next card, the left side or ← to go back.
// Segments along the top show where you are. Each card has its own colour
// and its numbers count up as it comes in.

type Card = { key: string; bg: string; body: ReactNode };

export default function MonthWrapped({ data, month, now, currency }: { data: FinanceData; month: Date; now: Date; currency: string }) {
  const w = useMemo(() => monthWrapped(data, month, now), [data, month, now]);
  const [i, setI] = useState(0);
  const name = monthName(month);

  const cards: Card[] = [
    { key: "intro", bg: "linear-gradient(160deg, #3b1d8f 0%, #1a1240 55%, #0d0d14 100%)", body: <Intro w={w} name={name} currency={currency} /> },
    ...(w.top.length ? [{ key: "where", bg: "linear-gradient(160deg, #8f1d4a 0%, #3d1027 55%, #0d0d14 100%)", body: <Where w={w} currency={currency} /> }] : []),
    ...(w.rings.length ? [{ key: "rings", bg: "linear-gradient(160deg, #0f5c4a 0%, #0b2c26 55%, #0d0d14 100%)", body: <RingsCard w={w} currency={currency} /> }] : []),
    ...(w.investments ? [{ key: "inv", bg: "linear-gradient(160deg, #10427f 0%, #0c2340 55%, #0d0d14 100%)", body: <Investments w={w} name={name} currency={currency} /> }] : []),
    { key: "equity", bg: "linear-gradient(160deg, #6b4a0f 0%, #2e2109 55%, #0d0d14 100%)", body: <Equity w={w} name={name} currency={currency} /> },
    { key: "facts", bg: "linear-gradient(160deg, #3d3d48 0%, #1b1b22 55%, #0d0d14 100%)", body: <Facts w={w} name={name} currency={currency} /> },
  ];
  const n = cards.length;
  const go = (d: number) => setI((x) => Math.min(Math.max(x + d, 0), n - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, n - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);

  const card = cards[Math.min(i, n - 1)];
  return (
    <div className="pf-wr">
      <div className="pf-wr-segs" aria-hidden>
        {cards.map((c, k) => (
          <button key={c.key} type="button" tabIndex={-1} data-state={k < i ? "done" : k === i ? "now" : "next"} onClick={() => setI(k)}>
            <i />
          </button>
        ))}
      </div>
      <div key={card.key} className="pf-wr-card" style={{ background: card.bg }} onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if ((e.target as Element).closest("button, a, input")) return;
        go(e.clientX - r.left < r.width * 0.3 ? -1 : 1);
      }}>
        {card.body}
        <div className="pf-wr-nav">
          <button type="button" aria-label={t("Previous")} disabled={i === 0} onClick={() => go(-1)}>
            <ChevronLeft size={18} />
          </button>
          <span>
            {i + 1} / {n}
          </span>
          <button type="button" aria-label={t("Next")} disabled={i === n - 1} onClick={() => go(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** An amount that counts up from 0 as its card comes in. */
function Count({ value, currency, signed }: { value: number; currency: string; signed?: boolean }) {
  const [v] = useTween([value], 1100);
  return <span className="pf-rounded">{money(v, currency, { signed })}</span>;
}

function Intro({ w, name, currency }: { w: Wrapped; name: string; currency: string }) {
  const better = w.saved - w.savedBefore;
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("Your {month}", { month: name })}</span>
      <h3 className="pf-wr-title">{w.saved >= 0 ? t("This is what you kept aside.") : t("You spent more than came in.")}</h3>
      <div className="pf-wr-huge" style={{ color: w.saved >= 0 ? "#7dffa5" : "#ff8a80" }}>
        <Count value={w.saved} currency={currency} signed />
      </div>
      <div className="pf-wr-trio">
        <Stat label={t("In")} value={<Count value={w.income} currency={currency} />} />
        <Stat label={t("Out")} value={<Count value={w.spent} currency={currency} />} />
        <Stat label={t("Savings rate")} value={<span className="pf-rounded">{Math.round(w.savingsRate * 100)}%</span>} />
      </div>
      {w.savedBefore !== 0 && (
        <p className="pf-wr-line">
          {better >= 0 ? t("{amount} more than the month before.", { amount: money(better, currency) }) : t("{amount} less than the month before.", { amount: money(-better, currency) })}
        </p>
      )}
    </div>
  );
}

function Where({ w, currency }: { w: Wrapped; currency: string }) {
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("Where it went")}</span>
      <h3 className="pf-wr-title">{t("{name} took the most.", { name: w.top[0].category.name })}</h3>
      <div className="pf-wr-list">
        {w.top.map((r, k) => (
          <div key={r.category.id} className="pf-wr-bar" style={{ ["--d" as string]: `${0.15 + k * 0.12}s` }}>
            <span className="pf-wr-rank">{k + 1}</span>
            <CategoryIcon icon={r.category.icon} colorHex={r.category.color_hex} size={30} />
            <span className="pf-wr-bar-name">
              {r.category.name}
              <i style={{ width: `${Math.max(r.share * 100, 2)}%`, background: `#${r.category.color_hex}` }} />
            </span>
            <b className="pf-rounded">{money(r.spent, currency)}</b>
            <span className="pf-wr-dim">{Math.round(r.share * 100)}%</span>
          </div>
        ))}
      </div>
      {w.biggest && (
        <p className="pf-wr-line">
          {t("Biggest single expense: {what} — {amount}.", { what: w.biggest.note || t("no description"), amount: money(Number(w.biggest.amount), currency) })}
        </p>
      )}
    </div>
  );
}

function RingsCard({ w, currency }: { w: Wrapped; currency: string }) {
  const withBudget = w.rings.some((r) => r.kind === "budget");
  const total = w.rings.filter((r) => r.target > 0).length;
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{withBudget ? t("Budgets") : t("Against your average")}</span>
      <h3 className="pf-wr-title">
        {withBudget ? t("{n} of {total} within budget.", { n: w.kept, total }) : t("{n} of {total} at or below your average.", { n: w.kept, total })}
      </h3>
      <div className="pf-wr-rings">
        {w.rings.slice(0, 12).map((r, k) => (
          <CategoryRing key={r.category.id} r={r} currency={currency} delay={0.1 + k * 0.08} />
        ))}
      </div>
      <p className="pf-wr-line pf-wr-dim">
        {withBudget ? t("A full ring is the budget; a second lap in red is over it.") : t("No budgets yet: the ring is your average of the three months before. Set budgets in the next step.")}
      </p>
    </div>
  );
}

/** One category as a watch-style ring: spent against the target, a red
 *  second lap for what went over. */
function CategoryRing({ r, currency, delay }: { r: RingRow; currency: string; delay: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const v = r.target > 0 ? r.spent / r.target : r.spent > 0 ? 2 : 0;
  const R = 34, len = 2 * Math.PI * R;
  const color = `#${r.category.color_hex}`;
  const over = v > 1;
  return (
    <div className="pf-wr-ring" title={`${r.category.name}: ${money(r.spent, currency)} / ${money(r.target, currency)}`}>
      <svg viewBox="0 0 84 84" width={84} height={84}>
        <g transform="rotate(-90 42 42)">
          <circle cx="42" cy="42" r={R} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="9" />
          <circle cx="42" cy="42" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${len * Math.min(v, 1) * (shown ? 1 : 0)} ${len}`} style={{ transition: `stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s` }} />
          {over && (
            <circle cx="42" cy="42" r={R} fill="none" stroke="#ff453a" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${len * Math.min(v - 1, 1) * (shown ? 1 : 0)} ${len}`} style={{ transition: `stroke-dasharray 1s cubic-bezier(0.22, 1, 0.36, 1) ${delay + 1.1}s`, filter: "drop-shadow(0 0 5px rgba(255,69,58,0.7))" }} />
          )}
        </g>
      </svg>
      <span className="pf-wr-ring-icon">
        <CategoryIcon icon={r.category.icon} colorHex={r.category.color_hex} size={26} />
      </span>
      <span className="pf-wr-ring-name">{r.category.name}</span>
      <span className="pf-wr-ring-pct pf-rounded" style={{ color: over ? "#ff8a80" : "#7dffa5" }}>
        {r.target > 0 ? `${Math.round(v * 100)}%` : money(r.spent, currency)}
      </span>
    </div>
  );
}

function Investments({ w, name, currency }: { w: Wrapped; name: string; currency: string }) {
  const inv = w.investments!;
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("Investments in {month}", { month: name })}</span>
      <h3 className="pf-wr-title">{inv.change >= 0 ? t("Your investments grew.") : t("A dip for your investments.")}</h3>
      <div className="pf-wr-huge" style={{ color: inv.change >= 0 ? "#7dffa5" : "#ff8a80" }}>
        <Count value={inv.change} currency={currency} signed /> <span className="pf-wr-huge-pct">{pct(inv.share)}</span>
      </div>
      <div className="pf-wr-trio">
        <Stat label={t("Start of the month")} value={<Count value={inv.start} currency={currency} />} />
        <Stat label={t("End of the month")} value={<Count value={inv.end} currency={currency} />} />
      </div>
      {inv.count > 1 && (
        <div className="pf-wr-duo">
          {[{ label: t("Best"), h: inv.best }, { label: t("Weakest"), h: inv.worst }].map(({ label, h }) => (
            <div key={label} className="pf-wr-hold">
              <span className="pf-wr-dim">{label}</span>
              <span className="pf-wr-hold-row">
                <AssetIcon symbol={h.holding.symbol} type={h.holding.asset_type} size={26} />
                <b>{h.holding.name}</b>
              </span>
              <span className="pf-rounded" style={{ color: tone(h.change) }}>
                {money(h.change, currency, { signed: true })} · {pct(h.share)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Equity({ w, name, currency }: { w: Wrapped; name: string; currency: string }) {
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("Equity")}</span>
      <h3 className="pf-wr-title">{w.equityChange >= 0 ? t("Richer than a month ago.") : t("A little less than a month ago.")}</h3>
      <div className="pf-wr-huge" style={{ color: w.equityChange >= 0 ? "#ffd27d" : "#ff8a80" }}>
        <Count value={w.equityChange} currency={currency} signed />
      </div>
      <p className="pf-wr-line">{t("Your equity at the end of {month}: {amount}.", { month: name, amount: money(w.equity, currency) })}</p>
    </div>
  );
}

function Facts({ w, name, currency }: { w: Wrapped; name: string; currency: string }) {
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("{month} in facts", { month: name })}</span>
      <h3 className="pf-wr-title">{t("A few things worth knowing.")}</h3>
      <div className="pf-wr-facts">
        <Fact big={String(w.facts.expenses)} text={t("expenses entered")} />
        <Fact big={String(w.facts.noSpend)} text={t("days without spending")} />
        {w.facts.topDay && <Fact big={money(w.facts.topDay.amount, currency)} text={t("on {day}, your most expensive day", { day: `${w.facts.topDay.date.toLocaleDateString(intlLocale(), { weekday: "long" })} ${w.facts.topDay.date.getDate()} ${monthName(w.facts.topDay.date)}` })} />}
        <Fact big={money(w.fixed, currency)} text={t("in fixed costs")} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="pf-wr-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Fact({ big, text }: { big: string; text: string }) {
  return (
    <div className="pf-wr-fact">
      <b className="pf-rounded">{big}</b>
      <span>{text}</span>
    </div>
  );
}
