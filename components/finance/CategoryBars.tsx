"use client";

import { useState } from "react";
import { live, spendByCategory, summarize, yearForecast } from "@/lib/finance/calc";
import { money, monthYear, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import { useCategoryDetail } from "./CategoryDetail";

// Spending per month for the last twelve months as stacked bars: each bar
// is a month, built up from its categories (subcategories rolled into their
// parent) in the user's own category order and colours; spending without a
// category is a grey block on top. The bars grow up one after another on
// first paint. Pointing at a block — or a legend entry — lights that
// category up in every month and dims the rest; the readout above says what
// it is. Clicking a block opens the category sheet. This month's bar is
// "so far", with a dashed outline up to the month's forecast.

const H = 210;
const OTHER = "__other";

export default function CategoryBars({ data, now, currency }: { data: FinanceData; now: Date; currency: string }) {
  const openCategory = useCategoryDetail();
  const [hover, setHover] = useState<{ month: number; id: string } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const categories = live(data.categories)
    .filter((c) => !c.is_income_category && c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const by = new Map(spendByCategory(data, d).map((e) => [e.category.id, e.spent]));
    const total = summarize(data.transactions, d).spent;
    const named = [...by.values()].reduce((a, b) => a + b, 0);
    if (total - named > 0.005) by.set(OTHER, total - named);
    return { d, by, total };
  });
  const expected = yearForecast(data, now)[0].spent;
  const max = niceMax(Math.max(1, expected, ...months.map((m) => m.total)));
  const used = categories.filter((c) => months.some((m) => m.by.has(c.id)));
  const hasOther = months.some((m) => m.by.has(OTHER));
  const stack = [...used.map((c) => ({ id: c.id, name: c.name, color: `#${c.color_hex}` })), ...(hasOther ? [{ id: OTHER, name: "No category", color: "#636366" }] : [])];

  const lit = hover?.id ?? focus;
  const shown = hover ? months[hover.month] : null;
  const shownCat = hover ? stack.find((s) => s.id === hover.id) : null;
  const shownValue = hover && shown ? (shown.by.get(hover.id) ?? 0) : 0;
  const last = months[months.length - 1];

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>Spending per month by category</span>
        <span key={hover ? `${hover.month}-${hover.id}` : focus ?? "idle"} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          {hover && shown && shownCat ? (
            <>
              <span className="pf-cbar-swatch" style={{ background: shownCat.color }} />
              {shownCat.name} · {monthYear(shown.d)} ·{" "}
              <b style={{ color: "var(--pf-ink)" }}>{money(shownValue, currency)}</b>{" "}
              <span style={{ color: "var(--pf-ink-3)" }}>({shown.total ? Math.round((shownValue / shown.total) * 100) : 0}% of the month)</span>
            </>
          ) : (
            <>
              {monthYear(last.d)} so far <b style={{ color: "var(--pf-red)" }}>{money(last.total, currency)}</b>
              <span style={{ color: "var(--pf-ink-3)" }}> · expected {money(expected, currency)}</span>
            </>
          )}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: H, fontSize: "0.6rem", color: "var(--pf-ink-3)", textAlign: "right" }}>
          <span>{money(max, currency, { compact: true })}</span>
          <span>{money(max / 2, currency, { compact: true })}</span>
          <span>{money(0, currency, { compact: true })}</span>
        </div>
        <div style={{ position: "relative", minWidth: 0 }}>
          {[0, 0.5, 1].map((f) => (
            <span key={f} className="pf-cbar-grid" style={{ bottom: f * H }} />
          ))}
          <div className="pf-cbar-plot" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {months.map((m, i) => {
              const isNow = i === months.length - 1;
              return (
                <div key={m.d.toISOString()} className="pf-cbar-slot">
                  {isNow && expected > m.total && <span className="pf-cbar-expected" style={{ height: `${(expected / max) * 100}%` }} />}
                  <div className="pf-cbar" style={{ height: `${(m.total / max) * 100}%`, animationDelay: `${i * 45}ms` }}>
                    {stack.map((s) => {
                      const v = m.by.get(s.id);
                      if (!v) return null;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="pf-cbar-seg"
                          aria-label={`${s.name}, ${monthYear(m.d)}: ${money(v, currency)}`}
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
          <div className="pf-cbar-labels">
            {months.map((m, i) => (
              <span key={m.d.toISOString()} data-now={i === months.length - 1} data-lit={hover?.month === i}>
                {shortMonth(m.d)}
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

/** Round the axis top up to 1, 2 or 5 × a power of ten. */
function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}
