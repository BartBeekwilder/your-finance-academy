"use client";

import { t } from "@/lib/i18n";
import Segmented from "@/components/finance/Segmented";
import { useEffect, useState } from "react";
import { setViewedMonth } from "@/lib/finance/viewedMonth";
import CategoryBars from "@/components/finance/CategoryBars";
import GrossNetChart, { grossNetByMonth } from "@/components/finance/GrossNetChart";
import PeopleSplit from "@/components/finance/PeopleSplit";
import { householdOf } from "@/lib/finance/household";
import { PayslipArchive, PayslipButton, PayslipSheet } from "@/components/finance/Payslips";
import type { FinanceDocument } from "@/lib/finance/types";
import { useFinance } from "@/components/finance/FinanceProvider";
import LiveTiles, { type Mode } from "@/components/finance/LiveTiles";
import MonthTransactions from "@/components/finance/MonthTransactions";
import MonthPicker from "@/components/finance/MonthPicker";
import Stat from "@/components/finance/Stat";
import { last12Months, num, projectedNetIncome, summarize, yearForecast } from "@/lib/finance/calc";
import { money, monthYear, monthName as monthLabel } from "@/lib/finance/format";

// The Expenses page's counterpart for income, with the same Month / Year
// behaviour: the dashboard's live Income tile (zoom, scrub, forecast),
// headline figures for the period, income per day or month by source, and
// this month's payments — or, in Year view, the last twelve months. In Month
// view a month picker looks back at an earlier month (as it ended: no
// forecast, no countdown to payday).

export default function IncomePage() {
  const { data, now } = useFinance();
  const currency = data.profile.currency_code;
  const p = data.profile;
  const [mode, setMode] = useState<Mode>("month");
  // Month view: the month looked at — this one, or an earlier one picked.
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [picked, setPicked] = useState(thisMonth);
  const past = mode === "month" && picked < thisMonth;
  // Quick Add starts its date in the month looked at.
  useEffect(() => {
    setViewedMonth(past ? picked : null);
    return () => setViewedMonth(null);
  }, [past, picked]);
  // A finished month is seen from its last moment.
  const at = past ? new Date(picked.getFullYear(), picked.getMonth() + 1, 0, 23, 59, 59) : now;
  const month = past ? picked : thisMonth;
  const monthName = monthLabel(month);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const s = summarize(data.transactions, month);
  // Pickable: from the first month with income up to this one.
  const firstIncome = data.transactions.reduce((m, x) => (x.type === "income" && !x.deleted_at && x.date < m ? x.date : m), thisMonth.toISOString());
  const firstMonth = new Date(new Date(firstIncome).getFullYear(), new Date(firstIncome).getMonth(), 1);
  const incomeMonths = new Set(data.transactions.filter((x) => x.type === "income" && !x.deleted_at).map((x) => x.date.slice(0, 7)));
  // Two or more people: the category chart can become income per person.
  const together = householdOf(data.profile).length > 0;
  const [view, setView] = useState<"together" | "people">("together");
  const [slip, setSlip] = useState<{ doc: FinanceDocument | null; open: boolean; from: Element | null }>({ doc: null, open: false, from: null });

  const months = last12Months(data.transactions, now).reverse();
  const thisYear = Array.from({ length: now.getMonth() + 1 }, (_, m) => summarize(data.transactions, new Date(now.getFullYear(), m, 1)));
  const receivedYear = thisYear.reduce((t, m) => t + m.income, 0);
  const forecast = yearForecast(data, at);
  // The month's expected net (a finished month: its own projection).
  const expectedMonth = past ? projectedNetIncome(data, month) : forecast[0].income;
  const expectedYear = thisYear.slice(0, -1).reduce((t, m) => t + m.income, 0) + forecast.reduce((t, f) => t + f.income, 0);
  const finished = months.slice(1).filter((m) => m.income > 0);
  const average = finished.length ? finished.reduce((t, m) => t + m.income, 0) / finished.length : 0;
  const daysToPayday = p.payday_day && !past ? p.payday_day - now.getDate() : null;
  // Gross vs net: the month looked at, and this year so far.
  const gn = grossNetByMonth(data, now.getFullYear(), now.getMonth());
  const gnMonth = past ? grossNetByMonth(data, month.getFullYear(), month.getMonth())[month.getMonth()] : gn[now.getMonth()];
  const gnYear = gn.reduce((a, b) => ({ gross: a.gross + b.gross, net: a.net + b.net }), { gross: 0, net: 0 });
  const deductionHint = (g: number, n: number) => (g > n ? t("Deductions {amount} ({pct}%)", { amount: money(g - n, currency), pct: Math.round(((g - n) / g) * 100) }) : undefined);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Income")}</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {together && <Segmented label={t("People")} value={view} onChange={setView} options={[{ value: "together", label: t("Together") }, { value: "people", label: t("Per person") }]} />}
          {mode === "month" && (
            <MonthPicker
              value={month}
              onChange={setPicked}
              min={firstMonth}
              max={thisMonth}
              marked={(d) => incomeMonths.has(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)}
            />
          )}
          <Segmented label={t("Period")} value={mode} onChange={setMode} options={[{ value: "month", label: t("Month") }, { value: "year", label: t("Year") }]} />
        </div>
      </header>

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
        mode={mode}
        at={past ? at : undefined}
      />

      <div key={`${mode}${month.getMonth()}`} className="pf-readout" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {mode === "month" ? (
          <>
            <Stat
              label={past ? t("Received in {monthName}", { monthName }) : t("Received this month")}
              value={money(s.income, currency)}
              color="var(--pf-green)"
              progress={expectedMonth ? { share: s.income / expectedMonth, of: t("{amount} expected", { amount: money(expectedMonth, currency) }) } : undefined}
            />
            <Stat
              label={past ? t("Expected net in {monthName}", { monthName }) : t("Expected net this month")}
              value={money(expectedMonth, currency)}
              hint={p.expected_gross_monthly ? t("Gross {amount}", { amount: money(num(p.expected_gross_monthly), currency) }) : undefined}
            />
            {gnMonth && gnMonth.gross > gnMonth.net && <Stat label={past ? t("Gross in {monthName}", { monthName }) : t("Gross this month")} value={money(gnMonth.gross, currency)} color="#bf5af2" hint={deductionHint(gnMonth.gross, gnMonth.net)} />}
            <Stat
              label={t("Payday")}
              value={p.payday_day ? t("Day {n}", { n: p.payday_day }) : "—"}
              hint={daysToPayday === null ? undefined : daysToPayday > 0 ? (daysToPayday === 1 ? t("Tomorrow") : t("In {n} days", { n: daysToPayday })) : daysToPayday === 0 ? t("Today") : t("Passed this month")}
            />
          </>
        ) : (
          <>
            <Stat
              label={t("Received this year")}
              value={money(receivedYear, currency)}
              color="var(--pf-green)"
              progress={expectedYear ? { share: receivedYear / expectedYear, of: t("{amount} expected", { amount: money(expectedYear, currency) }) } : undefined}
            />
            <Stat label={t("Expected this year")} value={money(expectedYear, currency)} hint={t("Forecast to December")} />
            {gnYear.gross > gnYear.net ? (
              <Stat label={t("Gross this year")} value={money(gnYear.gross, currency)} color="#bf5af2" hint={deductionHint(gnYear.gross, gnYear.net)} />
            ) : (
              <Stat label={t("Expected gross / year")} value={money(num(p.expected_gross_monthly) * 12, currency)} />
            )}
          </>
        )}
        {mode === "month" ? (
          <Stat
            label={t("Income per day")}
            value={money(expectedMonth / daysInMonth, currency)}
            color="var(--pf-green)"
            hint={t("Net, salary spread over {v1} days", { v1: daysInMonth })}
          />
        ) : (
          <Stat
            label={t("Income per day")}
            value={money(receivedYear / Math.max(1, Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86_400_000)), currency)}
            color="var(--pf-green)"
            hint={t("Received this year, per day so far")}
          />
        )}
        <Stat label={finished.length ? t("Average / month ({n} mo)", { n: finished.length }) : t("Average / month")} value={average ? money(average, currency) : "—"} />
      </div>

      <GrossNetChart data={data} now={mode === "month" ? at : now} currency={currency} mode={mode} />

      {together && view === "people" ? (
        <PeopleSplit data={data} now={at} currency={currency} kind="income" mode={mode} />
      ) : (
        <CategoryBars key={month.getTime()} data={data} now={at} currency={currency} mode={mode} kind="income" past={past} />
      )}

      {mode === "month" ? (
        <MonthTransactions data={data} month={month} currency={currency} kind="income" />
      ) : (
        <section>
          <h2 className="pf-section-title">{t("By month")}</h2>
          <div className="pf-card">
            {months.map((m) => (
              <div key={m.month.toISOString()} className="pf-row">
                <span style={{ flex: 1 }}>{monthYear(m.month)}</span>
                <PayslipButton month={m.month} onOpen={(doc, from) => setSlip({ doc, open: true, from })} />
                <span className="pf-rounded" style={{ fontWeight: 600, color: m.income ? "var(--pf-green)" : "var(--pf-ink-3)" }}>
                  {m.income ? money(m.income, currency) : t("Not yet received")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <PayslipArchive onOpen={(doc, from) => setSlip({ doc, open: true, from })} />
      <PayslipSheet doc={slip.doc} open={slip.open} origin={slip.from} onClose={() => setSlip((x) => ({ ...x, open: false }))} />
    </div>
  );
}
