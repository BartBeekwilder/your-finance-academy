"use client";

import { useState } from "react";
import { useCategoryDetail } from "./CategoryDetail";
import { money, shortMonth } from "@/lib/finance/format";
import type { CategorySpend, MonthPoint } from "@/lib/finance/calc";

/** Donut of this month's spend per category — the iOS CategoryDonutChart.
 *  Slices spring in on load; hovering a slice (or its legend row) pops it
 *  outward with a glow, dims the rest and swaps the centre to that
 *  category's amount and share. Click opens the category sheet. */
export function CategoryDonut({ entries, currency }: { entries: CategorySpend[]; currency: string }) {
  const [active, setActive] = useState<number | null>(null);
  const openCategory = useCategoryDetail();
  const total = entries.reduce((s, e) => s + e.spent, 0);
  const R = 84, r = 56, C = 100, POP = 8;
  // Start angle of each slice = sum of the sweeps before it.
  const sweeps = entries.map((e) => (total ? (e.spent / total) * Math.PI * 2 : 0));
  const starts = sweeps.map((_, i) => -Math.PI / 2 + sweeps.slice(0, i).reduce((s, x) => s + x, 0));

  const arcs = entries.map((e, i) => {
    const a0 = starts[i] + 0.012, a1 = starts[i] + sweeps[i] - 0.012;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${C + Math.cos(a) * rad} ${C + Math.sin(a) * rad}`;
    const d = `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
    const mid = starts[i] + sweeps[i] / 2;
    return { d, color: `#${e.category.color_hex}`, i, dx: Math.cos(mid) * POP, dy: Math.sin(mid) * POP };
  });

  const shown = active !== null ? entries[active] : null;
  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <div className="pf-card" style={{ padding: 16, display: "flex", gap: 20, alignItems: "center", justifyContent: "space-around", flexWrap: "wrap" }}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2, fontSize: "0.74rem", flex: "1 1 150px", maxWidth: 240 }}>
        {entries.slice(0, 8).map((e, i) => (
          <li key={e.category.id}>
            <button
              className="pf-tap pf-legend-row"
              data-active={active === i}
              data-dim={active !== null && active !== i}
              onClick={() => openCategory(e.category.id)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              style={{ ["--c" as string]: `#${e.category.color_hex}` }}
            >
              <span className="pf-legend-swatch" />
              <span style={{ flex: 1 }}>{e.category.name}</span>
              <span className="pf-rounded" style={{ color: "var(--pf-ink-3)" }}>{share(e.spent)}%</span>
            </button>
          </li>
        ))}
      </ul>

      <div style={{ position: "relative", width: 200, height: 200, flex: "none" }}>
        <svg viewBox="0 0 200 200" width={200} height={200} role="img" aria-label="Spending by category" style={{ overflow: "visible" }} onMouseLeave={() => setActive(null)}>
          {arcs.map((a) => {
            const isActive = active === a.i;
            return (
              <g key={a.i} className="pf-slice-in" style={{ animationDelay: `${a.i * 60}ms` }}>
                <path
                  role="button"
                  aria-label={`${entries[a.i].category.name}: ${money(entries[a.i].spent, currency)}, ${share(entries[a.i].spent)}%`}
                  d={a.d}
                  fill={a.color}
                  className="pf-slice"
                  style={{
                    transform: isActive ? `translate(${a.dx}px, ${a.dy}px) scale(1.04)` : active !== null ? "scale(0.98)" : undefined,
                    opacity: active === null || isActive ? 1 : 0.3,
                    filter: isActive ? `drop-shadow(0 0 10px ${a.color})` : undefined,
                  }}
                  onMouseEnter={() => setActive(a.i)}
                  onClick={() => openCategory(entries[a.i].category.id)}
                />
              </g>
            );
          })}
        </svg>

        {/* Centre label in HTML so it can cross-fade; keyed to replay on change. */}
        <div key={active ?? -1} className="pf-donut-centre" aria-hidden>
          <span style={{ fontSize: "0.68rem", color: shown ? `#${shown.category.color_hex}` : "var(--pf-ink-2)", fontWeight: 600 }}>
            {shown ? shown.category.name : "Spent"}
          </span>
          <span className="pf-rounded" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
            {money(shown ? shown.spent : total, currency)}
          </span>
          <span style={{ fontSize: "0.62rem", color: "var(--pf-ink-3)" }}>
            {shown ? `${share(shown.spent)}% of spending` : `${entries.length} categories`}
          </span>
        </div>
      </div>
    </div>
  );
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
