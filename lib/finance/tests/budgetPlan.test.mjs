// Next month's budgets. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetIn, budgetPlan, roundBudget, withGoal } from "../budgetPlan.ts";

const cat = (id, extra = {}) => ({ id, name: id, icon: "", color_hex: "888888", is_income_category: false, is_fixed_expense: false, parent_id: null, sort_order: 0, is_default: false, updated_at: "", deleted_at: null, ...extra });
const tx = (cat, amount, date) => ({ id: `${cat}${date}${amount}`, type: "expense", amount: String(amount), date: `${date}T12:00:00Z`, category_id: cat, account_id: null, note: null, is_fixed_expense: false, is_auto_income: false, recurrence_id: null, gross_amount: null, spread_months: null, person_id: null, updated_at: "", deleted_at: null });
const budget = (cat, amount, month) => ({ id: `${cat}${month}`, category_id: cat, amount: String(amount), month: `${month}-01`, updated_at: "", deleted_at: null });

test("friendly amounts and goals", () => {
  assert.equal(roundBudget(83.2), 85);
  assert.equal(roundBudget(326.16), 330);
  assert.equal(roundBudget(1234), 1250);
  assert.equal(withGoal(400, 0.1), 360);
  assert.equal(withGoal(80, 0.05), 76);
  assert.equal(withGoal(60, 0.1), 54);
  assert.equal(withGoal(450, 0.05), 425);
  assert.equal(withGoal(450, 0), 450);
});

test("a budget carries on until changed; 0 ends it", () => {
  const bs = [budget("food", 400, "2026-07"), budget("food", 350, "2026-09"), budget("fun", 0, "2026-09"), budget("fun", 100, "2026-06")];
  assert.equal(budgetIn(bs, "food", new Date(2026, 6, 1)), 400);
  assert.equal(budgetIn(bs, "food", new Date(2026, 7, 1)), 400);
  assert.equal(budgetIn(bs, "food", new Date(2026, 10, 1)), 350);
  assert.equal(budgetIn(bs, "food", new Date(2026, 5, 1)), null);
  assert.equal(budgetIn(bs, "fun", new Date(2026, 8, 1)), null);
});

test("proposal: the carried budget, else the 3-month average; fixed costs left out", () => {
  const data = {
    categories: [cat("food"), cat("fun"), cat("rent", { is_fixed_expense: true })],
    budgets: [budget("food", 400, "2026-01")],
    transactions: [tx("food", 300, "2026-09-05"), tx("fun", 90, "2026-07-10"), tx("fun", 120, "2026-08-10"), tx("fun", 60, "2026-09-10"), tx("rent", 1000, "2026-09-01")],
  };
  const rows = budgetPlan(data, new Date(2026, 8, 1));
  assert.deepEqual(rows.map((r) => [r.category.id, r.current, r.suggested, Math.round(r.average)]), [["food", 400, 400, 100], ["fun", null, 90, 90]]);
});
