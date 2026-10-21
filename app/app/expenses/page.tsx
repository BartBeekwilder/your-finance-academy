"use client";

import { useFinance } from "@/components/finance/FinanceProvider";
import LiveTiles from "@/components/finance/LiveTiles";
import { projectedNetIncome, summarize } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";

// The Income page's counterpart for spending: the dashboard's live Spent
// tile (Month / Year, zoom and scrub), a few headline figures, and the last
// twelve months with their fixed / variable split.

export default function ExpensesPage() {
  const { data, now } = useFinance();
  const currency = data.profile.currency_code;
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = summarize(data.transactions, month);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { month: d, ...summarize(data.transactions, d) };
  });
  // Average over the finished months that have spending.
  const finished = months.slice(1).filter((m) => m.spent > 0);
  const average = finished.length ? finished.reduce((t, m) => t + m.spent, 0) / finished.length : 0;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Expenses</h1>

      <LiveTiles
        only="spent"
        data={data}
        monthStart={month}
        monthlyIncome={projectedNetIncome(data, month)}
        enteredIncome={s.income}
        fixed={s.fixed}
        variable={s.variable}
        currency={currency}
      />

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Stat label="Entered this month" value={money(s.spent, currency)} color="var(--pf-red)" />
        <Stat label="Fixed costs / month" value={money(s.fixed, currency)} />
        <Stat label={`Average / month${finished.length ? ` (${finished.length} mo)` : ""}`} value={average ? money(average, currency) : "—"} />
      </div>

      <section>
        <h2 className="pf-section-title">By month</h2>
        <div className="pf-card">
          {months.map((m, i) => (
            <div key={m.month.toISOString()} className="pf-row">
              <span style={{ flex: 1, display: "grid" }}>
                {monthYear(m.month)}
                {m.spent > 0 && (
                  <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-3)" }}>
                    Fixed {money(m.fixed, currency)} · Variable {money(m.variable, currency)}
                  </span>
                )}
              </span>
              <span className="pf-rounded" style={{ fontWeight: 600, color: m.spent ? "var(--pf-red)" : "var(--pf-ink-3)", textAlign: "right" }}>
                {m.spent ? money(m.spent, currency) : "Nothing spent"}
                {i === 0 && m.spent > 0 && <span style={{ display: "block", fontSize: "0.7rem", fontWeight: 400, color: "var(--pf-ink-3)" }}>so far</span>}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="pf-card" style={{ padding: 16 }}>
      <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{label}</div>
      <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
