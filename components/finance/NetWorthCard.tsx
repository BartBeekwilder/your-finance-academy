"use client";

import InfoTip from "./InfoTip";

import { t } from "@/lib/i18n";
import { useTickerNow } from "@/lib/motion";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState, type PointerEvent } from "react";
import { cap, money, monthName, shortMonth } from "@/lib/finance/format";
import { intlLocale } from "@/lib/i18n";
import LiveAmount from "./LiveAmount";

// The first tile of the app (Bart, 19 Nov): liquidity live, on the same
// model as the Liquidity page (netWorthFigures.liveChange), with
//   • the period's path: from the 1st (or 1 January, when the dashboard is on
//     Year) to now, then dashed to what's expected at its end;
//   • where it sits: one bar — directly available, savings, investments;
//   • day / month / year as one total each; a tap splits them into work
//     (income − expenses) and investments (the market by itself).

export default function NetWorthCard({
  base,
  liveChange,
  workChange,
  monthForecast,
  workBefore,
  savings,
  investments,
  invest,
  currency,
  year,
}: {
  /** Liquidity on the 1st of this month. */
  base: number;
  /** This month's change at a moment, work + market (netWorthFigures.liveChange). */
  liveChange: (at: number) => number;
  /** The same from income and spending only (the rows add the market as `invest`). */
  workChange: (at: number) => number;
  /** This month's expected income − spending (yearForecast). */
  monthForecast: number;
  /** Income − spending of this year's finished months. */
  workBefore: number;
  /** On savings accounts now. */
  savings: number;
  /** Investments at market value now. */
  investments: number;
  /** Market change of the investments per period (absent without live quotes). */
  invest?: { day: number; month: number; year: number };
  currency: string;
  /** The dashboard on Year: the path runs over the year (Bart, 20 Nov). */
  year?: { start: number; finished: number[]; rest: number };
}) {
  const [split, setSplit] = useState(false);
  const now = useTickerNow();
  const d = new Date(now);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Everything from the same moment, so start + this month = the big number.
  const work = workChange(now);
  const live = base + liveChange(now);
  const dayDelta = work - workChange(startOfDay);
  const monthDelta = work;
  const yearDelta = workBefore + work;
  // The market part of this month live too (the year and day from the quotes).
  const market = invest && { ...invest, month: liveChange(now) - work };
  // Ahead: the rest of the month's forecast on top of now (no market).
  const monthEnd = live + monthForecast - work;
  const up = live >= base;
  const canSplit = invest !== undefined;

  return (
    <section
      className="pf-card pf-nwc"
      style={{
        padding: 18,
        borderRadius: 18,
        background: `linear-gradient(135deg, ${up ? "rgba(48,209,88,.20)" : "rgba(255,159,10,.20)"}, rgba(10,132,255,.06)), var(--pf-card)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.05em", color: "var(--pf-ink-2)" }}>
        <span className="pf-pulse" /> {t("Liquidity").toUpperCase()} · {t("live").toUpperCase()}
        <InfoTip id="liquidity" />
      </div>
      <div className="pf-nwc-top">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
          <LiveAmount value={live} currency={currency} size="2.25rem" />
          {up ? (
            <ArrowUpRight size={16} strokeWidth={3} color="var(--pf-green)" style={{ marginTop: 8 }} />
          ) : (
            <ArrowDownRight size={16} strokeWidth={3} color="var(--pf-orange)" style={{ marginTop: 8 }} />
          )}
        </div>
        {/* One total per period; with live quotes a tap shows what work and
            the market each added, in columns so the amounts line up. */}
        <button
          type="button"
          className="pf-nwc-stats"
          data-split={(split && canSplit) || undefined}
          data-can-split={canSplit || undefined}
          onClick={() => canSplit && setSplit((s) => !s)}
          disabled={!canSplit}
          title={canSplit ? (split ? t("Show the total only") : t("Show work and investments")) : undefined}
        >
          {/* Always there, folded away: opening slides the columns out
              instead of popping them in. */}
          {canSplit && (
            <>
              <span className="pf-nwc-head" />
              <span className="pf-nwc-head">{t("Total")}</span>
              <span className="pf-nwc-head pf-nwc-col">{t("Work")}</span>
              <span className="pf-nwc-head pf-nwc-col">{t("Investments")}</span>
            </>
          )}
          <Stat label={t("This Day")} work={dayDelta} invest={market?.day} split={split && canSplit} currency={currency} />
          <Stat label={t("This Month")} work={monthDelta} invest={market?.month} split={split && canSplit} currency={currency} />
          <Stat label={t("This Year")} work={yearDelta} invest={market?.year} split={split && canSplit} currency={currency} />
        </button>
      </div>

      <PeriodPath key={year ? "y" : "m"} base={base} liveChange={liveChange} monthEnd={monthEnd} year={year} now={now} currency={currency} />
      <MixBar total={live} savings={savings} investments={investments} currency={currency} />
    </section>
  );
}

function Stat({ label, work, invest, split, currency }: { label: string; work: number; invest?: number; split: boolean; currency: string }) {
  const value = work + (invest ?? 0);
  const tone = (v: number) => (v >= 0 ? "var(--pf-green)" : "var(--pf-orange)");
  return (
    <>
      <span className="pf-nwc-stat-label">{label}</span>
      <b className="pf-rounded" style={{ color: tone(value) }}>{money(value, currency, { signed: true })}</b>
      {invest !== undefined && (
        <>
          <span className="pf-rounded pf-nwc-split pf-nwc-col" aria-hidden={!split} style={{ color: tone(work) }}>{money(work, currency, { signed: true })}</span>
          <span className="pf-rounded pf-nwc-split pf-nwc-col" aria-hidden={!split} style={{ color: tone(invest) }}>{money(invest, currency, { signed: true })}</span>
        </>
      )}
    </>
  );
}

/** The month (or the year) so far, solid, and what's expected by its end, dashed. */
function PeriodPath({ base, liveChange, monthEnd, year, now, currency }: { base: number; liveChange: (at: number) => number; monthEnd: number; year?: { start: number; finished: number[]; rest: number }; now: number; currency: string }) {
  const d = new Date(now);
  const y = d.getFullYear(), m = d.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const start = year ? new Date(y, 0, 1).getTime() : new Date(y, m, 1).getTime();
  const end = year ? new Date(y + 1, 0, 1).getTime() : new Date(y, m + 1, 1).getTime();
  const span = end - start;
  const from = year ? year.start : base;
  // The month: one point per day so far. The year: one per finished month
  // (its last moment), the days of this month, then now.
  const pts: [number, number][] = [[start, from]];
  if (year) {
    let v = year.start;
    year.finished.forEach((change, i) => { v += change; pts.push([new Date(y, i + 1, 1).getTime() - 1, v]); });
  }
  for (let day = 1; day < d.getDate(); day++) {
    const at = new Date(y, m, day + 1).getTime();
    pts.push([at, base + liveChange(at)]);
  }
  pts.push([now, base + liveChange(now)]);
  // The year's end: this month's expected end plus the months after it.
  const periodEnd = year ? monthEnd + year.rest : monthEnd;
  void days;
  const vals = [...pts.map((p) => p[1]), periodEnd];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.15, 1);
  const W = 1000, H = 90;
  const x = (t: number) => ((t - start) / span) * W;
  const yv = (v: number) => H - 4 - ((v - lo + pad) / (hi - lo + pad * 2)) * (H - 8);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${yv(p[1]).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const area = `${line} L${x(last[0]).toFixed(1)},${H} L0,${H} Z`;
  const nowX = (x(last[0]) / W) * 100;

  // Pointing at the line reads out that day: the days so far as booked,
  // now, and further on what's expected (on the dashed line to the month end).
  const [hover, setHover] = useState<{ t: number; v: number; kind: "start" | "day" | "now" | "expected" } | null>(null);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const at = start + Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * span;
    if (at <= last[0]) {
      let i = 0;
      for (let k = 1; k < pts.length; k++) if (Math.abs(pts[k][0] - at) < Math.abs(pts[i][0] - at)) i = k;
      setHover({ t: pts[i][0], v: pts[i][1], kind: i === 0 ? "start" : i === pts.length - 1 ? "now" : "day" });
    } else {
      const f = (at - last[0]) / Math.max(end - last[0], 1);
      setHover({ t: at, v: last[1] + (periodEnd - last[1]) * f, kind: "expected" });
    }
  };
  // The point a day stands for is its end; read it as that day.
  const dayOf = (t: number, kind: string) => new Date(kind === "day" ? t - 1 : t);
  const date = (d: Date) => `${cap(d.toLocaleDateString(intlLocale(), { weekday: "short" }))} ${d.getDate()} ${shortMonth(d)}`;
  const hoverText = hover && (() => {
    // A finished month's point (the year) reads as that month.
    const monthPoint = year && hover.kind === "day" && new Date(hover.t).getMonth() !== m;
    const when = hover.kind === "now" ? t("Now") : hover.kind === "start" ? (year ? t("Start of the year") : t("Start of the month")) : monthPoint ? `${monthName(new Date(hover.t))} ${y}` : date(dayOf(hover.t, hover.kind));
    const head = hover.kind === "expected" ? t("Expected on {date}", { date: date(new Date(hover.t)) }) : when;
    const diff = hover.kind === "start" ? "" : `${money(hover.v - from, currency, { signed: true })} ${year ? t("since 1 January") : t("since the 1st")}`;
    return { head, value: money(hover.v, currency), diff };
  })();
  return (
    <div className="pf-nwc-path">
      <div className="pf-nwc-plot" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${t("Expected at the end of {month}", { month: year ? String(y) : monthName(d) })} ${money(periodEnd, currency)}`}>
          <defs>
            <linearGradient id="pf-nwc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#30d158" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#30d158" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#pf-nwc-fill)" className="pf-nwc-area" />
          <path d={line} fill="none" stroke="#30d158" strokeWidth={2} vectorEffect="non-scaling-stroke" className="pf-nwc-line" />
          <path d={`M${x(last[0]).toFixed(1)},${yv(last[1]).toFixed(1)} L${x(end)},${yv(periodEnd).toFixed(1)}`} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="pf-nwc-dot" style={{ left: `${nowX}%`, top: `${(yv(last[1]) / H) * 100}%` }} />
        <span className="pf-nwc-dot pf-nwc-dot-end" style={{ left: "100%", top: `${(yv(periodEnd) / H) * 100}%` }} />
        {hover && hoverText && (
          <>
            <span className="pf-nwc-hair" style={{ left: `${(x(hover.t) / W) * 100}%` }} />
            <span className="pf-nwc-dot pf-nwc-dot-hover" data-expected={hover.kind === "expected" || undefined} style={{ left: `${(x(hover.t) / W) * 100}%`, top: `${(yv(hover.v) / H) * 100}%` }} />
            <span className="pf-nwc-tip" style={{ left: `${Math.min(Math.max((x(hover.t) / W) * 100, 12), 88)}%` }}>
              <span>{hoverText.head}</span>
              <b className="pf-rounded">{hoverText.value}</b>
              {hoverText.diff && <em>{hoverText.diff}</em>}
            </span>
          </>
        )}
      </div>
      <div className="pf-nwc-path-foot pf-readout">
        <span>
          {year ? t("Start of the year") : t("Start of the month")} <b>{money(from, currency)}</b>
        </span>
        <span style={{ textAlign: "right" }}>
          {t("Expected at the end of {month}", { month: year ? String(y) : monthName(d) })} <b>{money(periodEnd, currency)}</b>
        </span>
      </div>
    </div>
  );
}

/** Where the money sits: directly available, savings, investments. */
function MixBar({ total, savings, investments, currency }: { total: number; savings: number; investments: number; currency: string }) {
  const parts = [
    { key: "available", label: t("Directly available"), hint: t("Current accounts, cash and what's still to come in"), value: total - savings - investments, color: "#40c8e0" },
    { key: "savings", label: t("Savings"), hint: t("Your savings accounts"), value: savings, color: "#30d158" },
    { key: "investments", label: t("Investments"), hint: t("At today's market value"), value: investments, color: "#bf5af2" },
  ].filter((p) => Math.abs(p.value) >= 0.5);
  const sum = parts.reduce((a, p) => a + Math.max(p.value, 0), 0);
  if (!sum) return null;
  return (
    <div className="pf-nwc-mix">
      <div className="pf-nwc-mix-bar" role="img" aria-label={parts.map((p) => `${p.label} ${money(p.value, currency)}`).join(", ")}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} style={{ flexGrow: p.value / sum, background: p.color }} title={`${p.label}: ${money(p.value, currency)} (${Math.round((p.value / sum) * 100)}%) — ${p.hint}`} />
        ))}
      </div>
      <div className="pf-nwc-mix-legend">
        {parts.map((p) => (
          <span key={p.key} title={p.hint}>
            <i style={{ background: p.color }} />
            {p.label}
            <b className="pf-rounded">{money(p.value, currency, { compact: Math.abs(p.value) >= 100_000 })}</b>
            {sum > 0 && p.value > 0 && <em>{Math.round((p.value / sum) * 100)}%</em>}
          </span>
        ))}
      </div>
    </div>
  );
}
