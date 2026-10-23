"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import BudgetBar from "@/components/finance/BudgetBar";
import BudgetScaleSwitch from "@/components/finance/BudgetScaleSwitch";
import { useBudgetCompare, useBudgetLargestFirst } from "@/lib/prefs";
import { useFlip } from "@/lib/useFlip";
import CategoryIcon from "@/components/finance/CategoryIcon";
import { useCategoryDetail } from "@/components/finance/CategoryDetail";
import { CategoryDonut } from "@/components/finance/charts";
import { useFinance } from "@/components/finance/FinanceProvider";
import LiveTiles from "@/components/finance/LiveTiles";
import NetWorthCard from "@/components/finance/NetWorthCard";
import BalanceCard from "@/components/finance/BalanceCard";
import ProgressStrip from "@/components/finance/ProgressStrip";
import SavingsChart from "@/components/finance/SavingsChart";
import SortableCategoryGrid from "@/components/finance/SortableCategoryGrid";
import YearLines from "@/components/finance/YearLines";
import { yearForecast, last12Months, monthProgress, netWorthFigures, projectedNetIncome, spendByCategory, spendByCategoryYear, summarize, yearsWithData } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";

export default function DashboardPage() {
  const { data, now } = useFinance();
  const openCategory = useCategoryDetail();
  const currency = data.profile.currency_code;
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = summarize(data.transactions, month);
  const byCategory = spendByCategory(data, month);
  const compareBudgets = useBudgetCompare();
  const maxBudget = Math.max(1, ...byCategory.map((e) => e.budget ?? 0));
  const largestFirst = useBudgetLargestFirst();
  const budgetsRef = useRef<HTMLDivElement>(null);
  useFlip(budgetsRef, largestFirst);
  const history = last12Months(data.transactions, now);

  // Net worth: accounts + holdings at cost on 1 January plus this year's
  // savings (netWorthFigures — the Net worth page's model, same as iOS).
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

      <NetWorthCard base={netWorthFigures(data, now).base} monthlyPace={pace} monthDelta={s.balance} yearDelta={yearDelta} currency={currency} />
      <ProgressStrip />

      <BalanceCard data={data} now={now} />

      {/* Tiles left; year lines + donut stacked right, stretched to equal height. */}
      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "stretch" }}>
        <LiveTiles
          data={data}
          monthStart={month}
          monthlyIncome={projectedNetIncome(data, month)}
          enteredIncome={s.income}
          fixed={s.fixed}
          variable={s.variable}
          currency={currency}
        />
        <div style={{ display: "grid", gap: 12, gridTemplateRows: "auto 1fr" }}>
          <YearLines data={data} now={now} currency={currency} monthlyIncome={projectedNetIncome(data, month)} />
          <CategoryDonut
            months={Array.from({ length: now.getMonth() + 1 }, (_, m) => spendByCategory(data, new Date(now.getFullYear(), m, 1)))}
            years={yearsWithData(data, now).map((year) => ({ year, slices: spendByCategoryYear(data, year) }))}
            currency={currency}
            now={now}
          />
        </div>
      </section>

      {byCategory.length > 0 && (
        <section>
          <h2 className="pf-section-title">
            {t("Spending by Category")} <span style={{ textTransform: "none", color: "var(--pf-ink-3)" }}>{t("· drag to rearrange")}</span>
          </h2>
          {/* In the user's own order (sort_order), not by amount, so rearranging sticks. */}
          <SortableCategoryGrid categories={byCategory.map((e) => e.category).sort((a, b) => a.sort_order - b.sort_order)} />
        </section>
      )}

      <section>
        <h2 className="pf-section-title">{t("Savings")}</h2>
        <SavingsChart transactions={data.transactions} now={now} monthlyIncome={projectedNetIncome(data, month)} currency={currency} forecast={yearForecast(data, now)} />
      </section>

      <section>
        <h2 className="pf-section-title">{t("Budgets")} — {monthYear(month)}</h2>
        <div className="pf-card" ref={budgetsRef}>
          <BudgetScaleSwitch />
          {byCategory.length === 0 && <div className="pf-row" style={{ color: "var(--pf-ink-2)" }}>{t("No spending yet this month.")}</div>}
          {(largestFirst
            ? [...byCategory].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))
            : [...byCategory].sort((a, b) => a.category.sort_order - b.category.sort_order)
          ).map((e) => (
            <button key={e.category.id} data-flip-key={e.category.id} className="pf-row pf-tap" onClick={(ev) => openCategory(e.category.id, ev.currentTarget)} style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: "6px 12px", width: "100%" }}>
              <CategoryIcon icon={e.category.icon} colorHex={e.category.color_hex} size={30} />
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.92rem" }}>
                  <span>{e.category.name}</span>
                  {e.budget !== null && <span className="pf-rounded" style={{ fontSize: "0.78rem", color: "var(--pf-ink-3)" }}>{money(e.budget, currency)} budget</span>}
                </div>
                {e.budget !== null ? (
                  <BudgetBar spent={e.spent} budget={e.budget} color={`#${e.category.color_hex}`} currency={currency} monthFraction={monthProgress(now)} fixedMonthStart={e.category.is_fixed_expense ? month : undefined} scaleMax={compareBudgets ? maxBudget : undefined} />
                ) : (
                  <span className="pf-rounded" style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>{money(e.spent, currency)} spent · no budget</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Live date and clock: re-renders each second, and the colon blinks in step with
 *  the real second (its animation is offset by the current millisecond). */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Start on the next whole second so the minute flips exactly on time.
    let interval: ReturnType<typeof setInterval>;
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 1000);
    }, 1000 - (Date.now() % 1000));
    return () => {
      clearTimeout(align);
      clearInterval(interval);
    };
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  // Date first, then time — e.g. "Thu 15 Oct 2026 · 20:14".
  const date = now.toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(",", "");
  return (
    <time className="pf-rounded pf-clock" dateTime={now.toISOString()} aria-label={`${date}, ${hh}:${mm}`}>
      {date}
      <span style={{ margin: "0 0.45em", opacity: 0.5 }}>·</span>
      {hh}
      <span className="pf-clock-colon" style={{ animationDelay: `-${now.getMilliseconds()}ms` }} aria-hidden>
        :
      </span>
      {mm}
    </time>
  );
}
