"use client";

import { useEffect, useState } from "react";
import { monthToDate, summarize } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
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
//
// Scrub: pointing at (or dragging along) the chart picks the nearest point —
// a day in Month view, a month's end in Year view — and shows a guide line,
// a dot and a little label with its date and running total.

const H = 54;
type Series = "income" | "spent" | "balance";

export default function TileSparkline({
  data,
  series,
  color,
  z,
  currency,
}: {
  data: FinanceData;
  series: Series;
  color: string;
  /** Camera: 1 = this month, 0 = the whole year (from useZoom). */
  z: number;
  currency: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
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
  const pts: { t: number; v: number; label: string; day?: boolean }[] = [{ t: 0, v: 0, label: "" }];
  let before = 0;
  for (let m = 0; m < current; m++) {
    const s = summarize(data.transactions, new Date(year, m, 1));
    before += pick(s.income, s.spent);
    pts.push({ t: m + 1, v: before, label: new Date(year, m, 1).toLocaleDateString("en-GB", { month: "long" }) });
  }
  for (const p of monthToDate(data, live).points) {
    const t = p.day === live.getDate() ? current + fraction : current + p.day / days;
    const label =
      p.day === live.getDate()
        ? "Today · live"
        : new Date(year, current, p.day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    pts.push({ t, v: before + pick(p.income, p.spent), label, day: true });
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

  // ---- Scrub -----------------------------------------------------------------
  // Month view: every day this month. Year view: each month's end, plus now.
  const inMonth = z > 0.5;
  const settled = z === 0 || z === 1;
  const candidates = pts
    .map((p, i) => i)
    .filter((i) => (inMonth ? pts[i].day : i > 0 && (!pts[i].day || i === pts.length - 1)));
  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!settled) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = left + ((e.clientX - r.left) / r.width) * width;
    let best = candidates[candidates.length - 1];
    for (const i of candidates) if (Math.abs(pts[i].t - t) < Math.abs(pts[best].t - t)) best = i;
    setSel(best);
  };
  const picked = sel !== null && settled && candidates.includes(sel) ? pts[sel] : null;
  const pickedX = picked ? x(picked.t) : 0;
  const pickedY = picked ? y(picked.v) : 0;

  return (
    <div
      className="pf-tsl"
      style={{ position: "relative", height: H, cursor: "crosshair", touchAction: "pan-y" }}
      onPointerMove={scrub}
      onPointerDown={scrub}
      onPointerLeave={() => setSel(null)}
      onPointerCancel={() => setSel(null)}
    >
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
        {picked && <line x1={pickedX} x2={pickedX} y1={0} y2={H} stroke="rgba(255,255,255,0.35)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* "Now" — round in HTML (the SVG is stretched). */}
      <span className="pf-tsl-now" style={{ left: `${lastX}%`, top: lastY, ["--dot" as string]: color }} />
      {picked && (
        <>
          <span className="pf-tsl-pick" style={{ left: `${pickedX}%`, top: pickedY, ["--dot" as string]: color }} />
          {/* Above the point, or below it near the top; kept inside the tile. */}
          <span
            className="pf-tsl-tip"
            style={{
              left: `clamp(60px, ${pickedX}%, calc(100% - 60px))`,
              top: pickedY > 26 ? pickedY - 30 : pickedY + 10,
            }}
          >
            <span style={{ color: "var(--pf-ink-2)" }}>{picked.label}</span>{" "}
            <b style={{ color }}>{money(inMonth ? picked.v - before : picked.v, currency)}</b>
          </span>
        </>
      )}
    </div>
  );
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
