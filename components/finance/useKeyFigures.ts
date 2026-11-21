"use client";

import { useMemo } from "react";
import { accountFlows, balanceSheet, expectedByCategory, live, netWorthFigures, num, projectedNetIncome, summarize } from "@/lib/finance/calc";
import { budgetIn } from "@/lib/finance/budgetPlan";
import { freedom, keyMetrics, monthsToPositive } from "@/lib/finance/metrics";
import { valueAt } from "@/lib/finance/wrapped";
import type { FinanceData } from "@/lib/finance/types";
import { useFinance } from "./FinanceProvider";

// The key figures from the books as they are now: this month's expected
// income and spending (the same "expected" rule as the Budgets page),
// accounts and investments (at market value when prices are in), and the
// balance sheet. Used by the Key figures page and the dashboard strip.

export function useKeyFigures() {
  const { data, now } = useFinance();
  return useMemo(() => {
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const income = projectedNetIncome(data, month) || Number(data.profile.expected_net_monthly) || 0;
    const expected = [...expectedByCategory(data, month, now).values()];
    const fixed = expected.reduce((s, e) => s + e.fixedMonth, 0);
    const spending = Math.max(expected.reduce((s, e) => s + e.expected, 0), summarize(data.transactions, month).spent);
    const nw = netWorthFigures(data, now);
    // Accounts as they stand TODAY (the 1 January balance + this year's
    // flows, as on Liquidity) — not the 1 January balance alone. Runway counts
    // the money you can spend (no investment accounts); freedom counts all.
    const flows = accountFlows(data, now);
    const accountsNow = live(data.accounts).map((a) => ({ type: a.type, value: num(a.balance) + (flows.get(a.id) ?? 0) }));
    const cash = accountsNow.filter((a) => a.type !== "investment").reduce((s, a) => s + a.value, 0);
    const allAccounts = accountsNow.reduce((s, a) => s + a.value, 0);
    const sheet = balanceSheet(data, now, month);
    // Budgets still free this month: the variable budgets minus what's
    // been spent in those categories so far.
    const cats = live(data.categories).filter((c) => !c.parent_id && !c.is_income_category && !c.is_fixed_expense);
    const budgetTotal = cats.reduce((s, c) => s + (budgetIn(live(data.budgets), c.id, month) ?? 0), 0);
    const variableSpent = summarize(data.transactions, month).variable;
    const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysIn - now.getDate() + 1;
    const input = {
      income, fixed, spending,
      cash, investments: nw.holdingsTotal,
      assets: sheet.totalAssets, debts: sheet.totalDebt,
      freeThisMonth: budgetTotal > 0 ? budgetTotal - variableSpent : null, daysLeft,
      runwayGoal: data.profile.runway_goal,
      growth: growthThisYear(data, now),
    };
    const left = income - spending;
    return {
      input,
      left,
      equity: sheet.equity,
      metrics: keyMetrics(input),
      freedom: freedom(spending, allAccounts + input.investments, left),
      toPositive: monthsToPositive(sheet.equity, left),
      // Saved per second this month (income and spending spread evenly).
      perSecond: left / (daysIn * 86_400),
    };
  }, [data, now]);
}

/** This year so far: kept from income (income − spending, booked by now)
 *  plus debt paid off — that's "work" — and the investments' market gain
 *  (value now against 1 January, or against the price paid when bought this
 *  year). The home's value change counts as neither. */
function growthThisYear(data: FinanceData, now: Date) {
  const y0 = new Date(now.getFullYear(), 0, 1);
  let kept = 0;
  for (const x of live(data.transactions)) {
    const d = new Date(x.date);
    if (d < y0 || d > now || x.advance) continue;
    kept += (x.type === "income" ? 1 : -1) * num(x.amount);
  }
  // Debt at the end of last year against now (mortgage and loans follow their schedules).
  const debtThen = balanceSheet(data, now, new Date(now.getFullYear() - 1, 11, 1)).totalDebt;
  const debtNow = balanceSheet(data, now, new Date(now.getFullYear(), now.getMonth(), 1)).totalDebt;
  const paidOff = Math.max(debtThen - debtNow, 0);
  let gain = 0, priced = false;
  for (const h of live(data.holdings)) {
    const end = valueAt(data, h, now.getTime());
    if (end == null) continue;
    const added = new Date(h.date_added);
    const start = added < y0 ? valueAt(data, h, y0.getTime()) : h.cost_basis != null ? num(h.cost_basis) : valueAt(data, h, added.getTime());
    if (start == null) continue;
    gain += end - start;
    priced = true;
  }
  if (!priced && Math.abs(kept + paidOff) < 0.005) return null;
  return { work: kept + paidOff, investments: gain };
}
