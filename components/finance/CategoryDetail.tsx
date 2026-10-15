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
    // A month's budget is its own row if there is one, else the latest
    // earlier one (budgets carry forward), else the current month's.
    const budgets = live(data.budgets)
      .filter((b) => b.category_id === category.id)
      .map((b) => ({ key: b.month.slice(0, 7), amount: num(b.amount) }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const current = budgets.find((b) => b.key === monthKey(now));
    const budgetFor = (key: string) =>
      [...budgets].reverse().find((b) => b.key <= key)?.amount ?? current?.amount ?? budgets[0]?.amount ?? null;
    const perMonth = Array.from({ length: 12 }, (_, m) => {
      const key = monthKey(new Date(year, m, 1));
      return {
        month: new Date(year, m, 1),
        total: expenses.filter((t) => monthKey(new Date(t.date)) === key).reduce((s, t) => s + num(t.amount), 0),
        budget: budgetFor(key),
        future: m > now.getMonth(),
      };
    });
    const thisMonth = expenses
      .filter((t) => monthKey(new Date(t.date)) === monthKey(now))
      .sort((a, b) => b.date.localeCompare(a.date));
    return {
      perMonth,
      thisMonth,
      monthTotal: thisMonth.reduce((s, t) => s + num(t.amount), 0),
      ytd: perMonth.reduce((s, p) => s + p.total, 0),
      budget: perMonth[now.getMonth()].budget,
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
        <MonthBars points={view.perMonth} color={color} currency={currency} current={now.getMonth()} />
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

type Point = { month: Date; total: number; budget: number | null; future: boolean };

const RED = "#ff453a";

function Legend({ color, hasBudget }: { color: string; hasBudget: boolean }) {
  if (!hasBudget) return null;
  return (
    <div style={{ display: "flex", gap: 14, fontSize: "0.68rem", color: "var(--pf-ink-2)", marginTop: 6 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 14, height: 2.5, borderRadius: 2, background: color }} /> Spent
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 14, borderTop: "2px dashed var(--pf-ink-2)" }} /> Budget
      </span>
    </div>
  );
}

/** Running total through the year against the running budget: spending
 *  above the dashed line means over budget for the year so far. Hover or
 *  drag to read any month. */
function CumulativeChart({ points, color, currency }: { points: Point[]; color: string; currency: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 480, H = 140;
  const past = points.filter((p) => !p.future);
  const hasBudget = past.some((p) => p.budget !== null);
  const sum = (key: "total" | "budget", i: number) => past.slice(0, i + 1).reduce((s, p) => s + (p[key] ?? 0), 0);
  const spent = past.map((_, i) => sum("total", i));
  const budget = past.map((_, i) => sum("budget", i));
  const max = Math.max(1, ...spent, ...(hasBudget ? budget : []));
  const x = (i: number) => (i / 11) * W;
  const y = (v: number) => H - (v / max) * (H - 12) - 4;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const shown = sel !== null && sel < spent.length ? sel : spent.length - 1;
  const diff = spent[shown] - budget[shown];

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSel(Math.max(0, Math.min(spent.length - 1, Math.round(((e.clientX - r.left) / r.width) * 11))));
  };

  return (
    <div>
      <div style={{ minHeight: 18, fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
        {spent.length > 0 && (
          <>
            {monthYear(past[shown].month)} · {money(spent[shown], currency)} spent
            {hasBudget && (
              <>
                {" "}of {money(budget[shown], currency)} ·{" "}
                <strong style={{ color: diff > 0 ? RED : "var(--pf-green)", fontWeight: 600 }}>
                  {money(Math.abs(diff), currency)} {diff > 0 ? "over" : "under"}
                </strong>
              </>
            )}
          </>
        )}
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
        aria-label="Cumulative spending this year against budget"
      >
        <path d={`${path(spent)} L${x(spent.length - 1)},${H} L0,${H} Z`} fill={color} opacity={0.18} />
        {hasBudget && (
          <path d={path(budget)} fill="none" stroke="var(--pf-ink-2)" strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        )}
        <path d={path(spent)} fill="none" stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        {spent.length > 0 && (
          <>
            <line x1={x(shown)} x2={x(shown)} y1={0} y2={H} stroke="var(--pf-ink-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={x(shown)} cy={y(spent[shown])} r={3.5} fill={hasBudget && diff > 0 ? RED : color} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <Legend color={color} hasBudget={hasBudget} />
    </div>
  );
}

/** One bar per month with that month's budget as a marker; bars that went
 *  over turn red so a bad month stands out at a glance. */
function MonthBars({ points, color, currency, current }: {
  points: Point[]; color: string; currency: string; current: number;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => Math.max(p.total, p.budget ?? 0)));
  const H = 130;
  const shown = sel ?? current;
  const p = points[shown];
  const hasBudget = points.some((x) => x.budget !== null);
  const overCount = points.filter((x) => !x.future && x.budget !== null && x.total > x.budget).length;

  return (
    <div>
      <div style={{ minHeight: 18, fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
        {monthYear(p.month)} ·{" "}
        {p.future ? (
          "not yet"
        ) : (
          <>
            {money(p.total, currency)}
            {p.budget !== null && (
              <>
                {" "}of {money(p.budget, currency)} ·{" "}
                <strong style={{ color: p.total > p.budget ? RED : "var(--pf-green)", fontWeight: 600 }}>
                  {money(Math.abs(p.total - p.budget), currency)} {p.total > p.budget ? "over" : "under"}
                </strong>
              </>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: H + 16 }}>
        {points.map((pt, i) => {
          const over = !pt.future && pt.budget !== null && pt.total > pt.budget;
          return (
            <button
              key={i}
              onMouseEnter={() => setSel(i)}
              onMouseLeave={() => setSel(null)}
              onClick={() => setSel(sel === i ? null : i)}
              aria-label={`${monthYear(pt.month)}: ${money(pt.total, currency)}${pt.budget !== null ? ` of ${money(pt.budget, currency)} budget` : ""}`}
              style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 3, padding: 0, border: 0, background: "none", cursor: "pointer" }}
            >
              <span style={{ position: "relative", width: "70%", maxWidth: 22, height: H, display: "flex", alignItems: "flex-end" }}>
                <span
                  style={{
                    width: "100%",
                    height: Math.max(pt.total ? 3 : 0, (pt.total / max) * H),
                    borderRadius: 3,
                    background: over ? RED : color,
                    opacity: i === shown ? 1 : i === current ? 0.8 : 0.45,
                  }}
                />
                {pt.budget !== null && (
                  // This month's budget, as a tick across the bar's slot.
                  <span
                    style={{
                      position: "absolute",
                      left: -3,
                      right: -3,
                      bottom: (pt.budget / max) * H,
                      borderTop: "2px dashed var(--pf-ink-2)",
                      opacity: pt.future ? 0.35 : 0.9,
                    }}
                  />
                )}
              </span>
              <span style={{ fontSize: "0.58rem", color: i === shown ? "var(--pf-ink)" : "var(--pf-ink-3)" }}>{shortMonth(pt.month).slice(0, 1)}</span>
            </button>
          );
        })}
      </div>
      {hasBudget && (
        <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: "0.68rem", color: "var(--pf-ink-2)", marginTop: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, borderTop: "2px dashed var(--pf-ink-2)" }} /> Budget
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: RED }} /> Over budget
          </span>
          <span style={{ marginLeft: "auto" }}>
            {overCount === 0 ? "Within budget every month" : `Over budget in ${overCount} month${overCount > 1 ? "s" : ""}`}
          </span>
        </div>
      )}
    </div>
  );
}
