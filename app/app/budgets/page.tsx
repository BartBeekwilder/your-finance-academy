"use client";

import { useCategoryDetail } from "@/components/finance/CategoryDetail";
import BudgetBar from "@/components/finance/BudgetBar";
import CategoryIcon from "@/components/finance/CategoryIcon";
import { useFinance } from "@/components/finance/FinanceProvider";
import { inMonth, live, monthKey, monthProgress, num, selfAndChildren } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";

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

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Budgets</h1>

      <div className="pf-card" style={{ padding: 16, display: "grid", gap: 8 }}>
        <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{monthYear(month)}</div>
        <div className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {money(totalSpent, currency)} <span style={{ fontSize: "1rem", color: "var(--pf-ink-2)" }}>of {money(totalBudget, currency)}</span>
        </div>
        <div className="pf-progress">
          <span style={{ width: `${Math.min(100, (totalSpent / (totalBudget || 1)) * 100)}%`, background: totalSpent > totalBudget ? "var(--pf-red)" : "var(--pf-blue)" }} />
        </div>
      </div>

      <section>
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
    </div>
  );
}
