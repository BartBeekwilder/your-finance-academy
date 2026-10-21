"use client";

import { useState } from "react";
import { useCategoryDetail } from "@/components/finance/CategoryDetail";
import BudgetBar from "@/components/finance/BudgetBar";
import CategoryIcon from "@/components/finance/CategoryIcon";
import { useFinance } from "@/components/finance/FinanceProvider";
import Segmented from "@/components/finance/Segmented";
import { categoryYear, inMonth, live, monthKey, monthProgress, num, selfAndChildren } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";

// Budgets for the month or the year:
//   Month — this month's spending against each monthly limit (fixed costs
//           count as used up to today), with the month's total on top.
//   Year  — the year so far against the year's budget: each month's limit,
//           carried forward over January–December (as in the category
//           sheet). The total gets a "today" tick at the budget used up to
//           now; every category shows its year total and twelve blocks, one
//           per month — green under budget, red over, grey still to come.

export default function BudgetsPage() {
  const { data, now } = useFinance();
  const openCategory = useCategoryDetail();
  const currency = data.profile.currency_code;
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const categories = live(data.categories);
  const budgets = live(data.budgets).filter((b) => b.month.slice(0, 7) === monthKey(month));
  const expenses = live(data.transactions).filter((t) => t.type === "expense" && inMonth(t, month));

  const rows = categories
    .filter((c) => !c.is_income_category && c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => {
      const ids = selfAndChildren(c, categories);
      const spent = expenses.filter((t) => t.category_id && ids.has(t.category_id)).reduce((s, t) => s + num(t.amount), 0);
      const budget = budgets.find((b) => b.category_id === c.id);
      return { c, spent, budget: budget ? num(budget.amount) : null };
    });

  const totalBudget = rows.reduce((s, r) => s + (r.budget ?? 0), 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const [mode, setMode] = useState<"month" | "year">("month");

  // Year view: per category, the twelve months with their (carried) budgets.
  const yearRows = rows.map((r) => {
    const months = categoryYear(data, r.c, now).months;
    const spent = months.filter((m) => !m.future).reduce((t, m) => t + m.total, 0);
    const budget = months.some((m) => m.budget !== null) ? months.reduce((t, m) => t + (m.budget ?? 0), 0) : null;
    return { ...r, months, spent, budget };
  });
  const yearBudget = yearRows.reduce((t, r) => t + (r.budget ?? 0), 0);
  const yearSpent = yearRows.reduce((t, r) => t + r.spent, 0);
  // Budget used up to today: finished months in full, this month pro rata.
  const toDate = yearRows.reduce(
    (t, r) => t + r.months.reduce((u, m, i) => u + (m.budget ?? 0) * (i < now.getMonth() ? 1 : i === now.getMonth() ? monthProgress(now) : 0), 0),
    0,
  );
  const overMonths = yearRows.reduce((t, r) => t + r.months.filter((m) => !m.future && m.budget !== null && m.total > m.budget).length, 0);
  const yearFraction = (now.getMonth() + monthProgress(now)) / 12;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Budgets</h1>

      <div className="pf-card" style={{ padding: 16, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div key={mode} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
            {mode === "month" ? monthYear(month) : `${now.getFullYear()} so far`}
          </div>
          <Segmented label="Period" value={mode} onChange={setMode} options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]} />
        </div>
        {mode === "month" ? (
          <div key="m" className="pf-readout" style={{ display: "grid", gap: 8 }}>
            <div className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
              {money(totalSpent, currency)} <span style={{ fontSize: "1rem", color: "var(--pf-ink-2)" }}>of {money(totalBudget, currency)}</span>
            </div>
            <div className="pf-progress">
              <span style={{ width: `${Math.min(100, (totalSpent / (totalBudget || 1)) * 100)}%`, background: totalSpent > totalBudget ? "var(--pf-red)" : "var(--pf-blue)" }} />
            </div>
          </div>
        ) : (
          <div key="y" className="pf-readout" style={{ display: "grid", gap: 8 }}>
            <div className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
              {money(yearSpent, currency)} <span style={{ fontSize: "1rem", color: "var(--pf-ink-2)" }}>of {money(yearBudget, currency)} this year</span>
            </div>
            <div className="pf-progress" style={{ position: "relative", overflow: "visible" }}>
              <span style={{ width: `${Math.min(100, (yearSpent / (yearBudget || 1)) * 100)}%`, background: yearSpent > toDate ? "var(--pf-red)" : "var(--pf-blue)" }} />
              <i className="pf-progress-tick" style={{ left: `${Math.min(100, (toDate / (yearBudget || 1)) * 100)}%` }} title="Budget used up to today" />
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--pf-ink-2)" }}>
              Budget up to today {money(toDate, currency)} ·{" "}
              <span style={{ color: yearSpent > toDate ? "var(--pf-red)" : "var(--pf-green)", fontWeight: 600 }}>
                {yearSpent > toDate ? `${money(yearSpent - toDate, currency)} over` : `${money(toDate - yearSpent, currency)} under`}
              </span>
              {" · "}
              {overMonths === 0 ? "no month over budget" : `${overMonths} category-month${overMonths === 1 ? "" : "s"} over budget`}
            </div>
          </div>
        )}
      </div>

      {mode === "year" ? (
        <YearList rows={yearRows} currency={currency} yearFraction={yearFraction} openCategory={openCategory} />
      ) : (
      <section key="month" className="pf-readout">
        <h2 className="pf-section-title">Monthly limits</h2>
        <div className="pf-card">
          {rows.map(({ c, spent, budget }) => {
            return (
              <button key={c.id} className="pf-row pf-tap" onClick={(ev) => openCategory(c.id, ev.currentTarget)} style={{ width: "100%" }}>
                <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={32} />
                <div style={{ flex: 1, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{c.name}</span>
                    <span className="pf-rounded" style={{ fontSize: "0.78rem", color: "var(--pf-ink-3)" }}>
                      {budget === null ? "No budget" : `${money(budget, currency)} budget`}
                    </span>
                  </div>
                  {budget !== null ? (
                    <BudgetBar spent={spent} budget={budget} color={`#${c.color_hex}`} currency={currency} monthFraction={monthProgress(now)} fixedMonthStart={c.is_fixed_expense ? month : undefined} />
                  ) : (
                    <span className="pf-rounded" style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>{money(spent, currency)} spent</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>
      )}
    </div>
  );
}

type YearRow = {
  c: ReturnType<typeof live<import("@/lib/finance/types").Category>>[number];
  spent: number;
  budget: number | null;
  months: ReturnType<typeof categoryYear>["months"];
};

/** Year view: each category's year total against its year budget, and a
 *  block per month — green under that month's budget, red over, grey ahead. */
function YearList({
  rows,
  currency,
  yearFraction,
  openCategory,
}: {
  rows: YearRow[];
  currency: string;
  yearFraction: number;
  openCategory: ReturnType<typeof useCategoryDetail>;
}) {
  return (
    <section key="year" className="pf-readout">
      <h2 className="pf-section-title">Year budgets</h2>
      <div className="pf-card">
        {rows.map(({ c, spent, budget, months }) => (
          <button key={c.id} className="pf-row pf-tap" onClick={(ev) => openCategory(c.id, ev.currentTarget)} style={{ width: "100%" }}>
            <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={32} />
            <div style={{ flex: 1, display: "grid", gap: 6, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{c.name}</span>
                <span className="pf-rounded" style={{ fontSize: "0.78rem", color: "var(--pf-ink-3)" }}>
                  {budget === null ? "No budget" : `${money(budget, currency)} for the year`}
                </span>
              </div>
              {budget !== null ? (
                <BudgetBar spent={spent} budget={budget} color={`#${c.color_hex}`} currency={currency} monthFraction={yearFraction} />
              ) : (
                <span className="pf-rounded" style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>{money(spent, currency)} spent</span>
              )}
              <div className="pf-month-blocks">
                {months.map((m, i) => {
                  const state = m.future ? "future" : m.budget === null ? "none" : m.total > m.budget ? "over" : "under";
                  const name = m.month.toLocaleDateString("en-GB", { month: "long" });
                  return (
                    <span
                      key={i}
                      data-state={state}
                      style={{ animationDelay: `${i * 30}ms` }}
                      title={
                        m.future
                          ? `${name}: still to come`
                          : `${name}: ${money(m.total, currency)}${m.budget !== null ? ` of ${money(m.budget, currency)}` : ""}`
                      }
                    >
                      {name[0]}
                    </span>
                  );
                })}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
