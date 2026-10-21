"use client";

import { useFinance } from "@/components/finance/FinanceProvider";
import LiveTiles from "@/components/finance/LiveTiles";
import { last12Months, num, projectedNetIncome, summarize } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";

export default function IncomePage() {
  const { data, now } = useFinance();
  const currency = data.profile.currency_code;
  const p = data.profile;
  const months = last12Months(data.transactions, now).reverse();
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = summarize(data.transactions, month);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Income</h1>

      {/* The dashboard's live Income tile: Month / Year, zoom and scrub. */}
      <LiveTiles
        only="income"
        data={data}
        monthStart={month}
        monthlyIncome={projectedNetIncome(data, month)}
        enteredIncome={s.income}
        fixed={s.fixed}
        variable={s.variable}
        currency={currency}
      />

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Stat label="Expected gross / month" value={money(num(p.expected_gross_monthly), currency)} />
        <Stat label="Expected net / month" value={money(num(p.expected_net_monthly), currency)} color="var(--pf-green)" />
        <Stat label="Payday" value={p.payday_day ? `Day ${p.payday_day}` : "—"} />
      </div>

      <section>
        <h2 className="pf-section-title">By month</h2>
        <div className="pf-card">
          {months.map((m) => (
            <div key={m.month.toISOString()} className="pf-row">
              <span style={{ flex: 1 }}>{monthYear(m.month)}</span>
              <span className="pf-rounded" style={{ fontWeight: 600, color: m.income ? "var(--pf-green)" : "var(--pf-ink-3)" }}>
                {m.income ? money(m.income, currency) : "Not yet received"}
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
