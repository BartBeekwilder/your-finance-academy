"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { live, monthKey, num, selfAndChildren } from "@/lib/finance/calc";
import { dayLabel, money, monthYear, shortMonth } from "@/lib/finance/format";
import CategoryIcon from "./CategoryIcon";
import { useFinance } from "./FinanceProvider";
import Sheet from "./Sheet";

// Web version of the iOS CategoryExpensesSheet: tap any category card, donut
// slice or budget row to see that category's month total and budget status,
// year-to-date running total, spend per month, and the month's transactions.

const Ctx = createContext<(categoryId: string) => void>(() => {});

/** Returns a function that opens the detail sheet for a category id. */
export const useCategoryDetail = () => useContext(Ctx);

export function CategoryDetailProvider({ children }: { children: ReactNode }) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const open = useCallback((id: string) => setCategoryId(id), []);

  return (
    <Ctx.Provider value={open}>
      {children}
      <Sheet open={categoryId !== null} onClose={() => setCategoryId(null)} label="Category details">
        {categoryId && <Detail categoryId={categoryId} onClose={() => setCategoryId(null)} />}
      </Sheet>
    </Ctx.Provider>
  );
}

function Detail({ categoryId, onClose }: { categoryId: string; onClose: () => void }) {
  const { data, now } = useFinance();
  const currency = data.profile.currency_code;
  const categories = live(data.categories);
  const category = categories.find((c) => c.id === categoryId);

  const view = useMemo(() => {
    if (!category) return null;
    const ids = selfAndChildren(category, categories);
    const expenses = live(data.transactions).filter((t) => t.type === "expense" && t.category_id && ids.has(t.category_id));
    const year = now.getFullYear();
    const perMonth = Array.from({ length: 12 }, (_, m) => {
      const key = monthKey(new Date(year, m, 1));
      return {
        month: new Date(year, m, 1),
        total: expenses.filter((t) => monthKey(new Date(t.date)) === key).reduce((s, t) => s + num(t.amount), 0),
        future: m > now.getMonth(),
      };
    });
    const thisMonth = expenses
      .filter((t) => monthKey(new Date(t.date)) === monthKey(now))
      .sort((a, b) => b.date.localeCompare(a.date));
    const budget = live(data.budgets).find((b) => b.category_id === category.id && b.month.slice(0, 7) === monthKey(now));
    return {
      perMonth,
      thisMonth,
      monthTotal: thisMonth.reduce((s, t) => s + num(t.amount), 0),
      ytd: perMonth.reduce((s, p) => s + p.total, 0),
      budget: budget ? num(budget.amount) : null,
    };
  }, [category, categories, data.transactions, data.budgets, now]);

  if (!category || !view) return null;
  const color = `#${category.color_hex}`;
  const over = view.budget !== null && view.monthTotal > view.budget;
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <CategoryIcon icon={category.icon} colorHex={category.color_hex} size={44} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{category.name}</h2>
          <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{monthYear(now)}</div>
        </div>
        <span className="pf-rounded" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{money(view.monthTotal, currency)}</span>
        <button className="pf-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
      </header>

      {view.budget !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -12, fontSize: "0.78rem", fontWeight: 500, color: over ? "var(--pf-red)" : "var(--pf-green)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />
          {over ? "Over Budget" : "Under Budget"}
          <span style={{ color: "var(--pf-ink-3)", fontWeight: 400 }}>· {money(view.budget, currency)} limit</span>
        </div>
      )}

      <section>
        <h3 className="pf-section-title" style={{ marginLeft: 0 }}>Cumulative — {now.getFullYear()}</h3>
        <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>Year to Date</div>
        <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{money(view.ytd, currency)}</div>
        <CumulativeChart points={view.perMonth} color={color} currency={currency} />
      </section>

      <section>
        <h3 className="pf-section-title" style={{ marginLeft: 0 }}>Per Month — {now.getFullYear()}</h3>
        <MonthBars points={view.perMonth} color={color} currency={currency} budget={view.budget} current={now.getMonth()} />
      </section>

      <section>
        <h3 className="pf-section-title" style={{ marginLeft: 0 }}>Transactions — {monthYear(now)}</h3>
        <div className="pf-card" style={{ background: "var(--pf-card-2)" }}>
          {view.thisMonth.length === 0 && <div className="pf-row" style={{ color: "var(--pf-ink-2)" }}>No expenses in this category this month.</div>}
          {view.thisMonth.map((t) => {
            const sub = t.category_id && t.category_id !== category.id ? byId.get(t.category_id)?.name : undefined;
            return (
              <div key={t.id} className="pf-row">
                <div style={{ flex: 1 }}>
                  <div>{t.note || sub || category.name}</div>
                  {sub && sub !== t.note && <div style={{ fontSize: "0.7rem", color: "var(--pf-ink-2)" }}>{sub}</div>}
                  <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{dayLabel(t.date)}</div>
                </div>
                <span className="pf-rounded">{money(num(t.amount), currency)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

type Point = { month: Date; total: number; future: boolean };

/** Running total through the year; hover or drag to read any month. */
function CumulativeChart({ points, color, currency }: { points: Point[]; color: string; currency: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 480, H = 140;
  const past = points.filter((p) => !p.future);
  const cum = past.map((_, i) => past.slice(0, i + 1).reduce((s, p) => s + p.total, 0));
  const max = Math.max(1, ...cum);
  const x = (i: number) => (i / 11) * W;
  const y = (v: number) => H - (v / max) * (H - 12) - 4;
  const line = cum.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const shown = sel !== null && sel < cum.length ? sel : cum.length - 1;

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSel(Math.max(0, Math.min(cum.length - 1, Math.round(((e.clientX - r.left) / r.width) * 11))));
  };

  return (
    <div>
      <div style={{ height: 18, fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
        {cum.length > 0 && `${monthYear(past[shown].month)} · ${money(cum[shown], currency)} so far`}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        style={{ touchAction: "none", cursor: "crosshair" }}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setSel(null)}
        role="img"
        aria-label="Cumulative spending this year"
      >
        <path d={`${line} L${x(cum.length - 1)},${H} L0,${H} Z`} fill={color} opacity={0.18} />
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        {cum.length > 0 && (
          <line x1={x(shown)} x2={x(shown)} y1={0} y2={H} stroke="var(--pf-ink-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  );
}

/** One bar per month of the year, current month highlighted, budget line. */
function MonthBars({ points, color, currency, budget, current }: {
  points: Point[]; color: string; currency: string; budget: number | null; current: number;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, budget ?? 0, ...points.map((p) => p.total));
  const H = 130;
  const shown = sel ?? current;

  return (
    <div>
      <div style={{ height: 18, fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
        {monthYear(points[shown].month)} · {points[shown].future ? "not yet" : money(points[shown].total, currency)}
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 4, height: H + 16 }}>
        {budget !== null && (
          <div
            title={`Budget ${money(budget, currency)}`}
            style={{ position: "absolute", left: 0, right: 0, bottom: 16 + (budget / max) * H, borderTop: "1px dashed var(--pf-ink-3)", pointerEvents: "none" }}
          />
        )}
        {points.map((p, i) => (
          <button
            key={i}
            onMouseEnter={() => setSel(i)}
            onMouseLeave={() => setSel(null)}
            onClick={() => setSel(sel === i ? null : i)}
            aria-label={`${monthYear(p.month)}: ${money(p.total, currency)}`}
            style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 3, padding: 0, border: 0, background: "none", cursor: "pointer" }}
          >
            <span
              style={{
                width: "70%",
                maxWidth: 22,
                height: Math.max(p.total ? 3 : 0, (p.total / max) * H),
                borderRadius: 3,
                background: color,
                opacity: i === shown ? 1 : i === current ? 0.8 : 0.4,
              }}
            />
            <span style={{ fontSize: "0.58rem", color: i === shown ? "var(--pf-ink)" : "var(--pf-ink-3)" }}>{shortMonth(p.month).slice(0, 1)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
