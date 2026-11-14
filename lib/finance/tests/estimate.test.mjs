// Estimates for earlier, empty months. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyMonthsSince, estimateMonth, estimatedMonths, isEmptyMonth } from "../estimate.ts";

const now = new Date(2026, 10, 14, 12);
const tx = (o) => ({ id: o.id ?? Math.random().toString(36), type: "expense", amount: "10.00", date: new Date(2026, 10, 3, 12).toISOString(), note: null, is_auto_income: false, is_fixed_expense: false, recurrence_id: null, category_id: null, account_id: "acc", updated_at: "", deleted_at: null, ...o });
const cat = (o) => ({ id: o.id, name: o.id, icon: "", color_hex: "000000", is_income_category: false, is_fixed_expense: false, parent_id: null, deleted_at: null, ...o });
const data = (o = {}) => ({
  profile: { currency_code: "EUR", expected_net_monthly: "3800.00", expected_gross_monthly: "5200.00", payday_day: 25 },
  accounts: [{ id: "acc", is_default: true, deleted_at: null }],
  categories: [cat({ id: "salary", is_income_category: true }), cat({ id: "housing", is_fixed_expense: true }), cat({ id: "groceries" }), cat({ id: "fun" })],
  budgets: [{ id: "b1", category_id: "groceries", amount: "450.00", month: "2026-11-01", deleted_at: null }],
  transactions: [
    tx({ amount: "1250.00", date: new Date(2026, 10, 1, 12).toISOString(), is_fixed_expense: true, recurrence_id: "rent", category_id: "housing", note: "Rent" }),
    tx({ amount: "12.99", date: new Date(2026, 10, 30, 12).toISOString(), is_fixed_expense: true, recurrence_id: "netflix", category_id: "housing", note: "Netflix" }),
    tx({ amount: "240.00", date: new Date(2026, 10, 9, 12).toISOString(), is_fixed_expense: true, category_id: "housing", note: "Yearly insurance" }),
  ],
  ...o,
});

test("a month with nothing booked is empty; months since January that are empty", () => {
  const d = data();
  assert.ok(isEmptyMonth(d, new Date(2026, 2, 1)));
  assert.ok(!isEmptyMonth(d, new Date(2026, 10, 1)));
  const empty = emptyMonthsSince(d, new Date(2026, 0, 1), now);
  assert.equal(empty.length, 10); // January … October
  assert.equal(empty[0].getMonth(), 0);
  assert.equal(empty.at(-1).getMonth(), 9);
});

test("the estimate: pay on payday, monthly fixed costs on their day, budgets as spent", () => {
  const rows = estimateMonth(data(), new Date(2026, 1, 1), now); // February
  assert.ok(rows.every((r) => r.estimated === true));
  const income = rows.filter((r) => r.type === "income");
  assert.equal(income.length, 1);
  assert.equal(income[0].amount, "3800.00");
  assert.equal(income[0].gross_amount, "5200.00");
  assert.equal(income[0].category_id, "salary");
  assert.equal(new Date(income[0].date).getDate(), 25);
  const fixed = rows.filter((r) => r.is_fixed_expense);
  assert.deepEqual(fixed.map((r) => r.note).sort(), ["Netflix", "Rent"]); // the one-off yearly cost isn't copied
  assert.equal(new Date(fixed.find((r) => r.note === "Netflix").date).getDate(), 28); // the 30th in February
  assert.equal(fixed.find((r) => r.note === "Rent").recurrence_id, "rent");
  const budgets = rows.filter((r) => r.type === "expense" && !r.is_fixed_expense);
  assert.deepEqual(budgets.map((r) => [r.category_id, r.amount]), [["groceries", "450.00"]]);
  assert.equal(new Date(budgets[0].date).getDate(), 15);
});

test("no expected pay, no fixed costs, no budgets: nothing to estimate", () => {
  assert.deepEqual(estimateMonth(data({ profile: { currency_code: "EUR" }, transactions: [], budgets: [] }), new Date(2026, 1, 1), now), []);
});

test("estimated months are listed until confirmed", () => {
  const d = data();
  d.transactions.push(tx({ date: new Date(2026, 2, 15, 12).toISOString(), estimated: true }), tx({ date: new Date(2026, 0, 15, 12).toISOString(), estimated: true }), tx({ date: new Date(2026, 4, 15, 12).toISOString(), estimated: true, deleted_at: "x" }));
  assert.deepEqual(estimatedMonths(d), ["2026-01", "2026-03"]);
});
