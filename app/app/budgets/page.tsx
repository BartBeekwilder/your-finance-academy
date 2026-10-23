"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useRef, useState } from "react";
import { useFlip } from "@/lib/useFlip";
import { useCategoryDetail } from "@/components/finance/CategoryDetail";
import BudgetBar from "@/components/finance/BudgetBar";
import BudgetScaleSwitch from "@/components/finance/BudgetScaleSwitch";
import { useBudgetCompare, useBudgetLargestFirst } from "@/lib/prefs";
import CategoryIcon from "@/components/finance/CategoryIcon";
import { useFinance } from "@/components/finance/FinanceProvider";
import Segmented from "@/components/finance/Segmented";
import StepSlider from "@/components/finance/StepSlider";
import { CategoryDonut } from "@/components/finance/charts";
import BudgetDonut from "@/components/finance/BudgetDonut";
import { categoryYear, inMonth, live, monthProgress, num, selfAndChildren, spendByCategory, spendByCategoryYear, yearsWithData } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";

// Budgets for the month or the year:
//   Month — a month's spending against each monthly limit (fixed costs
//           count as used up to today in the current month), the total on
//           top; a slider picks the month (January … now). The pie chart
//           beside it follows the same month (or the year).
//   Year  — the year so far against the year's budget: each month's limit,
//           carried forward over January–December (as in the category
//           sheet). The total gets a "today" tick at the budget used up to
//           now; every category shows its year total and twelve blocks, one
//           per month — green under budget, red over, grey still to come.

export default function BudgetsPage() {
  const { data, now } = useFinance();
  const openCategory = useCategoryDetail();
  const currency = data.profile.currency_code;
  // The month shown (this year, up to now); budgets carry forward as in the
  // category sheet.
  const [sel, setSel] = useState(now.getMonth());
  const isCurrent = sel === now.getMonth();
  // Months still to come show a forecast: each category's average over this
  // year's finished months (fixed costs land on their usual amount).
  const isFuture = sel > now.getMonth();
  const month = new Date(now.getFullYear(), sel, 1);
  const categories = live(data.categories);
  const expenses = live(data.transactions).filter((t) => t.type === "expense" && inMonth(t, month));

  const rows = categories
    .filter((c) => !c.is_income_category && c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => {
      const ids = selfAndChildren(c, categories);
      const spent = expenses.filter((t) => t.category_id && ids.has(t.category_id)).reduce((s, t) => s + num(t.amount), 0);
      const cy = categoryYear(data, c, now).months;
      const done = cy.slice(0, now.getMonth()).map((m) => m.total);
      const expected = done.length ? done.reduce((a, b) => a + b, 0) / done.length : cy[now.getMonth()].total;
      // What the month is expected to end at: as spent (finished months),
      // spent or the usual average, whichever is higher (this month), or the
      // average (months ahead).
      const monthEnd = isFuture ? expected : isCurrent ? Math.max(spent, expected) : spent;
      return { c, spent: isFuture ? expected : spent, budget: cy[sel].budget, expected: monthEnd };
    });
  const monthPace = isCurrent ? monthProgress(now) : 1;
  // The pie chart: the budget filled in to what's expected (default), or what
  // was really spent.
  const [pieView, setPieView] = useState<"budget" | "spent">("budget");
  const pieSwitch = (
    <Segmented
      size="sm"
      label={t("Pie chart")}
      value={pieView}
      onChange={setPieView}
      options={[{ value: "budget", label: t("Budget") }, { value: "spent", label: t("Real spend") }]}
    />
  );

  const totalBudget = rows.reduce((s, r) => s + (r.budget ?? 0), 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const [mode, setMode] = useState<"month" | "year">("month");
  const compare = useBudgetCompare();
  const maxBudget = Math.max(1, ...rows.map((r) => r.budget ?? 0));
  const largestFirst = useBudgetLargestFirst();
  const limitsRef = useRef<HTMLDivElement>(null);
  useFlip(limitsRef, largestFirst);

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
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Budgets")}</h1>

      {/* The total (with the month slider) and the pie chart, side by side. */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", alignItems: "stretch" }}>
<div className="pf-card" style={{ padding: 16, display: "grid", gap: 8, alignContent: "space-evenly" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          {/* The period shown, as the card's heading. */}
          <div key={`${mode}-${sel}`} className="pf-readout" style={{ fontSize: "1.15rem", fontWeight: 650, color: "var(--pf-ink)" }}>
            {mode === "month" ? monthYear(month) : now.getFullYear()}
            <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--pf-ink-3)" }}>
              {mode === "month" ? (isFuture ? " · forecast" : isCurrent ? " · so far" : " · finished") : " · so far"}
            </span>
          </div>
          <Segmented label={t("Period")} value={mode} onChange={setMode} options={[{ value: "month", label: t("Month") }, { value: "year", label: t("Year") }]} />
        </div>
        {mode === "month" ? (
          <div key="m" className="pf-readout" style={{ display: "grid", gap: 8 }}>
            <div className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
              {money(totalSpent, currency)} <span style={{ fontSize: "1rem", color: "var(--pf-ink-2)" }}>of {money(totalBudget, currency)}</span>
            </div>
            {/* The total budget, same bar as each category: over it spills out. */}
            <BudgetBar spent={totalSpent} budget={totalBudget} color="#30d158" heat forecast={isFuture} currency={currency} monthFraction={isFuture ? undefined : monthPace} />
            <StepSlider
              label={t("Month")}
              animKey="budget-months"
              value={sel}
              steps={Array.from({ length: 12 }, (_, i) => {
                const d = new Date(now.getFullYear(), i, 1);
                const name = d.toLocaleDateString(intlLocale(), { month: "long" });
                return { label: name.slice(0, 3), short: name[0], full: `${name} ${now.getFullYear()}${i > now.getMonth() ? " · forecast" : ""}`, faint: i > now.getMonth() };
              })}
              onChange={setSel}
            />
          </div>
        ) : (
          <div key="y" className="pf-readout" style={{ display: "grid", gap: 8 }}>
            <div className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
              {money(yearSpent, currency)} <span style={{ fontSize: "1rem", color: "var(--pf-ink-2)" }}>of {money(yearBudget, currency)} this year</span>
            </div>
            {/* The year's budget; the pace tick marks the budget used up to today. */}
            <BudgetBar spent={yearSpent} budget={yearBudget} color="#30d158" heat currency={currency} monthFraction={yearBudget ? toDate / yearBudget : 0} />
            <div style={{ fontSize: "0.78rem", color: "var(--pf-ink-2)" }}>
              Budget up to today {money(toDate, currency)} ·{" "}
              <span style={{ color: yearSpent > toDate ? "var(--pf-red)" : "var(--pf-green)", fontWeight: 600 }}>
                {yearSpent > toDate ? `${money(yearSpent - toDate, currency)} over` : `${money(toDate - yearSpent, currency)} under`}
              </span>
              {" · "}
              {overMonths === 0 ? t("no month over budget") : overMonths === 1 ? t("1 category-month over budget") : t("{n} category-months over budget", { n: overMonths })}
            </div>
          </div>
        )}
      </div>
      {pieView === "budget" && mode === "month" ? (
        <BudgetDonut
          items={rows.filter((r) => r.budget !== null).map((r) => ({ category: r.c, budget: r.budget ?? 0, expected: r.expected }))}
          currency={currency}
          title={t("Budget for {v1}", { v1: month.toLocaleDateString(intlLocale(), { month: "long" }) })}
          caption={isFuture || isCurrent ? t("Expected") : t("Spent")}
          headerRight={pieSwitch}
        />
      ) : (
      <CategoryDonut
        headerRight={mode === "month" ? pieSwitch : undefined}
        months={[
          ...Array.from({ length: now.getMonth() + 1 }, (_, m) => spendByCategory(data, new Date(now.getFullYear(), m, 1))),
          // Months ahead: the same forecast as the list.
          ...Array.from({ length: 11 - now.getMonth() }, () => (isFuture ? rows : []).filter((r) => r.spent > 0).map((r) => ({ category: r.c, spent: r.spent }))),
        ]}
        years={yearsWithData(data, now).map((year) => ({ year, slices: spendByCategoryYear(data, year) }))}
        currency={currency}
        now={now}
        control={{ mode, monthIndex: sel, forecast: isFuture }}
      />
      )}
      </div>

      {mode === "year" ? (
        <YearList rows={yearRows} currency={currency} yearFraction={yearFraction} openCategory={openCategory} />
      ) : (
      <section key="month" className="pf-readout">
        <h2 className="pf-section-title">Monthly limits — {monthYear(month)}{isFuture && " · forecast"}</h2>
        <div className="pf-card" ref={limitsRef}>
          <BudgetScaleSwitch />
          {(largestFirst ? [...rows].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)) : rows).map(({ c, spent, budget }) => {
            return (
              <button key={c.id} data-flip-key={c.id} className="pf-row pf-tap" onClick={(ev) => openCategory(c.id, ev.currentTarget)} style={{ width: "100%" }}>
                <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={32} />
                <div style={{ flex: 1, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{c.name}</span>
                    <span className="pf-rounded" style={{ fontSize: "0.78rem", color: "var(--pf-ink-3)" }}>
                      {budget === null ? t("No budget") : `${money(budget, currency)} budget`}
                    </span>
                  </div>
                  {budget !== null ? (
                    <BudgetBar spent={spent} budget={budget} color={`#${c.color_hex}`} currency={currency} monthFraction={isFuture ? undefined : monthPace} fixedMonthStart={c.is_fixed_expense && !isFuture ? month : undefined} forecast={isFuture} scaleMax={compare ? maxBudget : undefined} />
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
  const compare = useBudgetCompare();
  const maxBudget = Math.max(1, ...rows.map((r) => r.budget ?? 0));
  const largestFirst = useBudgetLargestFirst();
  const yearRef = useRef<HTMLDivElement>(null);
  useFlip(yearRef, largestFirst);
  return (
    <section key="year" className="pf-readout">
      <h2 className="pf-section-title">{t("Year budgets")}</h2>
      <div className="pf-card" ref={yearRef}>
        <BudgetScaleSwitch />
        {(largestFirst ? [...rows].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)) : rows).map(({ c, spent, budget, months }) => (
          <button key={c.id} data-flip-key={c.id} className="pf-row pf-tap" onClick={(ev) => openCategory(c.id, ev.currentTarget)} style={{ width: "100%" }}>
            <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={32} />
            <div style={{ flex: 1, display: "grid", gap: 6, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{c.name}</span>
                <span className="pf-rounded" style={{ fontSize: "0.78rem", color: "var(--pf-ink-3)" }}>
                  {budget === null ? t("No budget") : t("{v1} for the year", { v1: money(budget, currency) })}
                </span>
              </div>
              {budget !== null ? (
                <BudgetBar spent={spent} budget={budget} color={`#${c.color_hex}`} currency={currency} monthFraction={yearFraction} scaleMax={compare ? maxBudget : undefined} />
              ) : (
                <span className="pf-rounded" style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>{money(spent, currency)} spent</span>
              )}
              <div className="pf-month-blocks">
                {months.map((m, i) => {
                  const state = m.future ? "future" : m.budget === null ? "none" : m.total > m.budget ? "over" : "under";
                  const name = m.month.toLocaleDateString(intlLocale(), { month: "long" });
                  return (
                    <span
                      key={i}
                      data-state={state}
                      style={{ animationDelay: `${i * 30}ms` }}
                      title={
                        m.future
                          ? t("{name}: still to come", { name })
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
