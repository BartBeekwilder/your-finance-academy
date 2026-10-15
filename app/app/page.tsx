"use client";

import CategoryIcon from "@/components/finance/CategoryIcon";
import { useCategoryDetail } from "@/components/finance/CategoryDetail";
import { CategoryDonut, IncomeExpenseBars, TrendLine } from "@/components/finance/charts";
import { useFinance } from "@/components/finance/FinanceProvider";
import LiveTiles from "@/components/finance/LiveTiles";
import NetWorthCard from "@/components/finance/NetWorthCard";
import { investedIn, last12Months, live, num, projectedNetIncome, spendByCategory, summarize } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";

export default function DashboardPage() {
  const { data, now } = useFinance();
  const openCategory = useCategoryDetail();
  const currency = data.profile.currency_code;
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = summarize(data.transactions, month);
  const byCategory = spendByCategory(data, month);
  const history = last12Months(data.transactions, now);

  // Net worth = accounts + holdings at cost (live prices arrive with sync).
  const accounts = live(data.accounts).reduce((sum, a) => sum + num(a.balance), 0);
  const holdings = investedIn(data.holdings, currency).total;
  const complete = history.slice(0, -1).filter((p) => p.income || p.expense);
  const pace = complete.length ? complete.reduce((t, p) => t + p.income - p.expense, 0) / complete.length : 0;
  const yearDelta = history
    .filter((p) => p.month.getFullYear() === now.getFullYear())
    .reduce((t, p) => t + p.income - p.expense, 0);

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.1rem)", fontWeight: 700 }}>Dashboard - {monthYear(month)}</h1>
        <Clock />
      </header>

      <NetWorthCard base={accounts + holdings} monthlyPace={pace} monthDelta={s.balance} yearDelta={yearDelta} currency={currency} />

      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "center" }}>
        <LiveTiles
          monthStart={month}
          monthlyIncome={projectedNetIncome(data, month)}
          enteredIncome={s.income}
          fixed={s.fixed}
          variable={s.variable}
          currency={currency}
        />
        <CategoryDonut entries={byCategory} currency={currency} />
      </section>

      {byCategory.length > 0 && (
        <section>
          <h2 className="pf-section-title">Spending by Category</h2>
          <div className="pf-grid-auto">
            {byCategory.map((e) => {
              const pct = e.budget ? Math.min(1, e.spent / e.budget) : 0;
              const color = `#${e.category.color_hex}`;
              return (
                <button key={e.category.id} className="pf-card pf-bouncy pf-tap" onClick={() => openCategory(e.category.id)} style={{ padding: 14, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CategoryIcon icon={e.category.icon} colorHex={e.category.color_hex} size={28} />
                    <strong style={{ fontSize: "0.95rem" }}>{e.category.name}</strong>
                    <span className="pf-rounded" style={{ marginLeft: "auto", fontWeight: 700 }}>{money(e.spent, currency)}</span>
                  </div>
                  <CategorySparkBars data={data} categoryId={e.category.id} color={color} now={now} />
                  {e.budget !== null && (
                    <div style={{ fontSize: "0.7rem", color: e.isOverBudget ? "var(--pf-red)" : "var(--pf-ink-2)" }}>
                      {Math.round(pct * 100)}% of {money(e.budget, currency)} budget
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="pf-section-title">Income vs Expenses</h2>
        <div className="pf-card" style={{ padding: 16, display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", marginBottom: 4 }}>By Month</div>
            <IncomeExpenseBars points={history} currency={currency} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", marginBottom: 24 }}>12-Month Trend</div>
            <TrendLine points={history} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="pf-section-title">Budgets — {monthYear(month)}</h2>
        <div className="pf-card">
          {byCategory.length === 0 && <div className="pf-row" style={{ color: "var(--pf-ink-2)" }}>No spending yet this month.</div>}
          {byCategory.map((e) => (
            <button key={e.category.id} className="pf-row pf-tap" onClick={() => openCategory(e.category.id)} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", width: "100%" }}>
              <CategoryIcon icon={e.category.icon} colorHex={e.category.color_hex} size={30} />
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.92rem" }}>
                  <span>{e.category.name}</span>
                  <span className="pf-rounded" style={{ color: e.isOverBudget ? "var(--pf-red)" : "var(--pf-ink-2)" }}>
                    {money(e.spent, currency)}{e.budget !== null && ` / ${money(e.budget, currency)}`}
                  </span>
                </div>
                {e.budget !== null && (
                  <div className="pf-progress">
                    <span style={{ width: `${Math.min(100, (e.spent / e.budget) * 100)}%`, background: e.isOverBudget ? "var(--pf-red)" : `#${e.category.color_hex}` }} />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function CategorySparkBars({ data, categoryId, color, now }: {
  data: ReturnType<typeof useFinance>["data"]; categoryId: string; color: string; now: Date;
}) {
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (5 - i), 1));
  const values = months.map((m) =>
    live(data.transactions)
      .filter((t) => t.category_id === categoryId && t.type === "expense")
      .filter((t) => { const d = new Date(t.date); return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth(); })
      .reduce((s, t) => s + num(t.amount), 0),
  );
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 44 }} aria-hidden>
      {values.map((v, i) => (
        <span key={i} style={{ flex: 1, height: `${Math.max(4, (v / max) * 100)}%`, background: color, opacity: i === values.length - 1 ? 1 : 0.45, borderRadius: 3 }} />
      ))}
    </div>
  );
}

function Clock() {
  const { now } = useFinance();
  return (
    <span className="pf-rounded" style={{ fontSize: "1.1rem", color: "var(--pf-ink-2)" }}>
      {now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}
