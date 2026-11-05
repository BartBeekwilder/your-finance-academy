"use client";

import { useMemo } from "react";
import { accountFlows, balanceSheet, expectedByCategory, live, netWorthFigures, num, projectedNetIncome, summarize } from "@/lib/finance/calc";
import { budgetIn } from "@/lib/finance/budgetPlan";
import { freedom, keyMetrics, monthsToPositive } from "@/lib/finance/metrics";
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
    const fixed = expected.reduce((s, e) => s + Math.max(e.fixed, e.usualFix), 0);
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
