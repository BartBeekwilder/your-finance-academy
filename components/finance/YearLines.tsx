"use client";

import { useEffect, useRef, useState } from "react";
import { monthToDate, summarize } from "@/lib/finance/calc";
import { money, monthYear, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import Segmented from "./Segmented";

// Income vs Spent as two lines, with a Month / Year toggle:
//   Year  — one point per month, Jan–Dec. The current month is live (same
//           figures as the dashboard tiles); its segment is dashed.
//   Month — running totals day by day through this month, ending at "now".
//
// Both views live on one time axis, measured in months (Jan = 0), and they
// share one point: "now" — the live red and green dots. In Year view that
// is this month's point (t = current). Month view lays the days out so
// today lands on that same t (day d sits at current − (today − d) / days),
// so the daily line ends exactly on the dots. Switching animates a camera
// centred on the dots: the visible x-range zooms (log-scale, like a map
// zoom) between the whole year and this month, the y-scale eases to fit,
// the monthly lines fade out as the daily ones fade in, the axis labels
// ride along, and the dots stay on screen as the focal point throughout.
// Zooming out is the same motion in reverse.

const GREEN = "#30d158";
const RED = "#ff453a";
const W = 480, H = 150, PAD = 6;
type Pt = { t: number; income: number; spent: number; full: string };

export default function YearLines({
  data,
  now,
  currency,
  monthlyIncome,
}: {
  data: FinanceData;
  now: Date;
  currency: string;
  /** This month's projected net income, which the live point accrues toward. */
  monthlyIncome: number;
}) {
  const [mode, setMode] = useState<"month" | "year">("year");
  const [sel, setSel] = useState<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const live = new Date(tick);
  const year = now.getFullYear();
  const current = now.getMonth();
  const days = new Date(year, current + 1, 0).getDate();
  const fraction = Math.min(Math.max((tick - new Date(year, current, 1).getTime()) / (days * 86_400_000), 0), 1);

  // ---- Both series, on the shared month axis --------------------------------
  const yearPts: Pt[] = Array.from({ length: current + 1 }, (_, m) => {
    const d = new Date(year, m, 1);
    const s = summarize(data.transactions, d);
    const isNow = m === current;
    return {
      t: m,
      full: `${monthYear(d)}${isNow ? " · live" : ""}`,
      income: isNow ? monthlyIncome * fraction : s.income,
      spent: isNow ? s.fixed * fraction + s.variable : s.spent,
    };
  });
  const today = live.getDate();
  const dayT = (d: number) => current - (today - d) / days; // today → t = current
  const monthPts: Pt[] = monthToDate(data, live).points.map((p) => ({
    t: dayT(p.day),
    full:
      p.day === live.getDate()
        ? "Today · live"
        : new Date(year, current, p.day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    income: p.income,
    spent: p.spent,
  }));

  // ---- Camera: 0 = whole year, 1 = this month --------------------------------
  const z = useZoom(mode === "month" ? 1 : 0, 950);
  const yearView = { left: 0, width: 11, max: niceMax(Math.max(1, ...yearPts.flatMap((p) => [p.income, p.spent]))) };
  const monthView = { left: dayT(1), width: (days - 1) / days, max: niceMax(Math.max(1, ...monthPts.flatMap((p) => [p.income, p.spent]))) };
  // Zoom around "now" (the dots): the range scales about t = current, and
  // the dots glide from their place in the year to today's place in the month.
  const anchor = current;
  const anchorAt = lerp((anchor - yearView.left) / yearView.width, (anchor - monthView.left) / monthView.width, z);
  const width = yearView.width * Math.pow(monthView.width / yearView.width, z);
  const left = anchor - anchorAt * width;
  const max = Math.exp(lerp(Math.log(yearView.max), Math.log(monthView.max), z));

  const x = (t: number) => ((t - left) / width) * W;
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = (pts: Pt[], key: "income" | "spent") => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p[key])}`).join(" ");

  const yearOpacity = 1 - smooth(z, 0.35, 0.85);
  const monthOpacity = smooth(z, 0.15, 0.65);
  const settled = z === 0 || z === 1;

  // ---- Readout / hover (in whichever view is showing) ------------------------
  const pts = mode === "year" ? yearPts : monthPts;
  const last = pts.length - 1;
  const shown = sel !== null && sel <= last ? sel : last;
  const p = pts[shown];
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!settled) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = left + ((e.clientX - r.left) / r.width) * width;
    let best = 0;
    pts.forEach((q, i) => {
      if (Math.abs(q.t - t) < Math.abs(pts[best].t - t)) best = i;
    });
    setSel(best);
  };

  // Axis labels for both views; each rides the camera and fades with its view.
  const monthLabels = Array.from({ length: 12 }, (_, m) => ({ t: m, text: shortMonth(new Date(year, m, 1)).slice(0, 1), bold: m === current, dim: m > current }));
  const dayLabels = Array.from({ length: days }, (_, i) => i + 1)
    .filter((d) => d === 1 || d === days || (d % 5 === 0 && d <= days - 3))
    .map((d) => ({ t: dayT(d), text: String(d), bold: d === today, dim: d > today }));

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          Income vs Spent — {mode === "year" ? year : monthYear(now)}
        </span>
        <Segmented
          label="Period"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setSel(null);
          }}
          options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]}
        />
      </div>

      <div key={`${mode}-${shown}`} className="pf-readout" style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
        {p.full} · <span style={{ color: GREEN, fontWeight: 600 }}>{money(p.income, currency)}</span> ·{" "}
        <span style={{ color: RED, fontWeight: 600 }}>{money(p.spent, currency)}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: "0.58rem", color: "var(--pf-ink-3)", textAlign: "right", height: H }}>
          <span>{money(max, currency, { compact: true })}</span>
          <span>{money(max / 2, currency, { compact: true })}</span>
          <span>{money(0, currency, { compact: true })}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            preserveAspectRatio="none"
            // Clip: while zoomed in, the rest of the year runs off the edges.
            style={{ display: "block", touchAction: "none", cursor: "crosshair", overflow: "hidden" }}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setSel(null)}
            role="img"
            aria-label={mode === "year" ? `Income and spending per month in ${year}` : "Income and spending so far this month, day by day"}
          >
            <defs>
              {(["income", "spent"] as const).map((key) => (
                <linearGradient key={key} id={`pf-yl-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={key === "income" ? GREEN : RED} stopOpacity="0.22" />
                  <stop offset="1" stopColor={key === "income" ? GREEN : RED} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--pf-line)" vectorEffect="non-scaling-stroke" />
            ))}

            {/* Daily view (fades in as we zoom in) */}
            <g opacity={monthOpacity}>
              {(["income", "spent"] as const).map((key) => (
                <g key={key}>
                  <path d={`${line(monthPts, key)} L${x(monthPts[monthPts.length - 1].t)},${H} L${x(monthPts[0].t)},${H} Z`} fill={`url(#pf-yl-${key})`} />
                  <path d={line(monthPts, key)} fill="none" stroke={key === "income" ? GREEN : RED} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </g>

            {/* Monthly view (fades out as we zoom in) */}
            <g opacity={yearOpacity}>
              {(["income", "spent"] as const).map((key) => {
                const c = key === "income" ? GREEN : RED;
                return (
                  <g key={key}>
                    {yearPts.length > 2 && (
                      <path d={line(yearPts.slice(0, -1), key)} fill="none" stroke={c} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    )}
                    {yearPts.length > 1 && (
                      <path d={line(yearPts.slice(-2), key)} fill="none" stroke={c} strokeWidth={2.5} strokeDasharray="5 5" opacity={0.7} vectorEffect="non-scaling-stroke" />
                    )}
                  </g>
                );
              })}
            </g>

            {settled && <line x1={x(p.t)} x2={x(p.t)} y1={0} y2={H} stroke="var(--pf-ink-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          </svg>

          {/* Dots in HTML so they stay round despite the stretched SVG. While
              zooming they ride the live point — the centre of the zoom. */}
          {(() => {
            const dot = settled ? p : pts[last];
            const isLive = !settled || shown === last;
            return (
            <div style={{ position: "relative", height: 0 }}>
              {(["income", "spent"] as const).map((key) => (
                <span
                  key={key}
                  className={isLive ? "pf-live-dot" : undefined}
                  style={{
                    position: "absolute",
                    left: `${(x(dot.t) / W) * 100}%`,
                    top: y(dot[key]) - H,
                    width: 8,
                    height: 8,
                    marginLeft: -4,
                    marginTop: -4,
                    borderRadius: "50%",
                    background: key === "income" ? GREEN : RED,
                    border: "2px solid #1c1c1e",
                    pointerEvents: "none",
                    ["--dot" as string]: key === "income" ? GREEN : RED,
                  }}
                />
              ))}
            </div>
            );
          })()}

          {/* Clips labels that zoom past the ends, with 12px of slack each side
              so the first and last labels aren't cut in half. */}
          <div style={{ overflow: "hidden", margin: "4px -12px 0", padding: "0 12px" }}>
          <div style={{ position: "relative", height: 14 }}>
            {[
              ...monthLabels.map((l) => ({ ...l, key: `m${l.t}`, opacity: yearOpacity })),
              ...dayLabels.map((l) => ({ ...l, key: `d${l.text}`, opacity: monthOpacity })),
            ].map((l) => {
              const at = x(l.t) / W;
              if (at < -0.05 || at > 1.05 || l.opacity < 0.01) return null;
              return (
                <span
                  key={l.key}
                  style={{
                    position: "absolute",
                    left: `${at * 100}%`,
                    transform: "translateX(-50%)",
                    fontSize: "0.56rem",
                    color: l.bold ? "var(--pf-ink)" : "var(--pf-ink-3)",
                    fontWeight: l.bold ? 700 : 400,
                    opacity: l.opacity * (l.dim ? 0.4 : 1),
                    whiteSpace: "nowrap",
                  }}
                >
                  {l.text}
                </span>
              );
            })}
          </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, fontSize: "0.68rem", color: "var(--pf-ink-2)", flexWrap: "wrap" }}>
        <Key color={GREEN} label={mode === "year" ? "Income" : "Income (accruing)"} />
        <Key color={RED} label={mode === "year" ? "Spent" : "Spent (running total)"} />
        {mode === "year" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, borderTop: "2px dashed var(--pf-ink-2)" }} /> This month, live
          </span>
        )}
      </div>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 14, height: 2.5, borderRadius: 2, background: color }} /> {label}
    </span>
  );
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** 0 below `a`, 1 above `b`, smooth in between. */
function smooth(v: number, a: number, b: number) {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

/** Round the axis top up to 1, 2 or 5 × a power of ten, so labels read cleanly. */
function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

/** Eases the camera between 0 (year) and 1 (month). Picks up from wherever
 *  it is, so flipping the toggle mid-zoom reverses smoothly. */
function useZoom(target: 0 | 1, ms: number) {
  const [z, setZ] = useState<number>(target);
  const from = useRef<number>(target);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const begin = from.current;
    const span = Math.abs(target - begin);
    let raf = 0;
    const step = (t: number) => {
      const k = reduced || span === 0 ? 1 : Math.min(1, (t - start) / (ms * span));
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const v = k >= 1 ? target : begin + (target - begin) * e;
      from.current = v;
      setZ(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return z;
}
