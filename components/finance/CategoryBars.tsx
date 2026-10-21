"use client";

import { useState } from "react";
import { live, spendByCategory, summarize, yearForecast } from "@/lib/finance/calc";
import { money, monthYear, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import type { Mode } from "./LiveTiles";
import { useCategoryDetail } from "./CategoryDetail";

// Spending as stacked bars, following the page's Month / Year toggle:
//   Year  — January to December of this year, one bar each; the months
//           still to come are placeholders, outlined at their forecast.
//   Month — every day of this month; fixed costs are spread evenly over the
//           days (the Spent tile's rule), variable spending sits on the day
//           it happened, and the days still to come are empty slots.
// Each bar is built up from its categories (subcategories rolled into their
// parent) in the user's own category order and colours; spending without a
// category is a grey block on top. The bars grow up one after another on
// first paint and whenever the view switches. Pointing at a block — or a legend entry — lights that
// category up in every month and dims the rest; the readout above says what
// it is. Clicking a block opens the category sheet. In Year view this
// month's bar is "so far", with a dashed outline up to the month's forecast,
// as are the placeholders for the months to come.

const H = 210;
const OTHER = "__other";

type Bucket = {
  key: string;
  label: string;
  long: string;
  by: Map<string, number>;
  total: number;
  isNow: boolean;
  future: boolean;
  /** Forecast for the whole bucket (this month and later), drawn dashed. */
  expected?: number;
};

export default function CategoryBars({ data, now, currency, mode }: { data: FinanceData; now: Date; currency: string; mode: Mode }) {
  const openCategory = useCategoryDetail();
  const [hover, setHover] = useState<{ month: number; id: string } | null>(null);
  const [ghost, setGhost] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const categories = live(data.categories)
    .filter((c) => !c.is_income_category && c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);
  const months = mode === "year" ? yearBuckets(data, now) : dayBuckets(data, now);
  const expected = yearForecast(data, now)[0].spent;
  const max = niceMax(Math.max(1, ...months.map((m) => Math.max(m.total, m.expected ?? 0))));
  const used = categories.filter((c) => months.some((m) => m.by.has(c.id)));
  const hasOther = months.some((m) => m.by.has(OTHER));
  const stack = [...used.map((c) => ({ id: c.id, name: c.name, color: `#${c.color_hex}` })), ...(hasOther ? [{ id: OTHER, name: "No category", color: "#636366" }] : [])];

  const lit = hover?.id ?? focus;
  const shown = hover ? months[hover.month] : null;
  const shownCat = hover ? stack.find((s) => s.id === hover.id) : null;
  const shownValue = hover && shown ? (shown.by.get(hover.id) ?? 0) : 0;
  const current = months.find((m) => m.isNow);

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>Spending per month by category</span>
        <span key={hover ? `${hover.month}-${hover.id}` : focus ?? "idle"} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          {ghost !== null && months[ghost] ? (
            <>
              {months[ghost].long} · expected <b style={{ color: "var(--pf-ink)" }}>{money(months[ghost].expected ?? 0, currency)}</b>
              <span style={{ color: "var(--pf-ink-3)" }}> · average of the finished months</span>
            </>
          ) : hover && shown && shownCat ? (
            <>
              <span className="pf-cbar-swatch" style={{ background: shownCat.color }} />
              {shownCat.name} · {shown.long} ·{" "}
              <b style={{ color: "var(--pf-ink)" }}>{money(shownValue, currency)}</b>{" "}
              <span style={{ color: "var(--pf-ink-3)" }}>({shown.total ? Math.round((shownValue / shown.total) * 100) : 0}% of the {mode === "year" ? "month" : "day"})</span>
            </>
          ) : (
            <>
              {monthYear(now)} so far <b style={{ color: "var(--pf-red)" }}>{money(mode === "year" ? (current?.total ?? 0) : months.reduce((t, m) => t + m.total, 0), currency)}</b>
              <span style={{ color: "var(--pf-ink-3)" }}>
                {mode === "year" ? ` · expected ${money(expected, currency)}` : " · fixed costs spread over the days"}
              </span>
            </>
          )}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
        {/* Axis labels sit exactly on their grid lines. */}
        <div style={{ position: "relative", height: H, fontSize: "0.6rem", color: "var(--pf-ink-3)", textAlign: "right" }}>
          {[1, 0.5, 0].map((f) => (
            <span key={f} style={{ display: "block", position: f === 1 ? "relative" : "absolute", right: 0, bottom: f === 1 ? undefined : f * H, translate: f === 1 ? "0 -50%" : "0 50%", whiteSpace: "nowrap" }}>
              {money(max * f, currency, { compact: true })}
            </span>
          ))}
        </div>
        <div style={{ position: "relative", minWidth: 0 }}>
          <div key={mode} className="pf-cbar-plot" data-mode={mode} style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {[0, 0.5, 1].map((f) => (
              <span key={`g${f}`} className="pf-cbar-grid" style={{ bottom: f * H }} />
            ))}
            {months.map((m, i) => {
              return (
                <div
                  key={m.key}
                  className="pf-cbar-slot"
                  data-future={m.future}
                  onMouseEnter={() => m.future && m.expected && setGhost(i)}
                  onMouseLeave={() => setGhost(null)}
                >
                  {m.expected !== undefined && m.expected > m.total && (
                    <span
                      className="pf-cbar-expected"
                      data-lit={ghost === i}
                      style={{ height: `${(m.expected / max) * 100}%`, animationDelay: `${0.8 + i * 0.045}s` }}
                    />
                  )}
                  <div className="pf-cbar" style={{ height: `${(m.total / max) * 100}%`, animationDelay: `${i * (mode === "year" ? 45 : 18)}ms` }}>
                    {stack.map((s) => {
                      const v = m.by.get(s.id);
                      if (!v) return null;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="pf-cbar-seg"
                          aria-label={`${s.name}, ${m.long}: ${money(v, currency)}`}
                          data-dim={lit !== null && lit !== s.id}
                          data-lit={lit === s.id}
                          style={{ height: `${(v / m.total) * 100}%`, background: s.color }}
                          onMouseEnter={() => setHover({ month: i, id: s.id })}
                          onFocus={() => setHover({ month: i, id: s.id })}
                          onBlur={() => setHover(null)}
                          onClick={(e) => s.id !== OTHER && openCategory(s.id, e.currentTarget)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div key={`l${mode}`} className="pf-cbar-labels pf-readout">
            {months.map((m, i) => (
              <span key={m.key} data-now={m.isNow} data-lit={hover?.month === i}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: "0.72rem" }}>
        {stack.map((s) => (
          <button
            key={s.id}
            type="button"
            className="pf-cbar-legend"
            data-dim={lit !== null && lit !== s.id}
            onMouseEnter={() => setFocus(s.id)}
            onMouseLeave={() => setFocus(null)}
            onClick={(e) => s.id !== OTHER && openCategory(s.id, e.currentTarget)}
          >
            <span className="pf-cbar-swatch" style={{ background: s.color }} />
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** January to December of this year; this month and later carry their forecast. */
function yearBuckets(data: FinanceData, now: Date): Bucket[] {
  const forecast = new Map(yearForecast(data, now).map((f) => [f.month, f.spent]));
  return Array.from({ length: 12 }, (_, m) => {
    const d = new Date(now.getFullYear(), m, 1);
    const future = m > now.getMonth();
    const by = future ? new Map<string, number>() : new Map(spendByCategory(data, d).map((e) => [e.category.id, e.spent]));
    const total = future ? 0 : summarize(data.transactions, d).spent;
    const named = [...by.values()].reduce((a, b) => a + b, 0);
    if (total - named > 0.005) by.set(OTHER, total - named);
    return { key: d.toISOString(), label: shortMonth(d), long: monthYear(d), by, total, isNow: m === now.getMonth(), future, expected: forecast.get(m) };
  });
}

/** Every day of this month: variable spending on its day, fixed costs spread
 *  evenly over the days so far. */
function dayBuckets(data: FinanceData, now: Date): Bucket[] {
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  const days = new Date(year, month + 1, 0).getDate();
  const cats = new Map(live(data.categories).map((c) => [c.id, c]));
  const top = (id: string | null) => {
    const c = id ? cats.get(id) : undefined;
    if (!c || c.is_income_category) return OTHER;
    return c.parent_id ?? c.id;
  };
  const byDay = Array.from({ length: days + 1 }, () => new Map<string, number>());
  const fixed = new Map<string, number>();
  for (const t of live(data.transactions)) {
    const d = new Date(t.date);
    if (t.type !== "expense" || d.getFullYear() !== year || d.getMonth() !== month) continue;
    const id = top(t.category_id);
    if (t.is_fixed_expense) fixed.set(id, (fixed.get(id) ?? 0) + Number(t.amount));
    else byDay[d.getDate()].set(id, (byDay[d.getDate()].get(id) ?? 0) + Number(t.amount));
  }
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const by = new Map(byDay[day]);
    if (day <= today) for (const [id, v] of fixed) by.set(id, (by.get(id) ?? 0) + v / days);
    const d = new Date(year, month, day);
    const show = day === 1 || day === days || day === today || (day % 5 === 0 && Math.abs(day - today) > 1 && days - day > 1);
    return {
      key: String(day),
      label: show ? String(day) : "",
      long: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      by,
      total: [...by.values()].reduce((a, b) => a + b, 0),
      isNow: day === today,
      future: day > today,
    };
  });
}

/** Round the axis top up to 1, 2 or 5 × a power of ten. */
function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}
