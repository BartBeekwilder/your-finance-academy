import { balanceSheet, live, monthProgress, netWorthFigures, num, projectedNetIncome, spendByCategory, summarize } from "./calc";
import { ownership, summarize as summarizePart } from "./mortgage";
import { BADGES, POINTS, goalProgress, level, rings, ringsClosed, streak, type BadgeContext } from "./progress";
import { homes } from "./realEstate";
import type { FinanceData, Goal, MonthClose } from "./types";

// Everything the progress screens need, from the data: this month's rings,
// points and level, the streak, goals with where they stand, which month
// can be closed, and the context the badges are checked against.

/** Savings target per month when there's no goal: 20% of net income. */
export const SAVINGS_SHARE = 0.2;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

/** A finished month's rings (in full). */
export function monthRings(data: FinanceData, month: Date) {
  const s = summarize(data.transactions, month);
  const budgets = spendByCategory(data, month).filter((e) => e.budget !== null);
  const activity = live(data.activityDays ?? []).filter((a) => a.day.slice(0, 7) === iso(month).slice(0, 7)).length;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return rings({
    daysElapsed: days,
    activeDaysInMonth: activity,
    budgets: budgets.map((e) => ({ spent: e.spent, budget: e.budget ?? 0, fixed: e.category.is_fixed_expense })),
    fraction: 1,
    saved: s.income - s.spent,
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
  const activity = live(data.activityDays ?? []).map((a) => a.day.slice(0, 10));
  const closes = live(data.monthCloses ?? []).sort((a, b) => a.month.localeCompare(b.month));
  const achievements = live(data.achievements ?? []);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const fraction = monthProgress(now);
  const nw = netWorthFigures(data, now);

  // This month's rings, live.
  const budgets = spendByCategory(data, month).filter((e) => e.budget !== null);
  const ringNow = rings({
    daysElapsed: now.getDate(),
    activeDaysInMonth: activity.filter((d) => d.slice(0, 7) === iso(month).slice(0, 7)).length,
    budgets: budgets.map((e) => ({ spent: e.spent, budget: e.budget ?? 0, fixed: e.category.is_fixed_expense })),
    fraction,
    saved: nw.liveChange(now.getTime()),
    savingsTarget: projectedNetIncome(data, month) * SAVINGS_SHARE,
  });

  const days = streak(activity, now);
  const points = closes.reduce((t, c) => t + c.points, 0) + achievements.reduce((t, a) => t + a.points, 0) + activity.length * POINTS.activeDay;

  // The month to close: the latest finished month of this year not closed yet.
  const closed = new Set(closes.map((c) => c.month.slice(0, 7)));
  let closable: Date | null = null;
  for (let m = now.getMonth() - 1; m >= 0; m--) {
    const d = new Date(now.getFullYear(), m, 1);
    if (!closed.has(iso(d).slice(0, 7))) {
      closable = d;
      break;
    }
  }

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
  };
  const have = new Set(achievements.map((a) => a.code));
  const earnable = BADGES.filter((b) => !have.has(b.code) && b.earned(context));

  return { rings: ringNow, streak: days, points, level: level(points), closable, closes, achievements, have, earnable, goals, context, activeToday: activity.includes(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`) };
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
