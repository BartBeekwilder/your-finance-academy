// Progress rules. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { level, streak, rings, newBadges, goalProgress } from "../progress.ts";

const days = (from, n, skip = []) => Array.from({ length: n }, (_, i) => i).filter((i) => !skip.includes(i)).map((i) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});
const today = new Date(2026, 9, 23);

test("levels: thresholds and progress", () => {
  assert.equal(level(0).name, "Starter");
  assert.equal(level(499).name, "Starter");
  assert.equal(level(500).name, "Bookkeeper");
  assert.equal(level(1000).toNext, 500);
  assert.equal(level(20000).name, "Investor");
  assert.equal(level(20000).progress, 1);
});

test("streak counts consecutive days", () => {
  assert.equal(streak(days(today, 10), today), 10);
});

test("streak survives one missed day per week", () => {
  assert.equal(streak(days(today, 14, [5]), today), 13);
});

test("two missed days in a week end the streak", () => {
  assert.equal(streak(days(today, 14, [3, 6]), today), 5); // days 0–2 and 4–5
});

test("today not yet active still counts yesterday's run", () => {
  assert.equal(streak(days(new Date(2026, 9, 22), 5), today), 5);
});

test("rings", () => {
  const r = rings({ daysElapsed: 10, activeDaysInMonth: 10, budgets: [{ spent: 100, budget: 400, fixed: false }, { spent: 500, budget: 400, fixed: false }], fraction: 0.5, saved: 600, savingsTarget: 1000 });
  assert.equal(r.tracking, 1);
  assert.equal(r.budget, 0.5);
  assert.ok(Math.abs(r.saving - 1.2) < 1e-9);
});

test("badges are earned once", () => {
  const c = { closes: 1, closed: [{ saved: 500, savingsRate: 0.25, allBudgetsKept: true }], streak: 8, savedTotal: 1500, equity: 5000, goals: 0, goalsAchieved: 0, balancePosts: 0, properties: 0, ownership: 0, otherDebt: 0 };
  const codes = newBadges(c, new Set()).map((b) => b.code);
  for (const code of ["first-close", "streak-7", "saved-1k", "equity-positive", "rate-20", "budget-month"]) assert.ok(codes.includes(code), code);
  assert.ok(!newBadges(c, new Set(["first-close"])).some((b) => b.code === "first-close"));
});

test("goal progress and estimated date", () => {
  const g = goalProgress(0, 2500, 5000, new Date(2026, 6, 23), today);
  assert.ok(Math.abs(g.share - 0.5) < 1e-9);
  assert.ok(g.eta && g.eta > today);
});

test("no budgets: the budget ring stays empty", () => {
  const r = rings({ daysElapsed: 30, activeDaysInMonth: 30, budgets: [], fraction: 1, saved: 0, savingsTarget: 100 });
  assert.equal(r.budget, 0);
});
