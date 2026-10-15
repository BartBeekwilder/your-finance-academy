"use client";

import { useEffect, useRef, useState } from "react";
import { monthToDate, summarize } from "@/lib/finance/calc";
import { money, monthYear, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import Segmented from "./Segmented";

// Income vs Spent as two lines, with a Month / Year toggle:
//   Year  — one point per month, Jan–Dec. The current month is live (same
//           figures as the dashboard tiles) and drawn dashed.
//   Month — running totals day by day through this month, ending at "now",
//           so the last point equals the tiles exactly.
// Switching redraws the lines left-to-right and the axis counts to its new
// scale. Hover (or drag on touch) to read any point.

const GREEN = "#30d158";
const RED = "#ff453a";
type Point = { label: string; full: string; income: number; spent: number };

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

  // Points and how many slots the x-axis has (12 months, or days in month).
  let points: Point[];
  let slots: number;
  if (mode === "year") {
    const days = new Date(year, current + 1, 0).getDate();
    const fraction = Math.min(Math.max((tick - new Date(year, current, 1).getTime()) / (days * 86_400_000), 0), 1);
    points = Array.from({ length: current + 1 }, (_, m) => {
      const d = new Date(year, m, 1);
      const s = summarize(data.transactions, d);
      const isNow = m === current;
      return {
        label: shortMonth(d).slice(0, 1),
        full: `${monthYear(d)}${isNow ? " · live" : ""}`,
        income: isNow ? monthlyIncome * fraction : s.income,
        spent: isNow ? s.fixed * fraction + s.variable : s.spent,
      };
    });
    slots = 12;
  } else {
    const mtd = monthToDate(data, live);
    points = mtd.points.map((p) => ({
      label: String(p.day),
      full: p.day === live.getDate() ? `Today · live` : new Date(year, current, p.day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      income: p.income,
      spent: p.spent,
    }));
    slots = mtd.days;
  }

  const W = 480, H = 150, PAD = 6;
  const max = useTweenNumber(niceMax(Math.max(1, ...points.flatMap((p) => [p.income, p.spent]))), 600);
  const x = (i: number) => (slots === 1 ? 0 : (i / (slots - 1)) * W);
  const y = (v: number) => H - PAD - (Math.min(v, max) / max) * (H - PAD * 2);
  const path = (key: "income" | "spent", from: number, to: number) =>
    points.slice(from, to + 1).map((p, i) => `${i ? "L" : "M"}${x(from + i)},${y(p[key])}`).join(" ");
  // Year mode: last month is still running → dashed. Month mode: all solid.
  const solidTo = mode === "year" ? points.length - 2 : points.length - 1;

  const last = points.length - 1;
  const shown = sel !== null && sel <= last ? sel : last;
  const p = points[shown];
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSel(Math.max(0, Math.min(last, Math.round(((e.clientX - r.left) / r.width) * (slots - 1)))));
  };

  // Redraw-from-the-left reveal, replayed whenever the mode changes.
  const reveal = useRef<SVGAnimateElement>(null);
  useEffect(() => {
    reveal.current?.beginElement();
  }, [mode]);

  // x-axis labels: every month in Year mode; every ~5th day in Month mode.
  const axis = Array.from({ length: slots }, (_, i) =>
    mode === "year"
      ? shortMonth(new Date(year, i, 1)).slice(0, 1)
      : // Day 1, every 5th day, and the last day — skipping a 5th that would
        // sit right next to the last one (e.g. 30 beside 31).
        i === 0 || i === slots - 1 || ((i + 1) % 5 === 0 && i + 1 <= slots - 3)
        ? String(i + 1)
        : "",
  );

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          Income vs Spent — {mode === "year" ? year : monthYear(now)}
        </span>
        <Segmented
          label="Period"
          value={mode}
          onChange={(m) => { setMode(m); setSel(null); }}
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
        <div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            preserveAspectRatio="none"
            style={{ display: "block", touchAction: "none", cursor: "crosshair", overflow: "visible" }}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setSel(null)}
            role="img"
            aria-label={mode === "year" ? `Income and spending per month in ${year}` : `Income and spending so far this month, day by day`}
          >
            <defs>
              <clipPath id="pf-yl-reveal">
                <rect x={-10} y={-10} height={H + 20} width={W + 20}>
                  <animate
                    ref={reveal}
                    attributeName="width"
                    from="0"
                    to={W + 20}
                    dur="0.9s"
                    begin="indefinite"
                    fill="freeze"
                    calcMode="spline"
                    keyTimes="0;1"
                    keySplines="0.25 0.8 0.25 1"
                  />
                </rect>
              </clipPath>
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
            <g clipPath="url(#pf-yl-reveal)">
              {(["income", "spent"] as const).map((key) => {
                const c = key === "income" ? GREEN : RED;
                return (
                  <g key={key}>
                    {mode === "month" && (
                      <path d={`${path(key, 0, last)} L${x(last)},${H} L0,${H} Z`} fill={`url(#pf-yl-${key})`} />
                    )}
                    {solidTo >= 1 && (
                      <path d={path(key, 0, solidTo)} fill="none" stroke={c} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    )}
                    {mode === "year" && last > 0 && (
                      <path d={path(key, last - 1, last)} fill="none" stroke={c} strokeWidth={2.5} strokeDasharray="5 5" opacity={0.7} vectorEffect="non-scaling-stroke" />
                    )}
                  </g>
                );
              })}
            </g>
            <line x1={x(shown)} x2={x(shown)} y1={0} y2={H} stroke="var(--pf-ink-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Dots in HTML so they stay round despite the stretched SVG. */}
          <div style={{ position: "relative", height: 0 }}>
            {(["income", "spent"] as const).map((key) => (
              <span
                key={key}
                className={shown === last ? "pf-live-dot" : undefined}
                style={{
                  position: "absolute",
                  left: `${(slots === 1 ? 0 : shown / (slots - 1)) * 100}%`,
                  top: y(p[key]) - H,
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
          <div key={mode} className="pf-labels-swap" style={{ position: "relative", height: 14, marginTop: 4 }}>
            {axis.map((t, i) =>
              t ? (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${(slots === 1 ? 0 : i / (slots - 1)) * 100}%`,
                    transform: "translateX(-50%)",
                    fontSize: "0.56rem",
                    color: i === shown ? "var(--pf-ink)" : "var(--pf-ink-3)",
                    fontWeight: i === last ? 700 : 400,
                    opacity: i > last ? 0.4 : 1,
                    animationDelay: `${i * (mode === "year" ? 25 : 10)}ms`,
                  }}
                >
                  {t}
                </span>
              ) : null,
            )}
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

/** Round the axis top up to 1, 2 or 5 × a power of ten, so labels read cleanly. */
function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

/** Eases a number toward `target` (used for the y-axis scale on mode switch). */
function useTweenNumber(target: number, ms: number) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = begin + (target - begin) * e;
      from.current = v;
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
