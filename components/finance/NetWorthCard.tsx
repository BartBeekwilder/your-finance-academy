"use client";

import InfoTip from "./InfoTip";

import { t } from "@/lib/i18n";
import { useTickerNow } from "@/lib/motion";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { money } from "@/lib/finance/format";
import LiveAmount from "./LiveAmount";

// The iOS NetWorthTicker: a live figure that creeps forward at the user's
// recent monthly pace (income − expenses), plus This Day / Month / Year
// deltas. The small trailing digits are the real fractions of a cent.
// Each delta splits into work (income − expenses) and investments (what the
// holdings did on the market by themselves), when there are live quotes.
//
// Behind it, quietly: equity over the years (imported year-end stands, this
// year live from the balance sheet) as a faint area with tiny year marks;
// pointing at a year reads it out in the caption.

export type EquityYear = { year: number; equity: number; live?: boolean };

export default function NetWorthCard({
  base,
  monthlyPace,
  monthDelta,
  yearDelta,
  invest,
  currency,
  history = [],
}: {
  base: number;
  monthlyPace: number;
  monthDelta: number;
  yearDelta: number;
  /** Market change of the investments per period (absent without live quotes). */
  invest?: { day: number; month: number; year: number };
  currency: string;
  /** Equity per year, oldest first (the background chart). */
  history?: EquityYear[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const now = useTickerNow();

  const perMs = monthlyPace / (30.44 * 24 * 3600 * 1000);
  const d = new Date(now);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const live = base + (now - startOfMonth) * perMs;
  const dayDelta = (now - startOfDay) * perMs;
  const up = monthlyPace >= 0;

  return (
    <section
      className="pf-card pf-nwc"
      style={{
        padding: 18,
        borderRadius: 18,
        background: `linear-gradient(135deg, ${up ? "rgba(48,209,88,.20)" : "rgba(255,159,10,.20)"}, rgba(10,132,255,.06)), var(--pf-card)`,
      }}
    >
      {history.length >= 2 && <EquityBackdrop history={history} hover={hover} onHover={setHover} />}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.05em", color: "var(--pf-ink-2)" }}>
        <span className="pf-pulse" /> {t("Liquidity").toUpperCase()} · {t("live").toUpperCase()}
        <InfoTip id="liquidity" />
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 4, flexWrap: "wrap", marginTop: 4, pointerEvents: "none" }}>
        <LiveAmount value={live} currency={currency} size="2.25rem" />
        {up ? (
          <ArrowUpRight size={16} strokeWidth={3} color="var(--pf-green)" style={{ marginTop: 8 }} />
        ) : (
          <ArrowDownRight size={16} strokeWidth={3} color="var(--pf-orange)" style={{ marginTop: 8 }} />
        )}
        <div style={{ marginLeft: "auto", display: "grid", gap: 3, textAlign: "right", fontSize: "0.72rem", paddingTop: 4 }}>
          <Stat label={t("This Day")} work={dayDelta} invest={invest?.day} currency={currency} />
          <Stat label={t("This Month")} work={monthDelta} invest={invest?.month} currency={currency} />
          <Stat label={t("This Year")} work={yearDelta} invest={invest?.year} currency={currency} />
        </div>
      </div>
      <p style={{ position: "relative", margin: "6px 0 0", fontSize: "0.68rem", color: "var(--pf-ink-3)", pointerEvents: "none" }}>
        {t("Estimated live pace, based on your recent months")}
      </p>
      {history.length >= 2 && (
        <p key={hover ?? "all"} className="pf-readout pf-nwc-caption">
          {hover === null
            ? t("Equity {from}–{to}: {a} → {b}", {
                from: history[0].year,
                to: history[history.length - 1].year,
                a: money(history[0].equity, currency, { compact: true }),
                b: money(history[history.length - 1].equity, currency, { compact: true }),
              })
            : `${t("Equity")} ${history[hover].year}${history[hover].live ? ` · ${t("today")}` : ""}: ${money(history[hover].equity, currency)}${
                hover > 0 ? ` (${money(history[hover].equity - history[hover - 1].equity, currency, { signed: true, compact: true })})` : ""
              }`}
        </p>
      )}
    </section>
  );
}

function Stat({ label, work, invest, currency }: { label: string; work: number; invest?: number; currency: string }) {
  const value = work + (invest ?? 0);
  const tone = (v: number) => (v >= 0 ? "var(--pf-green)" : "var(--pf-orange)");
  return (
    <div>
      <span style={{ color: "var(--pf-ink-2)" }}>{label} </span>
      <span className="pf-rounded" style={{ fontWeight: 600, color: tone(value) }}>
        {money(value, currency, { signed: true })}
      </span>
      {invest !== undefined && (
        <div className="pf-nwc-split">
          {t("Work")} <span className="pf-rounded" style={{ color: tone(work) }}>{money(work, currency, { signed: true })}</span>
          {" · "}
          {t("Investments")} <span className="pf-rounded" style={{ color: tone(invest) }}>{money(invest, currency, { signed: true })}</span>
        </div>
      )}
    </div>
  );
}

/** The quiet equity-over-the-years area behind the card. */
function EquityBackdrop({ history, hover, onHover }: { history: EquityYear[]; hover: number | null; onHover: (i: number | null) => void }) {
  const W = 1000, H = 100;
  const vals = history.map((h) => h.equity);
  const lo = Math.min(0, ...vals), hi = Math.max(...vals);
  const span = Math.max(hi - lo, 1);
  const x = (i: number) => (i / (history.length - 1)) * W;
  const y = (v: number) => H - 6 - ((v - lo) / span) * (H - 18);
  const pts = history.map((h, i) => [x(i), y(h.equity)] as const);
  let line = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    line += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  const area = `${line} L${W},${H} L0,${H} Z`;
  const last = pts[pts.length - 1];
  return (
    <div className="pf-nwc-bg" onMouseLeave={() => onHover(null)}>
      <div className="pf-nwc-plot">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="pf-nwc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30d158" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#30d158" stopOpacity="0" />
          </linearGradient>
        </defs>
        {lo < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />}
        <path d={area} fill="url(#pf-nwc-fill)" className="pf-nwc-area" />
        <path d={line} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="pf-nwc-line" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="rgba(255,255,255,0.14)" vectorEffect="non-scaling-stroke" />}
      </svg>
      <span className="pf-nwc-dot" style={{ left: `${(last[0] / W) * 100}%`, top: `${(last[1] / H) * 100}%` }} />
      {hover !== null && <span className="pf-nwc-dot pf-nwc-dot-hover" style={{ left: `${(pts[hover][0] / W) * 100}%`, top: `${(pts[hover][1] / H) * 100}%` }} />}
      </div>
      <div className="pf-nwc-years">
        {history.map((h, i) => (
          <span
            key={h.year}
            data-on={hover === i}
            style={{ left: `${(x(i) / W) * 100}%` }}
            onMouseEnter={() => onHover(i)}
          >
            {i === 0 || i === history.length - 1 || hover === i || history.length <= 6 ? h.year : "·"}
          </span>
        ))}
      </div>
      {/* Hover areas per year, full height, on the plot's own width. */}
      <div className="pf-nwc-hits">
        {history.map((h, i) => (
          <span key={`hit${h.year}`} className="pf-nwc-hit" style={{ left: `${((x(i) - W / (2 * (history.length - 1))) / W) * 100}%`, width: `${100 / (history.length - 1)}%` }} onMouseEnter={() => onHover(i)} />
        ))}
      </div>
    </div>
  );
}
