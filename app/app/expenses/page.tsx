"use client";

import { intlLocale, t } from "@/lib/i18n";
import Segmented from "@/components/finance/Segmented";
import CategoryBars from "@/components/finance/CategoryBars";
import { useFinance } from "@/components/finance/FinanceProvider";
import { useState } from "react";
import LiveTiles, { type Mode } from "@/components/finance/LiveTiles";
import MonthTransactions from "@/components/finance/MonthTransactions";
import Stat from "@/components/finance/Stat";
import { projectedNetIncome, summarize, yearForecast } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";

// The Income page's counterpart for spending: the dashboard's live Spent
// tile (Month / Year, zoom and scrub), a few headline figures, and the last
// twelve months with their fixed / variable split — or, in Month view, this
// month's expenses day by day.

export default function ExpensesPage() {
  const { data, now } = useFinance();
  const currency = data.profile.currency_code;
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = summarize(data.transactions, month);
  // The stats follow the tile's Month / Year toggle.
  const [mode, setMode] = useState<Mode>("month");
  const thisYear = Array.from({ length: now.getMonth() + 1 }, (_, m) => summarize(data.transactions, new Date(now.getFullYear(), m, 1)));
  const yearSpent = thisYear.reduce((t, m) => t + m.spent, 0);
  const yearFixed = thisYear.reduce((t, m) => t + m.fixed, 0);
  // Finished months as entered, plus the forecast for this month and the rest.
  const forecast = yearForecast(data, now);
  const expectedYear = thisYear.slice(0, -1).reduce((t, m) => t + m.spent, 0) + forecast.reduce((t, f) => t + f.spent, 0);
  const monthName = month.toLocaleDateString(intlLocale(), { month: "long" });

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { month: d, ...summarize(data.transactions, d) };
  });
  // Average over the finished months that have spending.
  const finished = months.slice(1).filter((m) => m.spent > 0);
  const average = finished.length ? finished.reduce((t, m) => t + m.spent, 0) / finished.length : 0;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Expenses")}</h1>
        <Segmented label={t("Period")} value={mode} onChange={setMode} options={[{ value: "month", label: t("Month") }, { value: "year", label: t("Year") }]} />
      </header>

      <LiveTiles
        only="spent"
        data={data}
        monthStart={month}
        monthlyIncome={projectedNetIncome(data, month)}
        enteredIncome={s.income}
        fixed={s.fixed}
        variable={s.variable}
        currency={currency}
        mode={mode}
      />

      <div key={mode} className="pf-readout" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {mode === "month" ? (
          <>
            <Stat
              label={t("Entered this month")}
              value={money(s.spent, currency)}
              color="var(--pf-red)"
              progress={forecast[0].spent ? { share: s.spent / forecast[0].spent, of: `${money(forecast[0].spent, currency)} expected` } : undefined}
            />
            <Stat label={t("Fixed costs / month")} value={money(s.fixed, currency)} />
          </>
        ) : (
          <>
            <Stat
              label={t("Entered this year")}
              value={money(yearSpent, currency)}
              color="var(--pf-red)"
              progress={expectedYear ? { share: yearSpent / expectedYear, of: `${money(expectedYear, currency)} expected` } : undefined}
            />
            <Stat label={t("Fixed costs this year")} value={money(yearFixed, currency)} />
          </>
        )}
        {mode === "month" ? (
          <Stat label={t("Expected this month")} value={money(forecast[0].spent, currency)} hint={t("Forecast to the end of {monthName}", { monthName })} />
        ) : (
          <Stat label={t("Expected this year")} value={money(expectedYear, currency)} hint={t("Forecast to December")} />
        )}
        <Stat label={`Average / month${finished.length ? ` (${finished.length} mo)` : ""}`} value={average ? money(average, currency) : "—"} />
      </div>

      <CategoryBars data={data} now={now} currency={currency} mode={mode} />

      {mode === "month" ? (
        <MonthTransactions data={data} month={month} currency={currency} kind="expense" />
      ) : (
      <section>
        <h2 className="pf-section-title">{t("By month")}</h2>
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
                {m.spent ? money(m.spent, currency) : t("Nothing spent")}
                {i === 0 && m.spent > 0 && <span style={{ display: "block", fontSize: "0.7rem", fontWeight: 400, color: "var(--pf-ink-3)" }}>{t("so far")}</span>}
              </span>
            </div>
          ))}
        </div>
      </section>
      )}
    </div>
  );
}
