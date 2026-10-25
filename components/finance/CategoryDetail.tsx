"use client";

import { t } from "@/lib/i18n";
import { editProps } from "@/lib/finance/editTransaction";
import { WithYAxis } from "./YAxis";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";
import { categoryYear, live, monthKey, num, type CategoryMonth } from "@/lib/finance/calc";
import { dayLabel, money, monthYear, shortMonth } from "@/lib/finance/format";
import CategoryIcon from "./CategoryIcon";
import { useFinance } from "./FinanceProvider";
import Sheet from "./Sheet";

// Web version of the iOS CategoryExpensesSheet: tap any category card, donut
// slice or budget row to see that category's month total and budget status,
// this month day by day (stacked by subcategory), the split per subcategory
// (each opens its own sheet), year-to-date running total, spend per month,
// and the month's transactions.

type Open = (categoryId: string, from?: Element | null) => void;
const Ctx = createContext<Open>(() => {});

/** Returns a function that opens the detail sheet for a category id. Pass
 *  the clicked element as `from` and the sheet grows out of it. */
export const useCategoryDetail = () => useContext(Ctx);

export function CategoryDetailProvider({ children }: { children: ReactNode }) {
  // The category stays set after closing so the sheet keeps its content
  // while it shrinks back into the element it came from.
  const [state, setState] = useState<{ id: string | null; open: boolean; from: Element | null }>({ id: null, open: false, from: null });
  const open = useCallback<Open>((id, from = null) => setState({ id, open: true, from }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  return (
    <Ctx.Provider value={open}>
      {children}
      <Sheet open={state.open} onClose={close} origin={state.from} label={t("Category details")}>
        {state.id && <Detail key={state.id} categoryId={state.id} onClose={close} />}
      </Sheet>
    </Ctx.Provider>
  );
}

function Detail({ categoryId, onClose }: { categoryId: string; onClose: () => void }) {
  const { data, now } = useFinance();
  const openCategory = useCategoryDetail();
  const currency = data.profile.currency_code;
  const categories = live(data.categories);
  const category = categories.find((c) => c.id === categoryId);

  // No useMemo: the React Compiler memoizes this, and a manual one trips its checks.
  const view = (() => {
    if (!category) return null;
    const { months: perMonth, expenses } = categoryYear(data, category, now);
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
  })();

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
        <button className="pf-icon-button" aria-label={t("Close")} onClick={onClose}><X size={18} /></button>
      </header>

      {view.budget !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -12, fontSize: "0.78rem", fontWeight: 500, color: over ? "var(--pf-red)" : "var(--pf-green)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />
          {over ? t("Over Budget") : t("Under Budget")}
          <span style={{ color: "var(--pf-ink-3)", fontWeight: 400 }}>· {money(view.budget, currency)} limit</span>
        </div>
      )}

      {!category.is_income_category && <BudgetEditor categoryId={category.id} budget={view.budget} currency={currency} now={now} />}

      {(() => {
        // Series: the category itself (spend booked straight on it) and each
        // subcategory, in the sub's own colour or a shade of the parent's.
        const subs = categories.filter((c) => c.parent_id === category.id).sort((a, b) => a.sort_order - b.sort_order);
        const series = [category, ...subs].map((c, i) => ({
          id: c.id,
          name: c.id === category.id && subs.length ? t("{name} (general)", { name: category.name }) : c.name,
          color: c.id !== category.id && c.color_hex.toLowerCase() !== category.color_hex.toLowerCase() ? `#${c.color_hex}` : shade(color, i),
          total: view.thisMonth.filter((x) => (x.category_id ?? category.id) === c.id).reduce((s, x) => s + num(x.amount), 0),
        }));
        const seriesOf = (id: string | null) => (id && series.some((x) => x.id === id) ? id : category.id);
        return (
          <>
            <section>
              <h3 className="pf-section-title" style={{ marginLeft: 0 }}>{t("Per day")} — {monthYear(now)}</h3>
              <DayBars now={now} currency={currency} series={series.filter((x) => x.total > 0)} txs={view.thisMonth.map((x) => ({ day: new Date(x.date).getDate(), id: seriesOf(x.category_id), amount: num(x.amount) }))} />
            </section>
            {subs.length > 0 && (
              <section>
                <h3 className="pf-section-title" style={{ marginLeft: 0 }}>{t("Per subcategory")} — {monthYear(now)}</h3>
                <div className="pf-card" style={{ background: "var(--pf-card-2)" }}>
                  {[...series].filter((x) => x.id !== category.id || x.total > 0).sort((a, b) => b.total - a.total).map((x) => {
                    const sub = subs.find((c) => c.id === x.id);
                    const share = view.monthTotal ? x.total / view.monthTotal : 0;
                    const inner = (
                      <>
                        <span className="pf-cbar-swatch" style={{ background: x.color }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          {x.name}
                          <span className="pf-subshare"><span style={{ width: `${share * 100}%`, background: x.color }} /></span>
                        </span>
                        <span className="pf-rounded" style={{ color: x.total ? "var(--pf-ink)" : "var(--pf-ink-3)" }}>{money(x.total, currency)}</span>
                        <span className="pf-rounded" style={{ width: 40, textAlign: "right", fontSize: "0.75rem", color: "var(--pf-ink-3)" }}>{Math.round(share * 100)}%</span>
                      </>
                    );
                    return sub ? (
                      <button key={x.id} type="button" className="pf-row pf-subrow" onClick={(e) => openCategory(sub.id, e.currentTarget)}>
                        {inner}
                        <ChevronRight size={14} style={{ color: "var(--pf-ink-3)" }} />
                      </button>
                    ) : (
                      <div key={x.id} className="pf-row pf-subrow">
                        {inner}
                        <span style={{ width: 14 }} />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        );
      })()}

      <section>
        <h3 className="pf-section-title" style={{ marginLeft: 0 }}>Cumulative — {now.getFullYear()}</h3>
        <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{t("Year to Date")}</div>
        <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{money(view.ytd, currency)}</div>
        <CumulativeChart points={view.perMonth} color={color} currency={currency} />
      </section>

      <section>
        <h3 className="pf-section-title" style={{ marginLeft: 0 }}>{t("Per month")} — {now.getFullYear()}</h3>
        <MonthBars points={view.perMonth} color={color} currency={currency} current={now.getMonth()} />
      </section>

      <section>
        <h3 className="pf-section-title" style={{ marginLeft: 0 }}>Transactions — {monthYear(now)}</h3>
        <div className="pf-card" style={{ background: "var(--pf-card-2)" }}>
          {view.thisMonth.length === 0 && <div className="pf-row" style={{ color: "var(--pf-ink-2)" }}>{t("No expenses in this category this month.")}</div>}
          {view.thisMonth.map((t) => {
            const sub = t.category_id && t.category_id !== category.id ? byId.get(t.category_id)?.name : undefined;
            return (
              <div key={t.id} className="pf-row" {...editProps(t)}>
                <div style={{ flex: 1 }}>
                  <div>
                    {t.note || sub || category.name}
                    {t.spread_total ? <span className="pf-txn-part"> · {t.spread_index}/{t.spread_total}</span> : null}
                  </div>
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

type Point = CategoryMonth;

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
            {monthYear(past[shown].month)} · {t("{amount} spent", { amount: money(spent[shown], currency) })}
            {hasBudget && (
              <>
                {" "}{t("of {budget}", { budget: money(budget[shown], currency) })} ·{" "}
                <strong style={{ color: diff > 0 ? RED : "var(--pf-green)", fontWeight: 600 }}>
                  {diff > 0 ? t("{amount} over", { amount: money(Math.abs(diff), currency) }) : t("{amount} under", { amount: money(Math.abs(diff), currency) })}
                </strong>
              </>
            )}
          </>
        )}
      </div>
      <WithYAxis height={H} currency={currency} ticks={[0, 0.5, 1].map((f) => ({ value: max * f, at: (4 + f * (H - 12)) / H }))}>
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
        aria-label={t("Cumulative spending this year against budget")}
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
</WithYAxis>
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
          t("not yet")
        ) : (
          <>
            {money(p.total, currency)}
            {p.budget !== null && (
              <>
                {" "}{t("of {budget}", { budget: money(p.budget, currency) })} ·{" "}
                <strong style={{ color: p.total > p.budget ? RED : "var(--pf-green)", fontWeight: 600 }}>
                  {p.total > p.budget ? t("{amount} over", { amount: money(Math.abs(p.total - p.budget), currency) }) : t("{amount} under", { amount: money(Math.abs(p.total - p.budget), currency) })}
                </strong>
              </>
            )}
          </>
        )}
      </div>
      <WithYAxis height={H} top={1} currency={currency} ticks={[0, 0.5, 1].map((f) => ({ value: max * f, at: f }))}>
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
</WithYAxis>
      {hasBudget && (
        <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: "0.68rem", color: "var(--pf-ink-2)", marginTop: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, borderTop: "2px dashed var(--pf-ink-2)" }} /> Budget
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: RED }} /> {t("Over budget")}
          </span>
          <span style={{ marginLeft: "auto" }}>
            {overCount === 0 ? t("Within budget every month") : (overCount === 1 ? t("Over budget in 1 month") : t("Over budget in {n} months", { n: overCount }))}
          </span>
        </div>
      )}
    </div>
  );
}

/** A lighter or darker step of `hex` for the i-th series (0 = itself). */
function shade(hex: string, i: number) {
  if (i === 0) return hex;
  const steps = [55, 35, 70, 25, 80];
  const toward = i % 2 ? "white" : "black";
  return `color-mix(in srgb, ${hex} ${steps[(i - 1) % steps.length]}%, ${toward})`;
}

/** This month day by day, each day's bar stacked by series (the category
 *  and its subcategories). Days ahead are faint; today is marked. Point at a
 *  day to read it. */
function DayBars({ now, currency, series, txs }: {
  now: Date;
  currency: string;
  series: { id: string; name: string; color: string }[];
  txs: { day: number; id: string; amount: number }[];
}) {
  const [sel, setSel] = useState<number | null>(null);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  const H = 110;
  const per = Array.from({ length: days }, (_, d) =>
    series.map((s) => txs.filter((x) => x.day === d + 1 && x.id === s.id).reduce((a, x) => a + x.amount, 0)),
  );
  const totals = per.map((p) => p.reduce((a, b) => a + b, 0));
  const max = niceTop(Math.max(1, ...totals));
  const shown = sel ?? null;
  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= days && Math.abs(d - today) > 1).concat(today);

  return (
    <div>
      <div style={{ minHeight: 18, fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
        {shown === null ? (
          t("{amount} this month so far", { amount: money(totals.reduce((a, b) => a + b, 0), currency) })
        ) : (
          <>
            {dayLabel(new Date(now.getFullYear(), now.getMonth(), shown + 1, 12).toISOString())} · <b style={{ color: "var(--pf-ink)" }}>{money(totals[shown], currency)}</b>
            {series.length > 1 &&
              per[shown]
                .map((v, i) => ({ v, s: series[i] }))
                .filter((x) => x.v > 0)
                .map((x) => (
                  <span key={x.s.id} style={{ marginLeft: 8 }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, background: x.s.color, marginRight: 4 }} />
                    {x.s.name} {money(x.v, currency)}
                  </span>
                ))}
          </>
        )}
      </div>
      <WithYAxis height={H} top={1} currency={currency} ticks={[0, 0.5, 1].map((f) => ({ value: max * f, at: f }))}>
        <div className="pf-daybars" style={{ height: H }} onMouseLeave={() => setSel(null)}>
          {per.map((p, d) => (
            <button
              key={d}
              type="button"
              className="pf-daybar"
              data-future={d + 1 > today}
              data-today={d + 1 === today}
              data-lit={shown === d}
              onMouseEnter={() => setSel(d)}
              onClick={() => setSel(shown === d ? null : d)}
              aria-label={`${d + 1}: ${money(totals[d], currency)}`}
            >
              <span className="pf-daybar-stack" style={{ height: `${(totals[d] / max) * 100}%`, animationDelay: `${d * 12}ms` }}>
                {p.map((v, i) => (v > 0 ? <span key={series[i].id} style={{ flex: v, background: series[i].color }} /> : null))}
              </span>
            </button>
          ))}
        </div>
      </WithYAxis>
      <div className="pf-tsl-x" aria-hidden style={{ marginLeft: 0 }}>
        {ticks.map((d) => (
          <span key={d} data-lit={d === today} style={{ left: `${((d - 0.5) / days) * 100}%`, ["--dot" as string]: "var(--pf-ink)" }}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Axis top: the next of 1, 1.2, 1.5, 2, 3, 4, 5, 6, 8 × a power of ten. */
function niceTop(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 1.2, 1.5, 2, 3, 4, 5, 6, 8, 10].find((m) => m * p >= v) ?? 10) * p;
}

/** "Monthly budget" with an inline edit: the amount applies from this month
 *  on (budgets carry forward). Works for categories and subcategories. */
function BudgetEditor({ categoryId, budget, currency, now }: { categoryId: string; budget: number | null; currency: string; now: Date }) {
  const { setBudget } = useFinance();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budget !== null ? budget.toFixed(2).replace(".", ",") : "");
  const [error, setError] = useState("");
  // "1.250,00" and "1250.50" both work: with a comma, dots are thousands.
  const raw = value.replace(/\s/g, "");
  const parsed = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  const save = async () => {
    if (!raw || !(parsed >= 0) || !Number.isFinite(parsed)) return setError(t("Enter an amount."));
    try {
      await setBudget(categoryId, new Date(now.getFullYear(), now.getMonth(), 1), parsed);
      setEditing(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="pf-budget-edit">
      <span style={{ flex: 1 }}>
        {t("Monthly budget")}
        <span style={{ display: "block", fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>{t("From {month} on", { month: monthYear(now) })}</span>
      </span>
      {editing ? (
        <>
          <input
            className="pf-input pf-rounded"
            autoFocus
            inputMode="decimal"
            aria-label={t("Monthly budget")}
            placeholder={money(0, currency)}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); save(); }
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditing(false); }
            }}
            style={{ width: 120, textAlign: "right" }}
          />
          <button type="button" className="pf-button pf-button-sm" onClick={save}>{t("Save")}</button>
        </>
      ) : (
        <button type="button" className="pf-link" onClick={() => setEditing(true)}>
          {budget !== null ? <b className="pf-rounded">{money(budget, currency)}</b> : t("Set a budget")}
        </button>
      )}
      {error && <span style={{ flexBasis: "100%", color: "var(--pf-red)", fontSize: "0.75rem" }}>{error}</span>}
    </div>
  );
}
