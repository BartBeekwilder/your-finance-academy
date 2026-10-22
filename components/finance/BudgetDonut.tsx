"use client";

import { useState } from "react";
import { money } from "@/lib/finance/format";
import type { Category } from "@/lib/finance/types";
import { useCategoryDetail } from "./CategoryDetail";
import { useTween } from "./charts";

// The budget as a pie chart (Budgets page, default view): each slice is a
// category's budget for the month, and it fills from the inside out — like a
// gauge — up to what's expected; the unfilled rest stays faint. A category
// expected to go over fills completely and spills a red rim out past the
// ring (the bars' spill, in the round). Pointing at a slice or legend row
// pops it out and shows "€X of €Y · Z%" in the centre; clicking opens it.

type Item = { category: Category; budget: number; expected: number };

const R = 84, r = 54, C = 100, POP = 7;

export default function BudgetDonut({
  items,
  currency,
  title,
  caption,
  headerRight,
}: {
  items: Item[];
  currency: string;
  /** e.g. "Budget for October". */
  title: string;
  /** Under the centre total, e.g. "expected" / "spent". */
  caption: string;
  headerRight?: React.ReactNode;
}) {
  const [active, setActive] = useState<number | null>(null);
  const openCategory = useCategoryDetail();
  const withBudget = items.filter((i) => i.budget > 0);
  const totalBudget = withBudget.reduce((t, i) => t + i.budget, 0);
  const totalExpected = withBudget.reduce((t, i) => t + i.expected, 0);
  // Fill levels ease in (and morph when the month changes).
  const fills = useTween(withBudget.map((i) => i.expected / i.budget), 800);

  const sweeps = withBudget.map((i) => (totalBudget ? (i.budget / totalBudget) * Math.PI * 2 : 0));
  const starts = sweeps.map((_, k) => -Math.PI / 2 + sweeps.slice(0, k).reduce((a, b) => a + b, 0));
  const p = (rad: number, a: number) => `${C + Math.cos(a) * rad} ${C + Math.sin(a) * rad}`;
  const arc = (a0: number, a1: number, inner: number, outer: number) => {
    if (a1 - a0 <= 0.001 || outer - inner <= 0.2) return "";
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${p(outer, a0)} A ${outer} ${outer} 0 ${large} 1 ${p(outer, a1)} L ${p(inner, a1)} A ${inner} ${inner} 0 ${large} 0 ${p(inner, a0)} Z`;
  };

  const shown = active !== null ? withBudget[active] : null;
  const ratio = shown ? shown.expected / shown.budget : totalBudget ? totalExpected / totalBudget : 0;
  const over = shown ? shown.expected > shown.budget : totalExpected > totalBudget;

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{title}</span>
        {headerRight}
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "space-around", flexWrap: "wrap" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2, fontSize: "0.74rem", flex: "1 1 170px", maxWidth: 270 }}>
          {withBudget.map((i, k) => (
            <li key={i.category.id}>
              <button
                className="pf-tap pf-legend-row"
                data-active={active === k}
                data-dim={active !== null && active !== k}
                onClick={(e) => openCategory(i.category.id, e.currentTarget)}
                onMouseEnter={() => setActive(k)}
                onMouseLeave={() => setActive(null)}
                style={{ ["--c" as string]: `#${i.category.color_hex}` }}
              >
                <span className="pf-legend-swatch" />
                <span style={{ flex: 1 }}>{i.category.name}</span>
                <span className="pf-rounded" style={{ color: i.expected > i.budget ? "var(--pf-red)" : "var(--pf-ink-3)" }}>
                  {Math.round((i.expected / i.budget) * 100)}%
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div style={{ position: "relative", width: 200, height: 200, flex: "none" }}>
          <svg viewBox="0 0 200 200" width={200} height={200} role="img" aria-label={title} style={{ overflow: "visible" }} onMouseLeave={() => setActive(null)}>
            {withBudget.map((i, k) => {
              const gap = sweeps[k] > 0.05 ? 0.014 : 0.004;
              const a0 = starts[k] + gap, a1 = starts[k] + sweeps[k] - gap;
              const f = Math.max(0, fills[k] ?? 0);
              const fillOuter = r + (R - r) * Math.min(f, 1);
              // Over budget: a red rim out past the ring, as deep as the overspend (capped).
              const spill = f > 1 ? Math.min((f - 1) * (R - r), 14) : 0;
              const mid = starts[k] + sweeps[k] / 2;
              const color = `#${i.category.color_hex}`;
              const isActive = active === k;
              return (
                <g
                  key={i.category.id}
                  className="pf-slice-in"
                  style={{
                    animationDelay: `${k * 60}ms`,
                    transform: isActive ? `translate(${Math.cos(mid) * POP}px, ${Math.sin(mid) * POP}px)` : undefined,
                    transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s",
                    opacity: active === null || isActive ? 1 : 0.35,
                  }}
                  onMouseEnter={() => setActive(k)}
                  onClick={(e) => openCategory(i.category.id, e.currentTarget as unknown as Element)}
                  role="button"
                  aria-label={`${i.category.name}: ${money(i.expected, currency)} of ${money(i.budget, currency)}`}
                >
                  {/* The whole budget, faint. */}
                  <path d={arc(a0, a1, r, R)} fill={color} opacity={0.18} />
                  <path d={arc(a0, a1, r, R)} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1} />
                  {/* Filled up to what's expected. */}
                  <path d={arc(a0, a1, r, fillOuter)} fill={color} style={{ filter: isActive ? `drop-shadow(0 0 8px ${color})` : undefined }} />
                  {spill > 0 && <path className="pf-donut-spill" d={arc(a0, a1, R + 1.5, R + 1.5 + spill)} fill="#ff453a" />}
                </g>
              );
            })}
          </svg>

          <div key={active ?? -1} className="pf-donut-centre" aria-hidden>
            <span style={{ fontSize: "0.68rem", color: shown ? `#${shown.category.color_hex}` : "var(--pf-ink-2)", fontWeight: 600 }}>
              {shown ? shown.category.name : caption}
            </span>
            <span className="pf-rounded" style={{ fontSize: "1.05rem", fontWeight: 700, color: over ? "var(--pf-red)" : undefined }}>
              {money(shown ? shown.expected : totalExpected, currency)}
            </span>
            <span style={{ fontSize: "0.62rem", color: "var(--pf-ink-3)" }}>
              of {money(shown ? shown.budget : totalBudget, currency)} · {Math.round(ratio * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
