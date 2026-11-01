"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMotionMode } from "@/lib/motion";

// The category chart drawn as stacked areas (like App Store Connect's "Top
// Apps"): each group a band on top of the ones below, its top edge a line in
// the group's colour, the fill a soft tint. Same data, slots and hover as the
// bars: invisible columns at each day / month keep the x positions in step
// with the labels, and pointing picks the band under the pointer. Buckets
// ahead (future) show the expected total as a dashed line.
//
// Pointing at a band lifts it out of the stack: it glides down onto the
// zero line, so its height is its own amount — and its budget (per day in
// the month view, per month in the year view) shows as a faint red dotted
// line to measure it against.

type Bucket = { key: string; by: Map<string, number>; total: number; future: boolean; expected?: number };
type Group = { id: string; color: string };

export default function CategoryAreas({
  buckets,
  stack,
  max,
  height,
  mode,
  lit,
  hoverIndex,
  onHover,
  onPick,
  budget = null,
  budgetLabel,
}: {
  buckets: Bucket[];
  stack: Group[];
  max: number;
  height: number;
  mode: string;
  lit: string | null;
  hoverIndex: number | null;
  onHover: (h: { month: number; id: string } | null) => void;
  onPick: (id: string, el: Element) => void;
  /** The lit group's budget per bucket (null: none). */
  budget?: (number | null)[] | null;
  budgetLabel?: string;
}) {
  const plot = useRef<HTMLDivElement>(null);
  const [xs, setXs] = useState<number[]>([]);
  const [w, setW] = useState(1);

  // Centres of the slots, measured, so the areas line up with the labels.
  useLayoutEffect(() => {
    const el = plot.current;
    if (!el) return;
    const measure = () => {
      const slots = [...el.querySelectorAll<HTMLElement>(".pf-cbar-slot")];
      setW(el.clientWidth || 1);
      setXs(slots.map((s) => s.offsetLeft + s.offsetWidth / 2));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [buckets.length]);

  // The lifted band and how far it has glided down (0 in the stack, 1 on
  // the zero line), eased over 0.42 s; letting go glides it back up.
  const motion = useMotionMode();
  const [liftId, setLiftId] = useState<string | null>(null);
  const [k, setK] = useState(0);
  const kRef = useRef(0);
  useEffect(() => {
    if (lit && lit !== liftId) {
      kRef.current = 0;
      setLiftId(lit);
    }
    const target = lit ? 1 : 0;
    if (motion === "off") {
      kRef.current = target;
      setK(target);
      if (!lit) setLiftId(null);
      return;
    }
    const from = kRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (ms: number) => {
      const p = Math.min(1, (ms - t0) / 420);
      kRef.current = from + (target - from) * (1 - (1 - p) ** 3);
      setK(kRef.current);
      if (p < 1) raf = requestAnimationFrame(step);
      else if (!lit) setLiftId(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit, motion]);

  const y = (v: number) => height - (v / max) * height;
  const done = buckets.map((b, i) => ({ b, i })).filter(({ b }) => !b.future);
  const ready = xs.length === buckets.length;

  // Bands bottom-up: cumulative lower and upper per finished bucket.
  const bands = stack.map((g, gi) => {
    const lower = done.map(({ b }) => stack.slice(0, gi).reduce((t, s) => t + (b.by.get(s.id) ?? 0), 0));
    const upper = done.map(({ b }, k) => lower[k] + (b.by.get(g.id) ?? 0));
    return { g, lower, upper };
  });
  // The lifted band slides down by k of its base, and is drawn last (on top).
  const lifted = bands.findIndex(({ g }) => g.id === liftId);
  if (lifted >= 0) {
    const b = bands[lifted];
    const lower = b.lower.map((v) => v * (1 - k));
    bands.splice(lifted, 1);
    bands.push({ g: b.g, lower, upper: lower.map((v, j) => v + (b.upper[j] - b.lower[j])) });
  }
  const budgetPts = budget && lit && ready ? budget.map((v, i) => (v != null && xs[i] !== undefined ? { x: xs[i], y: Math.max(4, y(v)) } : null)) : null;
  const budgetShown = budgetPts?.filter((p): p is { x: number; y: number } => p !== null) ?? [];
  const pts = (vals: number[]) => done.map(({ i }, k) => `${xs[i]?.toFixed(1)},${y(vals[k]).toFixed(1)}`);
  const ahead = buckets.map((b, i) => ({ b, i })).filter(({ b }) => b.future && b.expected);
  const lastDone = done[done.length - 1];

  function pick(e: React.MouseEvent, i: number) {
    const b = buckets[i];
    if (b.future) return onHover(null);
    const rect = plot.current!.getBoundingClientRect();
    const v = ((rect.bottom - e.clientY) / height) * max;
    let acc = 0;
    let id = stack[stack.length - 1]?.id;
    for (const s of stack) {
      acc += b.by.get(s.id) ?? 0;
      if (v <= acc) {
        id = s.id;
        break;
      }
    }
    // Above the stack: the top band that this bucket has.
    if (v > acc) id = [...stack].reverse().find((s) => b.by.get(s.id))?.id ?? id;
    if (id) onHover({ month: i, id });
  }

  return (
    <div ref={plot} key={mode} className="pf-cbar-plot pf-carea" data-mode={mode} style={{ height }} onMouseLeave={() => onHover(null)}>
      {[0, 0.5, 1].map((f) => (
        <span key={`g${f}`} className="pf-cbar-grid" style={{ bottom: f * height }} />
      ))}
      {ready && done.length > 0 && (
        <svg className="pf-carea-svg" viewBox={`0 0 ${w} ${height}`} width={w} height={height} aria-hidden>
          {bands.map(({ g, lower, upper }) => {
            if (upper.every((u, k) => u === lower[k])) return null;
            const top = pts(upper);
            const area = `M${top.join(" L")} L${pts(lower).reverse().join(" L")} Z`;
            const dim = lit !== null && lit !== g.id;
            return (
              <g key={g.id} className="pf-carea-band" data-dim={dim} data-lit={lit === g.id}>
                <path d={area} fill={g.color} fillOpacity={lit === g.id ? 0.55 : 0.28} />
                <path d={`M${top.join(" L")}`} fill="none" stroke={g.color} strokeWidth={lit === g.id ? 2.6 : 1.8} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}
          {/* Expected totals ahead, dashed, continuing from the last finished point. */}
          {ahead.length > 0 && lastDone && (
            <path
              d={`M${xs[lastDone.i].toFixed(1)},${y(lastDone.b.total).toFixed(1)} ${ahead.map(({ b, i }) => `L${xs[i].toFixed(1)},${y(b.expected ?? 0).toFixed(1)}`).join(" ")}`}
              fill="none"
              stroke="rgba(var(--pf-cbar-accent), 0.55)"
              strokeWidth={1.6}
              strokeDasharray="4 5"
            />
          )}
          {budgetShown.length > 0 && (() => {
            // One budget for every day: a level line across the whole chart.
            const level = budgetShown.every((p) => p.y === budgetShown[0].y);
            const line = level ? [{ x: 0, y: budgetShown[0].y }, { x: w, y: budgetShown[0].y }] : budgetShown;
            const end = line[line.length - 1];
            return (
              <g key={lit ?? ""} className="pf-carea-budget">
                <path d={`M${line.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`} fill="none" stroke="rgba(255, 69, 58, 0.6)" strokeWidth={1.3} strokeDasharray="2 4" strokeLinecap="round" />
                {budgetLabel && (
                  <text x={end.x - 4} y={end.y - 6} textAnchor="end" fontSize={10} fill="rgba(255, 105, 97, 0.85)">
                    {budgetLabel}
                  </text>
                )}
              </g>
            );
          })()}
          {hoverIndex !== null && xs[hoverIndex] !== undefined && !buckets[hoverIndex].future && (
            <g>
              <line x1={xs[hoverIndex]} x2={xs[hoverIndex]} y1={0} y2={height} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 3" />
              {bands.map(({ g, upper, lower }) => {
                const k = done.findIndex(({ i }) => i === hoverIndex);
                if (k < 0 || upper[k] === lower[k]) return null;
                return <circle key={g.id} cx={xs[hoverIndex]} cy={y(upper[k])} r={lit === g.id ? 4.5 : 3} fill={g.color} stroke="var(--pf-card)" strokeWidth={1.5} />;
              })}
            </g>
          )}
        </svg>
      )}
      {buckets.map((b, i) => (
        <div
          key={b.key}
          className="pf-cbar-slot pf-carea-hit"
          data-future={b.future}
          onMouseMove={(e) => pick(e, i)}
          onClick={(e) => {
            const id = lit;
            if (id) onPick(id, e.currentTarget);
          }}
        />
      ))}
    </div>
  );
}
