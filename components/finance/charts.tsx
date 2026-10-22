"use client";

import { useNow } from "@/lib/motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCategoryDetail } from "./CategoryDetail";
import StepSlider from "./StepSlider";
import Segmented from "./Segmented";
import LiveAmount from "./LiveAmount";
import { money } from "@/lib/finance/format";
import type { CategorySpend } from "@/lib/finance/calc";

type Slice = { category: CategorySpend["category"]; spent: number; fixed?: number };

/** Donut of spend per category — the iOS CategoryDonutChart — with a
 *  This Month / This Year switch. Slices keep one fixed order (by this
 *  year's spend), so switching morphs each slice to its new size instead of
 *  reshuffling; the centre total and percentages count along. Hovering a
 *  slice or legend row pops it outward with a glow; click opens the sheet.
 *
 *  This month (and this year, which contains it) is live, by the same rule
 *  as the Spent tile: fixed costs count for the part of the month that has
 *  passed, variable spending in full. So the rent slice grows through the
 *  month, and the centre total ticks along with — and always matches — the
 *  Spent tile.
 *
 *  `control` hands Month / Year and the month to the page (Budgets): the
 *  donut then follows it and hides its own toggle and slider. */
export function CategoryDonut({ months, years, currency, now, control, headerRight }: {
  /** Spend per category for each month of this year so far (index = month);
   *  this month's entries carry `fixed` so they can be shown live. */
  months: Slice[][];
  /** Spend per category for each year that has data, oldest first. */
  years: { year: number; slices: Slice[] }[];
  currency: string;
  now: Date;
  control?: { mode: "month" | "year"; monthIndex: number; forecast?: boolean };
  /** Extra control top-right of the card (e.g. Budgets' Budget / Spent). */
  headerRight?: ReactNode;
}) {
  const [ownMode, setMode] = useState<"month" | "year">("month");
  const [ownMonth, setMonthIndex] = useState(now.getMonth());
  const [ownYear, setYearIndex] = useState(years.length - 1);
  const mode = control?.mode ?? ownMode;
  const monthIndex = control?.monthIndex ?? ownMonth;
  const yearIndex = control ? years.length - 1 : ownYear;
  const month = months[monthIndex] ?? [];
  const yearSel = years[yearIndex] ?? years[years.length - 1];
  const [active, setActive] = useState<number | null>(null);
  const openCategory = useCategoryDetail();

  // Fixed slice order across every month and year: categories by total
  // spend over all years, biggest first — so slices morph, never reshuffle.
  const allTime = new Map<string, { category: Slice["category"]; spent: number }>();
  for (const y of years) {
    for (const e of y.slices) allTime.set(e.category.id, { category: e.category, spent: (allTime.get(e.category.id)?.spent ?? 0) + e.spent });
  }
  for (const e of month) if (!allTime.has(e.category.id)) allTime.set(e.category.id, { category: e.category, spent: 0 });
  const order = [...allTime.values()].sort((a, b) => b.spent - a.spent).map((e) => e.category);
  const monthName = new Date(now.getFullYear(), monthIndex, 1).toLocaleDateString("en-GB", { month: "long" });
  const valuesFor = (m: "month" | "year") => {
    const src = new Map((m === "month" ? month : (yearSel?.slices ?? [])).map((e) => [e.category.id, e.spent]));
    return order.map((c) => src.get(c.id) ?? 0);
  };
  // Live: the selected period contains the current month. Its fixed costs
  // are counted pro rata (× fraction of the month elapsed).
  const isLive = mode === "month" ? monthIndex === now.getMonth() : yearSel?.year === now.getFullYear();
  const thisMonth = new Map((months[now.getMonth()] ?? []).map((e) => [e.category.id, e.fixed ?? 0]));
  const fixedPart = order.map((c) => (isLive ? (thisMonth.get(c.id) ?? 0) : 0));
  const target = valuesFor(mode);
  // Tween the non-fixed and fixed parts separately (they only change when
  // the period changes); the fraction is applied every tick on top.
  const tween = useTween([...target.map((v, i) => v - fixedPart[i]), ...fixedPart], 700);
  // Slices move imperceptibly per second, so they tick at 1 s; only the
  // centre number streams at 80 ms (LiveDonutAmount, its own component).
  const fraction = useMonthFraction(now, isLive && fixedPart.some((f) => f > 0), 1000);
  const values = order.map((_, i) => tween[i] + tween[order.length + i] * fraction);

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
    <div className={`pf-card${control?.forecast && mode === "month" ? " pf-donut-forecast" : ""}`} style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{control?.forecast && mode === "month" ? "Expected spending by category" : "Spending by category"}</span>
        {headerRight}
        {!control && (
          <Segmented
            label="Period"
            value={mode}
            onChange={(m) => { setMode(m); setActive(null); }}
            options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "space-around", flexWrap: "wrap" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2, fontSize: "0.74rem", flex: "1 1 150px", maxWidth: 240 }}>
          {visible.slice(0, 8).map(({ c, i, v }) => (
            <li key={c.id}>
              <button
                className="pf-tap pf-legend-row"
                data-active={active === i}
                data-dim={active !== null && active !== i}
                onClick={(e) => openCategory(c.id, e.currentTarget)}
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
                    onClick={(e) => openCategory(order[a.i].id, e.currentTarget)}
                  />
                </g>
              ) : null,
            )}
          </svg>

          <div key={`${mode}-${active ?? -1}`} className="pf-donut-centre" aria-hidden>
            <span style={{ fontSize: "0.68rem", color: shown ? `#${shown.category.color_hex}` : "var(--pf-ink-2)", fontWeight: 600 }}>
              {shown ? shown.category.name : mode === "year" ? `Spent in ${yearSel?.year}` : control?.forecast ? `Expected in ${monthName}` : monthIndex === now.getMonth() ? "Spent this month" : `Spent in ${monthName}`}
            </span>
            <span className="pf-rounded" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              {isLive ? (
                <LiveDonutAmount
                  base={active !== null ? tween[active] : order.reduce((t, _, i) => t + tween[i], 0)}
                  fixed={active !== null ? tween[order.length + active] : order.reduce((t, _, i) => t + tween[order.length + i], 0)}
                  now={now}
                  currency={currency}
                />
              ) : (
                money(shown ? shown.spent : total, currency)
              )}
            </span>
            <span style={{ fontSize: "0.62rem", color: "var(--pf-ink-3)" }}>
              {shown
                ? `${share(shown.spent)}% of spending`
                : mode === "year" && yearSel?.year === now.getFullYear()
                  ? "year to date"
                  : `${visible.length} categories`}
            </span>
          </div>
        </div>
      </div>

      {!control && <StepSlider
        label={mode === "month" ? "Month" : "Year"}
        animKey={mode}
        value={mode === "month" ? monthIndex : yearIndex}
        steps={
          mode === "month"
            ? Array.from({ length: 12 }, (_, i) => {
                const d = new Date(now.getFullYear(), i, 1);
                const name = d.toLocaleDateString("en-GB", { month: "long" });
                return { label: name.slice(0, 3), short: name[0], full: `${name} ${now.getFullYear()}`, disabled: i > now.getMonth() };
              })
            : years.map((y) => ({ label: String(y.year), full: String(y.year) }))
        }
        onChange={(i) => {
          if (mode === "month") setMonthIndex(i);
          else setYearIndex(i);
          setActive(null);
        }}
      />}
    </div>
  );
}

/** Fraction of `now`'s month that has passed, re-read every 80 ms while
 *  `ticking` (same cadence as the live tiles, so the digits stream). */
/** The donut's centre number, streaming at 80 ms on its own. */
function LiveDonutAmount({ base, fixed, now, currency }: { base: number; fixed: number; now: Date; currency: string }) {
  const fraction = useMonthFraction(now, true, 80);
  return <LiveAmount value={base + fixed * fraction} currency={currency} size="1.05rem" />;
}

function useMonthFraction(now: Date, ticking: boolean, ms = 80) {
  const clock = useNow(ms, ticking);
  // Exactly as LiveTiles (days × 24 h), so the total matches the Spent tile.
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.min(Math.max((clock - start) / (days * 86_400_000), 0), 1);
}

/** Animates an array of numbers toward `target` with an ease-in-out curve.
 *  Starts from wherever the previous animation got to, so switching back
 *  mid-animation reverses smoothly. */
export function useTween(target: number[], ms: number) {
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

