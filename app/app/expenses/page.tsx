"use client";

import SpendCube from "@/components/finance/SpendCube";
import { FileText } from "lucide-react";
import Link from "next/link";
import { FillMonth, monthFromUrl } from "@/components/finance/EarlierMonths";
import { isEmptyMonth } from "@/lib/finance/estimate";
import { intlLocale, t } from "@/lib/i18n";
import Segmented from "@/components/finance/Segmented";
import CategoryBars from "@/components/finance/CategoryBars";
import { useFinance } from "@/components/finance/FinanceProvider";
import { useEffect, useState } from "react";
import { setViewedMonth } from "@/lib/finance/viewedMonth";
import { X } from "lucide-react";
import CategoryIcon from "@/components/finance/CategoryIcon";
import CategoryTiles from "@/components/finance/CategoryTiles";
import { MonthCompare, YearCompare } from "@/components/finance/Compare";
import PeopleSplit from "@/components/finance/PeopleSplit";
import { householdOf } from "@/lib/finance/household";
import { scopeToCategory } from "@/lib/finance/scope";
import LiveTiles, { type Mode } from "@/components/finance/LiveTiles";
import MonthTransactions from "@/components/finance/MonthTransactions";
import MonthPicker from "@/components/finance/MonthPicker";
import YearPicker from "@/components/finance/YearPicker";
import { firstExpenseYear, pastYear as pastYearOf } from "@/lib/finance/pastYear";
import Stat, { ExpectedBar } from "@/components/finance/Stat";
import { liveFixed, projectedNetIncome, summarize, yearForecast } from "@/lib/finance/calc";
import { budgetTotals } from "@/lib/finance/progressModel";
import { money, monthYear, monthName as monthLabel } from "@/lib/finance/format";
import ReadWithAI from "@/components/finance/ReadWithAI";
import FixedCosts, { fixedCostsOf } from "@/components/finance/FixedCosts";
import SpendingMix from "@/components/finance/SpendingMix";
import type { FinanceData } from "@/lib/finance/types";

// The Income page's counterpart for spending: the dashboard's live Spent
// tile (Month / Year, zoom and scrub), a few headline figures, and the last
// twelve months with their fixed / variable split — or, in Month view, the
// month's expenses day by day. In Month view a month picker looks back at an
// earlier month: the tiles, figures, chart and list follow it (a finished
// month is shown as it ended, without a forecast).

export default function ExpensesPage() {
  const { data: all, now } = useFinance();
  // A category tile narrows the whole page to that category (and stacks its
  // charts by subcategory); null = everything.
  const [scope, setScope] = useState<string | null>(null);
  const data = scope ? scopeToCategory(all, scope) : all;
  const scopeCat = scope ? all.categories.find((c) => c.id === scope) : undefined;
  const scopeName = scopeCat?.name;
  const hasSubs = !!scope && all.categories.some((c) => c.parent_id === scope && !c.deleted_at);
  const accent = scopeCat ? `#${scopeCat.color_hex}` : "var(--pf-red)";
  const currency = data.profile.currency_code;
  // The stats follow the tile's Month / Year toggle.
  const [mode, setMode] = useState<Mode>("month");
  // Month view: the month looked at — this one, or an earlier one picked.
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [picked, setPicked] = useState(thisMonth);
  // ?month=YYYY-MM (from "Confirm your months") opens that month.
  useEffect(() => {
    const m = monthFromUrl(thisMonth);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the address
    if (m < thisMonth) setPicked(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const past = mode === "month" && picked < thisMonth;
  // Year view: this year, or an earlier one picked (Bart, 24 Nov) — shown from
  // its bookings and imported year totals (pastYear).
  const [pickedYear, setPickedYear] = useState(now.getFullYear());
  const earlier = mode === "year" && pickedYear < now.getFullYear() ? pastYearOf(all, pickedYear) : null;
  // Quick Add starts its date in the month looked at.
  useEffect(() => {
    setViewedMonth(past ? picked : null);
    return () => setViewedMonth(null);
  }, [past, picked]);
  // A finished month is seen from its last moment.
  const at = past ? new Date(picked.getFullYear(), picked.getMonth() + 1, 0, 23, 59, 59) : now;
  const month = past ? picked : thisMonth;
  const s = summarize(data.transactions, month);
  // The month's fixed costs: paid, booked for later and still to come.
  const fixedMonth = fixedCostsOf(data, month, at);
  // Pickable: from the first month with spending up to this one.
  const firstSpend = all.transactions.reduce((m, x) => (x.type === "expense" && x.date < m ? x.date : m), thisMonth.toISOString());
  // …and always back to January, so earlier months can be filled in.
  const firstMonth = new Date(Math.min(new Date(new Date(firstSpend).getFullYear(), new Date(firstSpend).getMonth(), 1).getTime(), new Date(now.getFullYear(), 0, 1).getTime()));
  const spentMonths = new Set(all.transactions.filter((x) => x.type === "expense").map((x) => x.date.slice(0, 7)));
  const together = householdOf(all.profile).length > 0;
  const [view, setView] = useState<"together" | "people">("together");
  const thisYear = Array.from({ length: now.getMonth() + 1 }, (_, m) => summarize(data.transactions, new Date(now.getFullYear(), m, 1)));
  const yearSpent = thisYear.reduce((t, m) => t + m.spent, 0);
  const yearFixed = thisYear.reduce((t, m) => t + m.fixed, 0);
  // Finished months as entered, plus the forecast for this month and the rest.
  const forecast = yearForecast(data, at);
  // The budgeted part of the forecast (same rule as Budgets and the budget ring).
  const budgetNow = budgetTotals(data, new Date(at.getFullYear(), at.getMonth(), 1), at);
  const expectedYear = thisYear.slice(0, -1).reduce((t, m) => t + m.spent, 0) + forecast.reduce((t, f) => t + f.spent, 0);
  const monthName = monthLabel(month);

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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {together && <Segmented label={t("People")} value={view} onChange={setView} options={[{ value: "together", label: t("Together") }, { value: "people", label: t("Who paid") }]} />}
          {mode === "month" && (
            <MonthPicker
              value={month}
              onChange={setPicked}
              min={firstMonth}
              max={thisMonth}
              marked={(d) => spentMonths.has(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)}
            />
          )}
          {mode === "year" && <YearPicker value={pickedYear} onChange={setPickedYear} min={firstExpenseYear(all, now)} max={now.getFullYear()} />}
          <Segmented label={t("Period")} value={mode} onChange={setMode} options={[{ value: "month", label: t("Month") }, { value: "year", label: t("Year") }]} />
          <ReadWithAI kind="bank" />
          <Link href={`/app/report?month=${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`} className="pf-chip" title={t("Monthly report")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", textDecoration: "none" }}>
            <FileText size={15} /> PDF
          </Link>
        </div>
      </header>

      {past && isEmptyMonth(all, picked) && <FillMonth key={picked.getTime()} month={picked} />}

      {earlier ? (
        <PastYearView key={pickedYear} year={pickedYear} past={earlier} data={all} currency={currency} />
      ) : (
      <>
      <CategoryTiles data={all} now={at} mode={mode} currency={currency} selected={scope} onSelect={setScope} />

      <div
        key={scope ?? "all"}
        className="pf-scope-in"
        data-scoped={!!scopeCat}
        style={{ display: "grid", gap: 24, ...(scopeCat ? { ["--scope" as string]: `#${scopeCat.color_hex}` } : {}) }}
      >
      {/* Narrowed to a category: say so above everything it affects, and
          keep saying it while scrolling. */}
      {scopeCat && (
        <div className="pf-scope-bar" role="status">
          <CategoryIcon icon={scopeCat.icon} colorHex={scopeCat.color_hex} size={28} />
          <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
            <b>{scopeCat.name}</b>
            <span>{t("Everything below is about this category only")}</span>
          </span>
          <button type="button" className="pf-chip pf-scope-clear" onClick={() => setScope(null)}>
            <X size={14} /> {t("Show all")}
          </button>
        </div>
      )}
      <LiveTiles
        scopeName={scopeName}
        only="spent"
        data={data}
        monthStart={month}
        monthlyIncome={projectedNetIncome(data, month)}
        enteredIncome={s.income}
        fixed={past ? s.fixed : liveFixed(data, now)}
        variable={s.variable}
        currency={currency}
        mode={mode}
        at={past ? at : undefined}
      />

      <div key={`${mode}${month.getMonth()}`} className="pf-readout" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {mode === "month" ? (
          <>
            {past ? (
              <Stat
                label={t("Spent in {monthName}", { monthName })}
                value={money(s.spent, currency)}
                color="var(--pf-red)"
                progress={average ? { share: s.spent / average, of: t("{amount} on average", { amount: money(average, currency) }) } : undefined}
              />
            ) : (
              <Stat
                label={t("Entered this month")}
                value={money(s.spent, currency)}
                color="var(--pf-red)"
                progress={forecast[0].spent ? { share: s.spent / forecast[0].spent, of: t("{amount} expected", { amount: money(forecast[0].spent, currency) }) } : undefined}
              />
            )}
            <Stat
              label={t("Fixed costs / month")}
              value={money(fixedMonth.total, currency)}
              hint={fixedMonth.toCome > 0.005 ? t("{paid} paid · {left} still to come", { paid: money(fixedMonth.paid, currency), left: money(fixedMonth.toCome, currency) }) : undefined}
            />
          </>
        ) : (
          <>
            <Stat
              label={t("Entered this year")}
              value={money(yearSpent, currency)}
              color="var(--pf-red)"
              progress={expectedYear ? { share: yearSpent / expectedYear, of: t("{amount} expected", { amount: money(expectedYear, currency) }) } : undefined}
            />
            <Stat label={t("Fixed costs this year")} value={money(yearFixed, currency)} />
          </>
        )}
        {past ? (
          <Stat label={t("Variable costs")} value={money(s.variable, currency)} />
        ) : mode === "month" ? (
          <Stat label={t("Expected this month")} value={money(forecast[0].spent, currency)} hint={`${t("Forecast to the end of {monthName}", { monthName })} · ${t("all spending, budgets {expected} of {budget}", { expected: money(budgetNow.forecast, currency), budget: money(budgetNow.budget, currency) })}`} side={<ExpectedBar done={s.spent} expected={forecast[0].spent} color={accent} />} />
        ) : (
          <Stat label={t("Expected this year")} value={money(expectedYear, currency)} hint={t("Forecast to December")} side={<ExpectedBar done={yearSpent} expected={expectedYear} color={accent} />} />
        )}
        <Stat label={finished.length ? t("Average / month ({n} mo)", { n: finished.length }) : t("Average / month")} value={average ? money(average, currency) : "—"} />
      </div>

      {mode === "month" && <FixedCosts data={data} month={month} now={at} currency={currency} />}

      {/* Narrowed to a category without subcategories, the per-day chart
          only repeats the tile above — leave it out. */}
      {together && view === "people" ? (
        <PeopleSplit data={data} now={at} currency={currency} kind="expense" mode={mode} />
      ) : (
        !(scopeCat && !hasSubs) && <CategoryBars key={month.getTime()} data={data} now={at} currency={currency} mode={mode} scopeName={scopeName} past={past} />
      )}

      {/* The categories added up over the period, as on Investments. */}
      {!(scopeCat && !hasSubs) && <SpendingMix key={`mix${mode}${month.getTime()}`} data={data} now={at} mode={mode} currency={currency} />}

      {/* The period's spending as one cube (Bart, 28 Nov). */}
      {!scope && <SpendCube data={all} now={at} mode={mode} currency={currency} />}

      <section style={{ display: "grid", gap: 12 }}>
        <h2 className="pf-section-title">{t("Compare")}</h2>
        <YearCompare key={scope ?? "all"} data={all} now={now} currency={currency} initial={scope} />
        <MonthCompare data={all} now={now} currency={currency} />
      </section>

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
                    {t("Fixed {fixed} · Variable {variable}", { fixed: money(m.fixed, currency), variable: money(m.variable, currency) })}
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
      </>
      )}
    </div>
  );
}

/** Expenses › Year › an earlier year: the categories, the year's figures and
 *  its months (bookings plus imported year totals). */
function PastYearView({ year, past, data, currency }: { year: number; past: ReturnType<typeof pastYearOf>; data: FinanceData; currency: string }) {
  const [scope, setScope] = useState<string | null>(null);
  const shown = scope ? past.rows.find((r) => r.category.id === scope)?.spent ?? 0 : past.total;
  const imported = (data.yearCategoryTotals ?? []).some((r) => r.year === year);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <CategoryTiles data={data} now={new Date(year, 11, 31, 23, 59, 59)} mode="year" currency={currency} selected={scope} onSelect={setScope} past={past} />
      <div className="pf-readout" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Stat label={t("Spent in {monthName}", { monthName: String(year) })} value={money(shown, currency)} hint={imported ? t("Imported history: a year's total, spread evenly over the months that have no transactions.") : undefined} />
        <Stat label={t("Average / month")} value={money(shown / 12, currency)} />
      </div>
      {!scope && (
        <section>
          <h2 className="pf-section-title">{t("By month")}</h2>
          <div className="pf-card">
            {past.months.map((v, m) => (
              <div key={m} className="pf-row">
                <span style={{ flex: 1 }}>{monthYear(new Date(year, m, 1))}</span>
                <span className="pf-rounded" style={{ fontWeight: 600, color: v ? "var(--pf-red)" : "var(--pf-ink-3)", textAlign: "right" }}>{v ? money(v, currency) : t("Nothing spent")}</span>
              </div>
            )).reverse()}
          </div>
        </section>
      )}
    </div>
  );
}
