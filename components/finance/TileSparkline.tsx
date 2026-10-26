"use client";

import { intlLocale, t as tr } from "@/lib/i18n";
import { WithYAxis } from "./YAxis";
import { useNow } from "@/lib/motion";
import { memo, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { live as alive, monthToDate, num, projectedNetIncome, summarize, yearForecast } from "@/lib/finance/calc";
import { money, monthName as monthLabel, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import { isSalaryName } from "@/lib/finance/salary";

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
// eases to fit, and the dot stays on screen as the focal point. Draws in
// from the left on first paint. Balance gets a zero line.
//
// Forecast: a dotted line carries on from "now" to the end of the year —
// income at the expected net per month (and this month's in full), spending
// at the average of this year's finished months (never less than what is
// already entered this month); balance is the difference.
//
// Spent splits its area: fixed costs as a solid band along the bottom (pro
// rata through this month, like the tile), variable spending as the lighter
// area above — the same two shades as the Fixed · Variable bar below it.
//
// Scrub: pointing at (or dragging along) the chart picks the nearest point —
// a day in Month view, a month's end in Year view (forecast months too) —
// and shows a guide line,
// a dot and a little label with its date and running total.
//
// Absolute (the tile's ∑ / ▮ switch, beside its number) turns the running total into
// the amount per period — bars per month (Year) or per day (Month), on the
// same camera, the periods ahead dashed at their forecast.

const H = 54;
type Series = "income" | "spent" | "balance" | "networth";

// Memoised: the tile around it re-renders every 80 ms for its number; the
// chart only needs its own 1 s tick (and new props while zooming).
export default memo(function TileSparkline({
  data,
  series,
  color,
  z,
  currency,
  offset = 0,
  absolute = false,
}: {
  data: FinanceData;
  series: Series;
  color: string;
  /** Camera: 1 = this month, 0 = the whole year (from useZoom). */
  z: number;
  currency: string;
  /** Net worth: the start-of-year value the running balance builds on. */
  offset?: number;
  /** Amount per day / month (bars) instead of the running total. */
  absolute?: boolean;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const tick = useNow(1000);

  const live = new Date(tick);
  const year = live.getFullYear();
  const current = live.getMonth();
  const days = new Date(year, current + 1, 0).getDate();
  const fraction = Math.min(Math.max((tick - new Date(year, current, 1).getTime()) / (days * 86_400_000), 0), 1);
  // Income: a green tick under the x-axis on the day the salary came in
  // (Month view) or under each month it did (Year view); hollow while it's
  // still to receive (not on an account yet).
  const salaries = useMemo(() => (series === "income" ? salaryPayments(data, year) : []), [data, series, year]);
  const pick = (income: number, spent: number) => (series === "income" ? income : series === "spent" ? spent : income - spent);
  // Net worth is a level, not a flow: the balance curve lifted by `offset`,
  // and no forced zero in the y-range.
  const stock = series === "networth";

  // Finished months as entered (as in Income vs Spent's Year view), then
  // this month day by day, continuing from where last month ended.
  // fx: the fixed-cost part of v (running total), for Spent's split.
  type Pt = { t: number; v: number; fx: number; label: string; day?: boolean; forecast?: boolean };
  const monthName = (m: number) => monthLabel(new Date(year, m, 1));
  const pts: Pt[] = [{ t: 0, v: offset, fx: 0, label: "" }];
  let before = offset, incBefore = 0, spentBefore = 0, fxBefore = 0;
  for (let m = 0; m < current; m++) {
    const s = summarize(data.transactions, new Date(year, m, 1));
    before += pick(s.income, s.spent);
    incBefore += s.income;
    spentBefore += s.spent;
    fxBefore += s.fixed;
    pts.push({ t: m + 1, v: before, fx: fxBefore, label: monthName(m) });
  }
  const thisMonth = summarize(data.transactions, new Date(year, current, 1));
  for (const p of monthToDate(data, live).points) {
    const t = p.day === live.getDate() ? current + fraction : current + p.day / days;
    const label =
      p.day === live.getDate()
        ? tr("Today · live")
        : new Date(year, current, p.day).toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" });
    pts.push({ t, v: before + pick(p.income, p.spent), fx: fxBefore + thisMonth.fixed * (t - current), label, day: true });
  }
  const now = pts[pts.length - 1];

  // ---- Forecast to the end of the year -----------------------------------------
  const forecast: Pt[] = [];
  let incCum = incBefore, spentCum = spentBefore;
  for (const f of yearForecast(data, live)) {
    incCum += f.income;
    spentCum += f.spent;
    forecast.push({ t: f.month + 1, v: offset + pick(incCum, spentCum), fx: 0, label: tr("End of {month} · forecast", { month: monthName(f.month) }), forecast: true });
  }
  const all = [...pts, ...forecast];

  // ---- Absolute: the amount per month and per day -------------------------------
  type BarPt = { t0: number; t1: number; v: number; label: string; forecast?: boolean; day?: boolean };
  const bars: BarPt[] = [];
  if (absolute) {
    let prev = offset;
    for (let m = 1; m < pts.length && !pts[m].day; m++) {
      bars.push({ t0: m - 1, t1: m, v: pts[m].v - prev, label: pts[m].label });
      prev = pts[m].v;
    }
    const monthLive = now.v - before;
    bars.push({ t0: current, t1: current + 1, v: monthLive, label: tr("{v1} · so far", { v1: monthName(current) }) });
    const fc = yearForecast(data, live);
    for (const f of fc.slice(1)) bars.push({ t0: f.month, t1: f.month + 1, v: pick(f.income, f.spent), label: `${monthName(f.month)} · forecast`, forecast: true });
    // Days: income accrues evenly, fixed costs spread, variable on its day.
    const variableByDay = new Array(days + 1).fill(0);
    const incomeByDay = new Array(days + 1).fill(0);
    for (const t of alive(data.transactions)) {
      const d = new Date(t.date);
      if (d.getFullYear() !== year || d.getMonth() !== current) continue;
      if (t.type === "expense" && !t.is_fixed_expense) variableByDay[d.getDate()] += num(t.amount);
      if (t.type === "income") incomeByDay[d.getDate()] += num(t.amount);
    }
    const projected = projectedNetIncome(data, new Date(year, current, 1));
    const today = live.getDate();
    const dayOf = (d: number, share: number) => pick(projected * share, thisMonth.fixed * share + variableByDay[d]);
    for (let d = 1; d <= today; d++) {
      const share = d < today ? 1 / days : fraction - (today - 1) / days;
      bars.push({ t0: current + (d - 1) / days, t1: current + d / days, v: dayOf(d, share), label: d === today ? tr("Today · live") : new Date(year, current, d).toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" }), day: true });
    }
    const rest = (pick(fc[0]?.income ?? 0, fc[0]?.spent ?? 0) - monthLive) / Math.max(days - today, 1);
    for (let d = today + 1; d <= days; d++) {
      bars.push({ t0: current + (d - 1) / days, t1: current + d / days, v: rest, label: `${new Date(year, current, d).toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" })} · forecast`, forecast: true, day: true });
    }
  }

  // ---- Camera ----------------------------------------------------------------
  const range = (from: number) => {
    // Month view frames this month (its forecast end included); Year view all.
    const vs = all.filter((p) => p.t >= from && (from === 0 || p.t <= from + 1)).map((p) => p.v);
    // Balance keeps its zero in view: 0 for the year, the start of the month
    // (where the month's balance counts from) in Month view.
    const zero = stock ? Infinity : from === 0 ? 0 : series === "balance" ? before : Infinity;
    return { lo: Math.min(...vs, zero), hi: Math.max(...vs, series === "balance" && from > 0 ? before : -Infinity) };
  };
  const yearR = range(0), monthR = range(current);
  const anchorAt = lerp(now.t / 12, fraction, z);
  const width = 12 * Math.pow(1 / 12, z);
  const left = now.t - anchorAt * width;
  const absRange = (day: boolean) => {
    const vs = bars.filter((b) => !!b.day === day).map((b) => b.v);
    return { lo: Math.min(0, ...vs), hi: Math.max(0, ...vs, 1) };
  };
  const yr = absolute ? absRange(false) : yearR, mr = absolute ? absRange(true) : monthR;
  const lo = lerp(yr.lo, mr.lo, z), hi = lerp(yr.hi, mr.hi, z);
  const span = hi - lo || 1;
  const x = (t: number) => ((t - left) / width) * 100;
  const y = (v: number) => 4 + (1 - (v - lo) / span) * (H - 8);

  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.v)}`).join(" ");
  // The fixed band is stacked from the bottom of what's in view: the start
  // of the year in Year view, the start of this month in Month view (else
  // the earlier months' total would push it off the chart). Earlier points
  // in Month view only show mid-zoom; they're kept under the curve.
  const fixedAt = (p: Pt) => {
    const inMonthView = p.t >= current ? before + (p.fx - fxBefore) : Math.min(p.v, p.fx + (before - fxBefore));
    return lerp(p.fx, inMonthView, z);
  };
  const fixedLine = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(fixedAt(p))}`).join(" ");
  const lastX = x(now.t), lastY = y(now.v);
  const forecastLine = `M${lastX},${lastY} ` + forecast.map((p) => `L${x(p.t)},${y(p.v)}`).join(" ");
  // Balance's zero: 0 in Year view, last month's end in Month view (the
  // month counts from there), eased through the zoom.
  const base = series === "balance" ? Math.min(Math.max(y(before * z), 0), H) : H - 4;

  const id = `pf-tsl-${series}`;

  // ---- Scrub -----------------------------------------------------------------
  // Month view: every day this month. Year view: each month's end, plus now.
  const inMonth = z > 0.5;
  const settled = z === 0 || z === 1;
  const candidates = all
    .map((p, i) => i)
    .filter((i) => {
      const p = all[i];
      if (p.forecast) return !inMonth || p.t === current + 1;
      return inMonth ? p.day : i > 0 && (!p.day || i === pts.length - 1);
    });
  const barCandidates = bars.map((b, i) => i).filter((i) => !!bars[i].day === inMonth);
  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!settled) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = left + ((e.clientX - r.left) / r.width) * width;
    if (absolute) {
      const hit = barCandidates.find((i) => t >= bars[i].t0 && t < bars[i].t1);
      setSel(hit ?? null);
      return;
    }
    let best = candidates[candidates.length - 1];
    for (const i of candidates) if (Math.abs(all[i].t - t) < Math.abs(all[best].t - t)) best = i;
    setSel(best);
  };
  // Axis labels read like the tile: zoomed into the month they count from the
  // 1st (the earlier months taken off), eased through the zoom; net worth is
  // a level and needs no shift.
  const axisShift = stock || absolute ? 0 : before * z;
  const pickedBar = absolute && sel !== null && settled && barCandidates.includes(sel) ? bars[sel] : null;
  const picked = !absolute && sel !== null && settled && candidates.includes(sel) ? all[sel] : null;
  const pickedX = picked ? x(picked.t) : pickedBar ? x((pickedBar.t0 + pickedBar.t1) / 2) : 0;
  const pickedY = picked ? y(picked.v) : pickedBar ? y(pickedBar.v) : 0;
  const zeroY = y(0);
  const monthBarOpacity = 1 - smooth(z, 0.35, 0.85), dayBarOpacity = smooth(z, 0.15, 0.65);

  return (
    <WithYAxis height={H} currency={currency} ticks={[{ value: lo - axisShift, at: 4 / H }, { value: hi - axisShift, at: (H - 4) / H }]}>
<div>
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
          {series === "balance" && (
            <>
              <linearGradient id={`${id}-neg`} gradientUnits="userSpaceOnUse" x1="0" y1={base} x2="0" y2={H}>
                <stop offset="0" stopColor="#ff453a" stopOpacity="0.14" />
                <stop offset="1" stopColor="#ff453a" stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id={`${id}-negline`} gradientUnits="userSpaceOnUse" x1="0" y1={base} x2="0" y2={H}>
                <stop offset="0" stopColor="#ff8a80" />
                <stop offset="1" stopColor="#ff3b30" />
              </linearGradient>
              <clipPath id={`${id}-pos`}>
                <rect x={-1} y={-1} width={102} height={base + 1} />
              </clipPath>
              <clipPath id={`${id}-negclip`}>
                <rect x={-1} y={base} width={102} height={Math.max(H - base, 0) + 1} />
              </clipPath>
            </>
          )}
        </defs>
        {/* The whole period as a faint track; from now on it is still to come. */}
        <line x1={0} x2={100} y1={base} y2={base} stroke="rgba(255,255,255,0.08)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {absolute ? (
          <g key="abs" className="pf-tsl-bars">
            {bars.map((b, i) => {
              const x0 = x(b.t0), x1 = x(b.t1), w = x1 - x0;
              const pad = Math.min(w * 0.18, 1.2);
              const top = Math.min(y(b.v), zeroY), hgt = Math.max(Math.abs(y(b.v) - zeroY), 0.6);
              const neg = b.v < 0;
              return (
                <rect
                  key={i}
                  x={x0 + pad}
                  y={top}
                  width={Math.max(w - pad * 2, 0.2)}
                  height={hgt}
                  rx={0.6}
                  fill={b.forecast ? "none" : neg && series !== "spent" ? "#ff453a" : color}
                  stroke={b.forecast ? color : "none"}
                  strokeDasharray={b.forecast ? "2 2" : undefined}
                  vectorEffect="non-scaling-stroke"
                  opacity={(b.day ? dayBarOpacity : monthBarOpacity) * (sel === i || sel === null ? 1 : 0.55) * (b.forecast ? 0.7 : 1)}
                />
              );
            })}
          </g>
        ) : (
        <>
        <path className="pf-tsl-forecast" d={forecastLine} fill="none" stroke={color} strokeWidth={1.75} strokeDasharray="2 5" strokeLinecap="round" opacity={0.6} vectorEffect="non-scaling-stroke" />
        <g className="pf-tsl-draw">
          {series === "balance" ? (
            // Balance: the area is split at the zero line — the tile's colour
            // above, a red gradient below (stronger the deeper it goes).
            <>
              <path d={`${line} L${lastX},${base} L${x(0)},${base} Z`} fill={`url(#${id})`} clipPath={`url(#${id}-pos)`} />
              <path d={`${line} L${lastX},${base} L${x(0)},${base} Z`} fill={`url(#${id}-neg)`} clipPath={`url(#${id}-negclip)`} />
            </>
          ) : (
            <path d={`${line} L${lastX},${base} L${x(0)},${base} Z`} fill={`url(#${id})`} />
          )}
          {series === "spent" && <path d={`${fixedLine} L${lastX},${base} L${x(0)},${base} Z`} fill={color} opacity={0.42} />}
          {series === "balance" ? (
            // Balance's line splits at zero too: the tile colour above, a red
            // gradient below (deeper red the further under zero).
            <>
              <path d={line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath={`url(#${id}-pos)`} />
              <path d={line} fill="none" stroke={`url(#${id}-negline)`} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath={`url(#${id}-negclip)`} />
            </>
          ) : (
            <path d={line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
        </g>
        </>
        )}
        {(picked || pickedBar) && <line x1={pickedX} x2={pickedX} y1={0} y2={H} stroke="rgba(255,255,255,0.35)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* "Now" — round in HTML (the SVG is stretched). */}
      {!absolute && <span className="pf-tsl-now" style={{ left: `${lastX}%`, top: lastY, ["--dot" as string]: series === "balance" && lastY > base ? "#ff453a" : color }} />}
      {pickedBar && (
        <>
          <span className="pf-tsl-pick" style={{ left: `${pickedX}%`, top: pickedY, ["--dot" as string]: color }} />
          <span
            className="pf-tsl-tip"
            style={{
              left: `${Math.min(Math.max(pickedX, 0), 100)}%`,
              translate: `-${Math.min(Math.max(pickedX, 0), 100)}% 0`,
              top: pickedY > 30 ? pickedY - 30 : pickedY + 10,
            }}
          >
            <span style={{ color: "var(--pf-ink-2)" }}>{pickedBar.label}</span>{" "}
            <b style={{ color }}>{money(pickedBar.v, currency, { signed: series === "balance" || stock })}</b>
          </span>
        </>
      )}
      {picked && (
        <>
          <span className="pf-tsl-pick" style={{ left: `${pickedX}%`, top: pickedY, ["--dot" as string]: color }} />
          {/* Above the point, or below it near the top; kept inside the tile. */}
          <span
            className="pf-tsl-tip"
            style={{
              // Slides from left- to right-aligned across the chart, so it
              // never runs past either edge. (`translate`, not `transform`:
              // the fade-in animation owns transform.)
              left: `${Math.min(Math.max(pickedX, 0), 100)}%`,
              translate: `-${Math.min(Math.max(pickedX, 0), 100)}% 0`,
              top: pickedY > 30 ? pickedY - 30 : pickedY + 10,
            }}
          >
            <span style={{ color: "var(--pf-ink-2)" }}>{picked.label}</span>{" "}
            <b style={{ color }}>{money(inMonth && !stock ? picked.v - before : picked.v, currency)}</b>
            {series === "spent" && !picked.forecast && picked.v > 0 && (
              <span style={{ display: "block", color: "var(--pf-ink-3)" }}>
                {tr("Fixed")} {money(inMonth ? picked.fx - fxBefore : picked.fx, currency)} · {tr("Variable")}{" "}
                {money(inMonth ? picked.v - before - (picked.fx - fxBefore) : picked.v - picked.fx, currency)}
              </span>
            )}
          </span>
        </>
      )}
    </div>
      {/* Dates along the bottom, on the same camera: days in Month view,
          months in Year view, cross-fading through the zoom; "now" lit. */}
      <div className="pf-tsl-x" aria-hidden data-paid={salaries.length > 0 || undefined}>
        {salaries
          .map((p) => {
            const day = p.month === current;
            // Month view: this month's payday; Year view: one tick per month.
            return [
              ...(day ? [{ key: `pd${p.id}`, t: current + (p.day - 0.5) / days, o: smooth(z, 0.5, 1), p }] : []),
              { key: `pm${p.id}`, t: p.month + 0.5, o: 1 - smooth(z, 0, 0.5), p },
            ];
          })
          .flat()
          .map(({ key, t, o, p }) => {
            const at = x(t);
            if (o < 0.01 || at < -5 || at > 105) return null;
            return (
              <i
                key={key}
                className="pf-tsl-paid"
                data-pending={!p.received || undefined}
                style={{ left: `${at}%`, opacity: o }}
                title={`${p.name} · ${money(p.amount, currency)}${p.received ? "" : ` · ${tr("Still to receive")}`}`}
              >
                <Check size={9} strokeWidth={3.4} />
              </i>
            );
          })}
        {Array.from({ length: 12 }, (_, m) => ({ key: `m${m}`, t: m + 0.5, text: shortMonth(new Date(year, m, 1)), lit: m === current, o: 1 - smooth(z, 0, 0.5) }))
          .concat(
            [1, 8, 15, 22, 29]
              .filter((d) => d <= days && Math.abs(d - live.getDate()) > 1)
              .concat(live.getDate())
              .map((d) => ({ key: `d${d}`, t: current + (d - 0.5) / days, text: String(d), lit: d === live.getDate(), o: smooth(z, 0.5, 1) })),
          )
          .map((l) => {
            const at = x(l.t);
            if (l.o < 0.01 || at < -5 || at > 105) return null;
            return (
              <span key={l.key} data-lit={l.lit} style={{ left: `${at}%`, opacity: l.o, ["--dot" as string]: color }}>
                {l.text}
              </span>
            );
          })}
      </div>
</div>
</WithYAxis>
  );
});

/** This year's salary payments: income in a salary-like category, or at
 *  least half the expected net pay. One per month (the largest). */
function salaryPayments(data: FinanceData, year: number) {
  const names = new Map(data.categories.map((c) => [c.id, c.name]));
  const expected = num(data.profile.expected_net_monthly);
  const best = new Map<number, { id: string; month: number; day: number; amount: number; received: boolean; name: string }>();
  for (const t of alive(data.transactions)) {
    if (t.type !== "income") continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== year) continue;
    const name = names.get(t.category_id ?? "") ?? "";
    const amount = num(t.amount);
    if (!isSalaryName(name) && !(expected > 0 && amount >= expected * 0.5)) continue;
    const had = best.get(d.getMonth());
    if (!had || had.amount < amount) best.set(d.getMonth(), { id: t.id, month: d.getMonth(), day: d.getDate(), amount, received: t.account_id != null, name: name || tr("Salary") });
  }
  return [...best.values()];
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** 0 below `a`, 1 above `b`, smooth in between. */
function smooth(v: number, a: number, b: number) {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
}
