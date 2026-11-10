// Year Wrapped. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextYearGoals, yearWrapped } from "../yearWrapped.ts";

const month = (income, spent, fixed = 0) => ({ income, spent, fixed, variable: spent - fixed });
const months = [
  month(4000, 3000, 1500), month(4000, 3500, 1500), month(4000, 2000, 1500), month(4000, 4500, 1500),
  ...Array.from({ length: 8 }, () => month(0, 0)),
];
const exp = (amount, m, d, fixed = false, note = null) => ({ amount, date: new Date(2026, m, d, 12), note, category_id: "c", fixed });
const input = {
  year: 2026,
  months,
  lastYear: Array.from({ length: 12 }, () => month(1000, 900)),
  expenses: [exp(1500, 0, 1, true, "Mortgage"), exp(80, 0, 3), exp(20, 0, 3), exp(600, 1, 10, false, "Laptop"), exp(50, 2, 5)],
  categories: [{ id: "food", spent: 3000 }, { id: "fun", spent: 1000 }],
  equityByMonth: [10_500, 11_000, 13_000, 12_500, ...Array(8).fill(12_500)],
  equityStart: 10_000,
  investments: { start: 5000, end: 5500 },
  closes: 4,
  badges: 2,
};
const now = new Date(2027, 0, 5);

test("year totals, savings rate and last year", () => {
  const w = yearWrapped(input, now);
  assert.equal(w.income, 16000);
  assert.equal(w.spent, 13000);
  assert.equal(w.saved, 3000);
  assert.equal(w.savingsRate, 3000 / 16000);
  assert.equal(w.lastYear.saved, 1200);
});

test("best and toughest month only among months with data", () => {
  const w = yearWrapped(input, now);
  assert.equal(w.best.i, 2); // March: +2000
  assert.equal(w.toughest.i, 3); // April: −500
  assert.equal(w.plusMonths, 3);
  assert.equal(w.activeMonths, 4);
});

test("biggest expense and most expensive day skip fixed costs", () => {
  const w = yearWrapped(input, now);
  assert.equal(w.biggest.note, "Laptop");
  assert.equal(w.facts.topDay.amount, 600);
  assert.equal(w.facts.expenses, 5);
  // 365 days, 3 with variable spending.
  assert.equal(w.facts.noSpend, 362);
});

test("days without spending stop at today in a running year", () => {
  const w = yearWrapped(input, new Date(2026, 0, 10));
  assert.equal(w.facts.noSpend, 10 - 1);
});

test("equity and investments over the year", () => {
  const w = yearWrapped(input, now);
  assert.equal(w.equityChange, 2500);
  assert.equal(w.investments.change, 500);
  assert.ok(Math.abs(w.investments.share - 0.1) < 1e-9);
  assert.equal(yearWrapped({ ...input, investments: { start: 0, end: 0 } }, now).investments, null);
});

test("top categories carry their share of variable spending", () => {
  const w = yearWrapped(input, now);
  assert.equal(w.top[0].id, "food");
  assert.equal(w.top[0].share, 3000 / 7000);
});

test("next year's goals: same, +10%, +20%, rounded", () => {
  assert.deepEqual(nextYearGoals(3000), [3000, 3300, 3600]);
  assert.deepEqual(nextYearGoals(12_340), [12_500, 13_500, 15_000]);
  assert.deepEqual(nextYearGoals(-50), []);
});
