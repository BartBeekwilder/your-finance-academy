"use client";

import { useState } from "react";
import CategoryBars from "@/components/finance/CategoryBars";
import { useFinance } from "@/components/finance/FinanceProvider";
import LiveTiles, { type Mode } from "@/components/finance/LiveTiles";
import MonthTransactions from "@/components/finance/MonthTransactions";
import Stat from "@/components/finance/Stat";
import { last12Months, num, projectedNetIncome, summarize, yearForecast } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";

// The Expenses page's counterpart for income, with the same Month / Year
// behaviour: the dashboard's live Income tile (zoom, scrub, forecast),
// headline figures for the period, income per day or month by source, and
// this month's payments — or, in Year view, the last twelve months.

export default function IncomePage() {
  const { data, now } = useFinance();
  const currency = data.profile.currency_code;
  const p = data.profile;
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = summarize(data.transactions, month);
  const [mode, setMode] = useState<Mode>("month");

  const months = last12Months(data.transactions, now).reverse();
  const thisYear = Array.from({ length: now.getMonth() + 1 }, (_, m) => summarize(data.transactions, new Date(now.getFullYear(), m, 1)));
  const receivedYear = thisYear.reduce((t, m) => t + m.income, 0);
  const forecast = yearForecast(data, now);
  const expectedYear = thisYear.slice(0, -1).reduce((t, m) => t + m.income, 0) + forecast.reduce((t, f) => t + f.income, 0);
  const finished = months.slice(1).filter((m) => m.income > 0);
  const average = finished.length ? finished.reduce((t, m) => t + m.income, 0) / finished.length : 0;
  const daysToPayday = p.payday_day ? p.payday_day - now.getDate() : null;

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
        onModeChange={setMode}
      />

      <div key={mode} className="pf-readout" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {mode === "month" ? (
          <>
            <Stat
              label="Received this month"
              value={money(s.income, currency)}
              color="var(--pf-green)"
              progress={forecast[0].income ? { share: s.income / forecast[0].income, of: `${money(forecast[0].income, currency)} expected` } : undefined}
            />
            <Stat
              label="Expected net this month"
              value={money(forecast[0].income, currency)}
              hint={p.expected_gross_monthly ? `Gross ${money(num(p.expected_gross_monthly), currency)}` : undefined}
            />
            <Stat
              label="Payday"
              value={p.payday_day ? `Day ${p.payday_day}` : "—"}
              hint={daysToPayday === null ? undefined : daysToPayday > 0 ? `In ${daysToPayday} day${daysToPayday === 1 ? "" : "s"}` : daysToPayday === 0 ? "Today" : "Passed this month"}
            />
          </>
        ) : (
          <>
            <Stat
              label="Received this year"
              value={money(receivedYear, currency)}
              color="var(--pf-green)"
              progress={expectedYear ? { share: receivedYear / expectedYear, of: `${money(expectedYear, currency)} expected` } : undefined}
            />
            <Stat label="Expected this year" value={money(expectedYear, currency)} hint="Forecast to December" />
            <Stat label="Expected gross / year" value={money(num(p.expected_gross_monthly) * 12, currency)} />
          </>
        )}
        {mode === "month" ? (
          <Stat
            label="Income per day"
            value={money(forecast[0].income / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), currency)}
            color="var(--pf-green)"
            hint={`Net, salary spread over ${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} days`}
          />
        ) : (
          <Stat
            label="Income per day"
            value={money(receivedYear / Math.max(1, Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86_400_000)), currency)}
            color="var(--pf-green)"
            hint="Received this year, per day so far"
          />
        )}
        <Stat label={`Average / month${finished.length ? ` (${finished.length} mo)` : ""}`} value={average ? money(average, currency) : "—"} />
      </div>

      <CategoryBars data={data} now={now} currency={currency} mode={mode} kind="income" />

      {mode === "month" ? (
        <MonthTransactions data={data} month={month} currency={currency} kind="income" />
      ) : (
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
      )}
    </div>
  );
}
