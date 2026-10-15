"use client";

import { useEffect, useRef, useState } from "react";
import { useCategoryDetail } from "./CategoryDetail";
import Segmented from "./Segmented";
import { money, shortMonth } from "@/lib/finance/format";
import type { CategorySpend, MonthPoint } from "@/lib/finance/calc";

type Slice = { category: CategorySpend["category"]; spent: number };

/** Donut of spend per category — the iOS CategoryDonutChart — with a
 *  This Month / This Year switch. Slices keep one fixed order (by this
 *  year's spend), so switching morphs each slice to its new size instead of
 *  reshuffling; the centre total and percentages count along. Hovering a
 *  slice or legend row pops it outward with a glow; click opens the sheet. */
export function CategoryDonut({ month, year, currency }: { month: Slice[]; year: Slice[]; currency: string }) {
  const [mode, setMode] = useState<"month" | "year">("month");
  const [active, setActive] = useState<number | null>(null);
  const openCategory = useCategoryDetail();

  // Fixed slice order: every category spent on this year, biggest first.
  const order = year.length ? year.map((e) => e.category) : month.map((e) => e.category);
  const valuesFor = (m: "month" | "year") => {
    const src = new Map((m === "month" ? month : year).map((e) => [e.category.id, e.spent]));
    return order.map((c) => src.get(c.id) ?? 0);
  };
  const values = useTween(valuesFor(mode), 700);

  const total = values.reduce((s, v) => s + v, 0);
  const R = 84, r = 56, C = 100, POP = 8;
  const sweeps = values.map((v) => (total ? (v / total) * Math.PI * 2 : 0));
  const starts = sweeps.map((_, i) => -Math.PI / 2 + sweeps.slice(0, i).reduce((s, x) => s + x, 0));

  const arcs = order.map((category, i) => {
    const gap = sweeps[i] > 0.03 ? 0.012 : 0;
    const a0 = starts[i] + gap, a1 = starts[i] + sweeps[i] - gap;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${C + Math.cos(a) * rad} ${C + Math.sin(a) * rad}`;
    const d = sweeps[i] <= 0.001 ? "" : `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
    const mid = starts[i] + sweeps[i] / 2;
    return { d, color: `#${category.color_hex}`, i, dx: Math.cos(mid) * POP, dy: Math.sin(mid) * POP };
  });

  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const shown = active !== null ? { category: order[active], spent: values[active] } : null;
  const visible = order.map((c, i) => ({ c, i, v: values[i] })).filter((x) => x.v > 0.005 || valuesFor(mode)[x.i] > 0);

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>Spending by category</span>
        <Segmented
          label="Period"
          value={mode}
          onChange={(m) => { setMode(m); setActive(null); }}
          options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]}
        />
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "space-around", flexWrap: "wrap" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2, fontSize: "0.74rem", flex: "1 1 150px", maxWidth: 240 }}>
          {visible.slice(0, 8).map(({ c, i, v }) => (
            <li key={c.id}>
              <button
                className="pf-tap pf-legend-row"
                data-active={active === i}
                data-dim={active !== null && active !== i}
                onClick={() => openCategory(c.id)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                style={{ ["--c" as string]: `#${c.color_hex}` }}
              >
                <span className="pf-legend-swatch" />
                <span style={{ flex: 1 }}>{c.name}</span>
                <span className="pf-rounded" style={{ color: "var(--pf-ink-3)" }}>{share(v)}%</span>
              </button>
            </li>
          ))}
        </ul>

        <div style={{ position: "relative", width: 200, height: 200, flex: "none" }}>
          <svg viewBox="0 0 200 200" width={200} height={200} role="img" aria-label={`Spending by category, ${mode === "month" ? "this month" : "this year"}`} style={{ overflow: "visible" }} onMouseLeave={() => setActive(null)}>
            {arcs.map((a) =>
              a.d ? (
                <g key={order[a.i].id} className="pf-slice-in" style={{ animationDelay: `${a.i * 60}ms` }}>
                  <path
                    role="button"
                    aria-label={`${order[a.i].name}: ${money(values[a.i], currency)}, ${share(values[a.i])}%`}
                    d={a.d}
                    fill={a.color}
                    className="pf-slice"
                    style={{
                      transform: active === a.i ? `translate(${a.dx}px, ${a.dy}px) scale(1.04)` : active !== null ? "scale(0.98)" : undefined,
                      opacity: active === null || active === a.i ? 1 : 0.3,
                      filter: active === a.i ? `drop-shadow(0 0 10px ${a.color})` : undefined,
                    }}
                    onMouseEnter={() => setActive(a.i)}
                    onClick={() => openCategory(order[a.i].id)}
                  />
                </g>
              ) : null,
            )}
          </svg>

          <div key={`${mode}-${active ?? -1}`} className="pf-donut-centre" aria-hidden>
            <span style={{ fontSize: "0.68rem", color: shown ? `#${shown.category.color_hex}` : "var(--pf-ink-2)", fontWeight: 600 }}>
              {shown ? shown.category.name : mode === "month" ? "Spent this month" : "Spent this year"}
            </span>
            <span className="pf-rounded" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              {money(shown ? shown.spent : total, currency)}
            </span>
            <span style={{ fontSize: "0.62rem", color: "var(--pf-ink-3)" }}>
              {shown ? `${share(shown.spent)}% of spending` : `${visible.length} categories`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Animates an array of numbers toward `target` with an ease-in-out curve.
 *  Starts from wherever the previous animation got to, so switching back
 *  mid-animation reverses smoothly. */
function useTween(target: number[], ms: number) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const key = target.join("|");

  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    const end = key.split("|").map(Number);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const step = (t: number) => {
      const k = reduced ? 1 : Math.min(1, (t - start) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const next = end.map((v, i) => (begin[i] ?? 0) + (v - (begin[i] ?? 0)) * e);
      from.current = next;
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, ms]);

  return shown.length === target.length ? shown : target;
}

/** Paired monthly bars — the iOS SelectableIncomeExpenseChart. */
export function IncomeExpenseBars({ points, currency }: { points: MonthPoint[]; currency: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  const H = 160;
  const p = sel !== null ? points[sel] : null;

  return (
    <div>
      <div style={{ height: 20, fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
        {p ? (
          <>
            {shortMonth(p.month)} · <span style={{ color: "var(--pf-green)" }}>Income {money(p.income, currency)}</span> ·{" "}
            <span style={{ color: "var(--pf-orange)" }}>Exp {money(p.expense, currency)}</span>
          </>
        ) : (
          "Hover or tap a month for details"
        )}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: H }}>
        {points.map((pt, i) => (
          <button
            key={i}
            onClick={() => setSel(sel === i ? null : i)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: 0, padding: 0, cursor: "pointer", height: "100%", justifyContent: "flex-end", opacity: sel === null || sel === i ? 1 : 0.4 }}
            aria-label={`${shortMonth(pt.month)}: income ${money(pt.income, currency)}, expenses ${money(pt.expense, currency)}`}
          >
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: H - 18, width: "100%", justifyContent: "center" }}>
              <span style={{ width: "40%", maxWidth: 10, height: `${(pt.income / max) * 100}%`, background: "var(--pf-green)", borderRadius: 3 }} />
              <span style={{ width: "40%", maxWidth: 10, height: `${(pt.expense / max) * 100}%`, background: "var(--pf-orange)", borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: "0.6rem", color: "var(--pf-ink-3)" }}>{shortMonth(pt.month).slice(0, 3)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Running 12-month balance line — the iOS TrendComparisonChart. */
export function TrendLine({ points }: { points: MonthPoint[] }) {
  const W = 300, H = 160;
  const cum = points.map((_, i) => points.slice(0, i + 1).reduce((s, p) => s + p.income - p.expense, 0));
  const min = Math.min(0, ...cum), max = Math.max(1, ...cum);
  const xy = cum.map((v, i) => [(i / (cum.length - 1)) * W, H - ((v - min) / (max - min)) * (H - 10) - 5]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const up = cum[cum.length - 1] >= 0;
  const color = up ? "var(--pf-green)" : "var(--pf-orange)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H + 20} preserveAspectRatio="none" role="img" aria-label="12-month cumulative balance">
      <defs>
        <linearGradient id="pf-trend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={up ? "#30d158" : "#ff9f0a"} stopOpacity="0.35" />
          <stop offset="1" stopColor={up ? "#30d158" : "#ff9f0a"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#pf-trend)" />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
