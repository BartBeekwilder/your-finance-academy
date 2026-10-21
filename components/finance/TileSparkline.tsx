"use client";

import { useEffect, useState } from "react";
import { monthToDate, summarize } from "@/lib/finance/calc";
import type { FinanceData } from "@/lib/finance/types";

// Small live chart under each dashboard tile. It is one curve — the running
// total for the year so far — seen through a camera:
//   Month (z = 1) — framed on this month, day by day (the same running
//                   totals as Income vs Spent's Month view), ending at the
//                   tile's number.
//   Year  (z = 0) — the whole year, month by month, ending at the
//                   year-to-date number.
// Time is measured in months (Jan = 0). Switching zooms the camera about
// "now" — the glowing dot — like Income vs Spent: the x-range scales
// (log-scale, like a map zoom) between twelve months and one, the y-range
// eases to fit, and the dot stays on screen as the focal point. The rest of
// the period still to come is a faint dashed track. Draws in from the left
// on first paint. Balance gets a zero line.

const H = 54;
type Series = "income" | "spent" | "balance";

export default function TileSparkline({
  data,
  series,
  color,
  z,
}: {
  data: FinanceData;
  series: Series;
  color: string;
  /** Camera: 1 = this month, 0 = the whole year (from useZoom). */
  z: number;
}) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const live = new Date(tick);
  const year = live.getFullYear();
  const current = live.getMonth();
  const days = new Date(year, current + 1, 0).getDate();
  const fraction = Math.min(Math.max((tick - new Date(year, current, 1).getTime()) / (days * 86_400_000), 0), 1);
  const pick = (income: number, spent: number) => (series === "income" ? income : series === "spent" ? spent : income - spent);

  // Finished months as entered (as in Income vs Spent's Year view), then
  // this month day by day, continuing from where last month ended.
  const pts: { t: number; v: number }[] = [{ t: 0, v: 0 }];
  let before = 0;
  for (let m = 0; m < current; m++) {
    const s = summarize(data.transactions, new Date(year, m, 1));
    before += pick(s.income, s.spent);
    pts.push({ t: m + 1, v: before });
  }
  for (const p of monthToDate(data, live).points) {
    const t = p.day === live.getDate() ? current + fraction : current + p.day / days;
    pts.push({ t, v: before + pick(p.income, p.spent) });
  }
  const now = pts[pts.length - 1];

  // ---- Camera ----------------------------------------------------------------
  const range = (from: number) => {
    const vs = pts.filter((p) => p.t >= from).map((p) => p.v);
    return { lo: Math.min(...vs, from === 0 ? 0 : Infinity), hi: Math.max(...vs) };
  };
  const yearR = range(0), monthR = range(current);
  const anchorAt = lerp(now.t / 12, fraction, z);
  const width = 12 * Math.pow(1 / 12, z);
  const left = now.t - anchorAt * width;
  const lo = lerp(yearR.lo, monthR.lo, z), hi = lerp(yearR.hi, monthR.hi, z);
  const span = hi - lo || 1;
  const x = (t: number) => ((t - left) / width) * 100;
  const y = (v: number) => 4 + (1 - (v - lo) / span) * (H - 8);

  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.v)}`).join(" ");
  const lastX = x(now.t), lastY = y(now.v);
  const base = series === "balance" ? Math.min(Math.max(y(0), 0), H) : H - 4;
  const id = `pf-tsl-${series}`;

  return (
    <div className="pf-tsl" style={{ position: "relative", height: H }}>
      {/* Clipped: zoomed in, the earlier months run off the left edge. */}
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block", overflow: "hidden" }} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* The whole period as a faint track; from now on it is still to come. */}
        <line x1={0} x2={100} y1={base} y2={base} stroke="rgba(255,255,255,0.08)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={lastX} x2={100} y1={base} y2={base} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        <g className="pf-tsl-draw">
          <path d={`${line} L${lastX},${base} L${x(0)},${base} Z`} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      {/* "Now" — round in HTML (the SVG is stretched). */}
      <span className="pf-tsl-now" style={{ left: `${lastX}%`, top: lastY, ["--dot" as string]: color }} />
    </div>
  );
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
