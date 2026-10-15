"use client";

import { useEffect, useState } from "react";
import { monthToDate } from "@/lib/finance/calc";
import type { FinanceData } from "@/lib/finance/types";

// Small live chart under each dashboard tile: this month day by day, using
// the same running totals as the Month view of Income vs Spent (so its end
// point equals the tile's number). The whole month is the x-axis, with the
// days still to come as a faint track; the "now" end glows and pulses and
// moves along every second. Draws in from the left on first paint.
// Balance gets a zero line and is green above it, red below.

const H = 54;

export default function TileSparkline({
  data,
  series,
  color,
}: {
  data: FinanceData;
  series: "income" | "spent" | "balance";
  color: string;
}) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { points, days } = monthToDate(data, new Date(tick));
  const values = points.map((p) => (series === "income" ? p.income : series === "spent" ? p.spent : p.income - p.spent));
  const hi = Math.max(0, ...values), lo = Math.min(0, ...values);
  const span = hi - lo || 1;
  const x = (i: number) => (days <= 1 ? 0 : (i / (days - 1)) * 100);
  const y = (v: number) => 4 + (1 - (v - lo) / span) * (H - 8);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1] ?? 0);
  const zeroY = y(0);
  const id = `pf-tsl-${series}`;

  return (
    <div className="pf-tsl" style={{ position: "relative", height: H }}>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block", overflow: "visible" }} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* The whole month as a faint track; today onward is still to come. */}
        <line x1={0} x2={100} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={lastX} x2={100} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        <g className="pf-tsl-draw">
          <path d={`${line} L${lastX},${zeroY} L0,${zeroY} Z`} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      {/* "Now" — round in HTML (the SVG is stretched). */}
      <span className="pf-tsl-now" style={{ left: `${lastX}%`, top: lastY, ["--dot" as string]: color }} />
    </div>
  );
}
