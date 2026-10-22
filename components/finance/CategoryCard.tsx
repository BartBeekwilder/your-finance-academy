"use client";

import { useState } from "react";
import { WithYAxis } from "./YAxis";
import { categoryYear } from "@/lib/finance/calc";
import { money, shortMonth } from "@/lib/finance/format";
import type { Category } from "@/lib/finance/types";
import CategoryIcon from "./CategoryIcon";
import { useCategoryDetail } from "./CategoryDetail";
import { useFinance } from "./FinanceProvider";

// Dashboard "Spending by Category" card — the iOS CategoryChartCard as bars:
// Jan–Dec of this year, current month highlighted and labelled, each month's
// budget as a dashed tick, red bars for months over budget. Hover a bar to
// read that month in the header; click anywhere to open the category sheet.

const RED = "#ff453a";

export default function CategoryCard({ category }: { category: Category }) {
  const { data, now } = useFinance();
  const openCategory = useCategoryDetail();
  const [hover, setHover] = useState<number | null>(null);
  const currency = data.profile.currency_code;
  const color = `#${category.color_hex}`;
  const { months } = categoryYear(data, category, now);
  const current = now.getMonth();
  const shown = months[hover ?? current];
  const max = Math.max(1, ...months.map((m) => Math.max(m.total, m.budget ?? 0)));
  const H = 56;

  const shownOver = shown.budget !== null && shown.total > shown.budget;

  return (
    <button className="pf-card pf-bouncy pf-tap" onClick={(e) => openCategory(category.id, e.currentTarget)} style={{ padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CategoryIcon icon={category.icon} colorHex={category.color_hex} size={28} />
        <strong style={{ fontSize: "0.95rem", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {category.name}
        </strong>
        <span className="pf-rounded" style={{ fontWeight: 700, color: shownOver ? RED : undefined }}>
          {shown.future ? "—" : money(shown.total, currency)}
        </span>
      </div>

      <WithYAxis height={H} ticks={[{ value: 0, at: 0 }, { value: max, at: 1 }]} currency={currency}>
<div style={{ display: "flex", alignItems: "flex-end", gap: 3 }} onMouseLeave={() => setHover(null)} aria-hidden>
        {months.map((m, i) => {
          const over = m.budget !== null && m.total > m.budget;
          const active = i === (hover ?? current);
          return (
            <span key={i} onMouseEnter={() => setHover(i)} style={{ flex: 1, display: "grid", gap: 3, justifyItems: "center" }}>
              <span style={{ position: "relative", width: "100%", height: H, display: "flex", alignItems: "flex-end" }}>
                {m.future ? (
                  <span style={{ width: "100%", height: 2, borderRadius: 1, background: "var(--pf-line)" }} />
                ) : (
                  <span
                    style={{
                      width: "100%",
                      height: Math.max(m.total ? 2 : 0, (m.total / max) * H),
                      borderRadius: 2,
                      background: over ? RED : color,
                      opacity: active ? 1 : i === current ? 0.85 : 0.4,
                      outline: i === current ? `1.5px solid ${over ? RED : color}` : undefined,
                      outlineOffset: 1.5,
                    }}
                  />
                )}
                {m.budget !== null && (
                  <span
                    style={{
                      position: "absolute",
                      left: -1.5,
                      right: -1.5,
                      bottom: (m.budget / max) * H,
                      borderTop: "1.5px dashed var(--pf-ink-2)",
                      opacity: m.future ? 0.3 : 0.75,
                    }}
                  />
                )}
              </span>
              <span
                style={{
                  fontSize: "0.56rem",
                  lineHeight: 1,
                  fontWeight: i === current ? 700 : 400,
                  color: active ? "var(--pf-ink)" : i === current ? "var(--pf-ink-2)" : "var(--pf-ink-3)",
                }}
              >
                {shortMonth(m.month).slice(0, 1)}
              </span>
            </span>
          );
        })}
      </div>
</WithYAxis>

      {/* Footer describes whichever month the header shows (current, or hovered). */}
      <div style={{ fontSize: "0.7rem", color: shownOver ? RED : "var(--pf-ink-2)" }}>
        <strong style={{ fontWeight: 600, color: "var(--pf-ink-2)" }}>
          {shortMonth(shown.month)}
          {shown.month.getMonth() === current ? " · so far" : ""}
        </strong>
        {shown.future
          ? " · not yet"
          : shown.budget !== null
            ? ` · ${Math.round((shown.total / shown.budget) * 100)}% of ${money(shown.budget, currency)} budget`
            : " · no budget"}
      </div>
    </button>
  );
}
