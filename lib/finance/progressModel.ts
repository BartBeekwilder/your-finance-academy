import { balanceSheet, budgetIn, expectedByCategory, live, monthProgress, netWorthFigures, num, projectedNetIncome, spendByCategory, summarize, yearForecast } from "./calc";
import { ownership, summarize as summarizePart } from "./mortgage";
import { BADGES, POINTS, goalProgress, level, rings, ringsClosed, streak, type BadgeContext } from "./progress";
import { homes } from "./realEstate";
import { checkinDays, trackedDays } from "./checkin";
import type { FinanceData, Goal, MonthClose } from "./types";

// Everything the progress screens need, from the data: this month's rings,
// points and level, the streak, goals with where they stand, which month
// can be closed, and the context the badges are checked against.

/** Savings target per month when there's no goal: 20% of net income. */
export const SAVINGS_SHARE = 0.2;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

/** Every category with a budget in `month`, with what was spent (none yet
 *  counts too: an untouched budget is on track). With `fraction` (this
 *  month, the share gone by) also the month-end forecast: fixed costs as
 *  booked, variable spending so far plus the rest of the month at the
 *  category's usual pace (its average over the three months before; with no
 *  history, the budget's own pace). */
function budgetRows(data: FinanceData, month: Date, fraction?: number) {
  const spent = new Map(spendByCategory(data, month).map((e) => [e.category.id, e]));
  const before = fraction === undefined ? [] : [1, 2, 3].map((k) => spendByCategory(data, new Date(month.getFullYear(), month.getMonth() - k, 1))).filter((m) => m.length > 0);
  const usual = (id: string) => {
    if (!before.length) return null;
    const v = before.map((m) => { const e = m.find((x) => x.category.id === id); return e ? e.spent - e.fixed : 0; });
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  return live(data.categories)
    .filter((c) => !c.is_income_category && c.parent_id === null)
    .map((c) => ({ c, budget: budgetIn(live(data.budgets), c.id, month), e: spent.get(c.id) }))
    .filter((x) => x.budget !== null)
    .map(({ c, budget, e }) => {
      const s = e?.spent ?? 0, fx = e?.fixed ?? 0, b = budget ?? 0;
      const row = { spent: s, budget: b, fixed: c.is_fixed_expense, fixedSpent: fx };
      if (fraction === undefined || c.is_fixed_expense) return row;
      const pace = usual(c.id) ?? Math.max(b - fx, 0);
      return { ...row, forecast: s + pace * Math.max(1 - fraction, 0) };
    });
}

/** All budgets together for `month` (the budget ring's month goal): the
 *  total budget of every budgeted category and what they're expected to end
 *  the month at — the shared rule (calc expectedByCategory), so the ring,
 *  the Budgets page and Expenses agree. Also the parts the calendar needs:
 *  the usual variable spending and the month's fixed costs. */
export function budgetTotals(data: FinanceData, month: Date, now: Date) {
  const exp = expectedByCategory(data, month, now);
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const ids = new Set<string>();
  let budget = 0, forecast = 0, spentTotal = 0, usualVar = 0, fixedExpected = 0;
  for (const c of live(data.categories).filter((c) => !c.is_income_category && c.parent_id === null)) {
    const b = budgetIn(live(data.budgets), c.id, month);
    if (b === null) continue;
    for (const id of [c.id, ...live(data.categories).filter((x) => x.parent_id === c.id).map((x) => x.id)]) ids.add(id);
    const e = exp.get(c.id) ?? { spent: 0, fixed: 0, usualVar: 0, usualFix: 0, expected: 0 };
    budget += b;
    spentTotal += e.spent;
    forecast += e.expected;
    usualVar += e.usualVar;
    fixedExpected += isCurrent ? Math.max(e.fixed, e.usualFix) : e.fixed;
  }
  return { budget, forecast, spent: spentTotal, usualVar, fixedExpected, ids };
}

/** Days kept up: app used, or covered by a check-in (lib/finance/checkin). */
export function activeDays(data: FinanceData) {
  return trackedDays(live(data.activityDays ?? []).map((a) => a.day), checkinDays(live(data.achievements ?? [])));
}

/** A finished month's rings (in full). */
export function monthRings(data: FinanceData, month: Date) {
  const s = summarize(data.transactions, month);
  const activity = activeDays(data).filter((d) => d.slice(0, 7) === iso(month).slice(0, 7)).length;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return rings({
    daysElapsed: days,
    activeDaysInMonth: activity,
    budgets: budgetRows(data, month),
    fraction: 1,
    saved: s.income - s.spent,
    budgetTotal: (() => { const t = budgetTotals(data, month, new Date(month.getFullYear(), month.getMonth() + 1, 1)); return { forecast: t.forecast, budget: t.budget }; })(),
    savingsTarget: projectedNetIncome(data, month) * SAVINGS_SHARE,
  });
}

/** A month's snapshot for closing it (a finished month: in full). */
export function monthSummary(data: FinanceData, month: Date, now: Date): MonthClose["summary"] {
  const s = summarize(data.transactions, month);
  const saved = s.income - s.spent;
  const savingsRate = s.income > 0 ? saved / s.income : 0;
  const budgets = spendByCategory(data, month).filter((e) => e.budget !== null);
  const allBudgetsKept = budgets.length > 0 && budgets.every((e) => e.spent <= (e.budget ?? 0) + 0.005);
  const r = monthRings(data, month);
  return { income: s.income, spent: s.spent, saved, savingsRate, equity: balanceSheet(data, now, month).equity, allBudgetsKept, rings: ringsClosed(r) };
}


export function progressModel(data: FinanceData, now: Date) {
  const activity = activeDays(data);
  const closes = live(data.monthCloses ?? []).sort((a, b) => a.month.localeCompare(b.month));
  const achievements = live(data.achievements ?? []);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const fraction = monthProgress(now);
  const nw = netWorthFigures(data, now);

  // This month's rings, live. Saving is a month goal: what the forecast
  // expects to be saved by the end of the month against 20% of the month's
  // expected income (not today's pace, which swings early in the month).
  const fc = yearForecast(data, now)[0];
  const budgetNow = budgetTotals(data, month, now);
  const ringNow = rings({
    daysElapsed: now.getDate(),
    activeDaysInMonth: activity.filter((d) => d.slice(0, 7) === iso(month).slice(0, 7)).length,
    budgets: budgetRows(data, month, fraction),
    // A month goal for all budgets together: the month-end forecast.
    budgetTotal: { forecast: budgetNow.forecast, budget: budgetNow.budget },
    fraction,
    saved: fc ? fc.income - fc.spent : nw.liveChange(now.getTime()),
    savingsTarget: (fc ? fc.income : projectedNetIncome(data, month)) * SAVINGS_SHARE,
    savedIsForecast: !!fc,
  });

  const days = streak(activity, now);
  const points = closes.reduce((t, c) => t + c.points, 0) + achievements.reduce((t, a) => t + a.points, 0) + activity.length * POINTS.activeDay;

  // The month to close: only the last finished month (December in January),
  // while it isn't closed yet — older months don't nag.
  const closed = new Set(closes.map((c) => c.month.slice(0, 7)));
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const closable: Date | null = closed.has(iso(lastMonth).slice(0, 7)) ? null : lastMonth;

  // Balance and real estate, for goals and badges.
  const sheet = balanceSheet(data, now, month);
  const otherDebt = sheet.liabilities.filter((l) => !l.id.startsWith("mortgage-") && l.id !== "advance").reduce((t, l) => t + l.value, 0);
  const first = homes(data)[0];
  const debt = first ? first.parts.reduce((t, p) => t + summarizePart(p, now).balance, 0) : 0;
  const share = first ? ownership(num(first.property.value), debt) : 0;

  const goals = live(data.goals ?? []).sort((a, b) => a.sort_order - b.sort_order).map((g) => goalState(g, data, now, sheet.equity, otherDebt));

  const context: BadgeContext = {
    closes: closes.length,
    closed: closes.map((c) => ({ saved: c.summary.saved, savingsRate: c.summary.savingsRate, allBudgetsKept: c.summary.allBudgetsKept })),
    streak: days,
    savedTotal: closes.reduce((t, c) => t + Math.max(c.summary.saved, 0), 0),
    equity: sheet.equity,
    goals: goals.length,
    goalsAchieved: goals.filter((g) => g.share >= 1).length,
    balancePosts: live(data.balanceItems ?? []).length,
    properties: homes(data).length,
    ownership: share,
    otherDebt,
    payslips: (data.documents ?? []).filter((d) => d.kind === "payslip" && d.month).map((d) => ({ month: d.month!.slice(0, 7), added: d.added_at.slice(0, 7) })),
  };
  const have = new Set(achievements.map((a) => a.code));
  const earnable = BADGES.filter((b) => !have.has(b.code) && b.earned(context));

  return { rings: ringNow, budgetTotal: budgetNow, savingRate: fc && fc.income > 0 ? (fc.income - fc.spent) / fc.income : 0, streak: days, points, level: level(points), closable, closes, achievements, have, earnable, goals, context, activeToday: activity.includes(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`) };
}

export type GoalState = ReturnType<typeof goalState>;

/** A goal's current value, share done and estimated date. */
function goalState(g: Goal, data: FinanceData, now: Date, equity: number, otherDebt: number) {
  const since = g.created_at ? new Date(g.created_at) : new Date(now.getFullYear(), 0, 1);
  const start = num(g.start_value), target = num(g.target);
  let current = start;
  if (g.kind === "save") {
    // Already saved when created + net savings since.
    current = start + live(data.transactions).filter((t) => new Date(t.date) >= since).reduce((s, t) => s + (t.type === "income" ? num(t.amount) : -num(t.amount)), 0);
  } else if (g.kind === "equity") {
    current = equity;
  } else if (g.kind === "debt") {
    current = otherDebt;
  } else {
    // Category limit: months in a row (finished, since the goal) under it; 3 = done.
    let run = 0;
    for (let d = new Date(since.getFullYear(), since.getMonth(), 1); d < new Date(now.getFullYear(), now.getMonth(), 1); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const spent = g.category_id ? (spendByCategory(data, d).find((e) => e.category.id === g.category_id)?.spent ?? 0) : 0;
      run = spent <= target ? run + 1 : 0;
    }
    return { goal: g, current: run, target: 3, share: Math.min(run / 3, 1), eta: null as Date | null };
  }
  const p = goalProgress(start, current, target, since, now);
  return { goal: g, current, target, share: p.share, eta: p.eta };
}
