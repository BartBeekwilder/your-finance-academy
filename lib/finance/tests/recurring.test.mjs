// Fixed costs that book themselves. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { dueFixedCosts, stableId, upcomingFixedCosts } from "../recurring.ts";

const tx = (id, date, fields = {}) => ({
  id, amount: "1000.00", type: "expense", date: date.toISOString(), note: "Mortgage", is_auto_income: false, is_fixed_expense: true,
  recurrence_id: null, category_id: "home", account_id: null, updated_at: "", deleted_at: null, ...fields,
});
const sep1 = tx("s", new Date(2026, 8, 1, 12));
const oct1 = tx("o", new Date(2026, 9, 1, 12));
const nov3 = new Date(2026, 10, 3, 9);

test("a fixed cost in both earlier months is booked on the same day this month", () => {
  const due = dueFixedCosts({ transactions: [sep1, oct1] }, nov3);
  assert.equal(due.length, 1);
  assert.equal(new Date(due[0].date).getMonth(), 10);
  assert.equal(new Date(due[0].date).getDate(), 1);
  assert.equal(due[0].amount, "1000.00");
  assert.equal(due[0].recurrence_id, "o");
  assert.equal(due[0].id, stableId("o|2026-11"));
});

test("not before its day: the 28th waits until the 28th", () => {
  const data = { transactions: [tx("a", new Date(2026, 8, 28, 12)), tx("b", new Date(2026, 9, 28, 12))] };
  assert.equal(dueFixedCosts(data, nov3).length, 0);
  assert.equal(dueFixedCosts(data, new Date(2026, 10, 28, 8)).length, 1);
});

test("once only: a month that has it (by recurrence or by hand) gets no copy", () => {
  const first = dueFixedCosts({ transactions: [sep1, oct1] }, nov3);
  assert.equal(dueFixedCosts({ transactions: [sep1, oct1, ...first] }, nov3).length, 0);
  const byHand = tx("h", new Date(2026, 10, 2, 12));
  assert.equal(dueFixedCosts({ transactions: [sep1, oct1, byHand] }, nov3).length, 0);
});

test("a deleted copy never comes back", () => {
  const [copy] = dueFixedCosts({ transactions: [sep1, oct1] }, nov3);
  assert.equal(dueFixedCosts({ transactions: [sep1, oct1], deletions: [{ id: copy.id }] }, nov3).length, 0);
});

test("a fixed cost seen once (a yearly payment) isn't repeated, unless it is marked recurring", () => {
  assert.equal(dueFixedCosts({ transactions: [oct1] }, nov3).length, 0);
  assert.equal(dueFixedCosts({ transactions: [{ ...oct1, recurrence_id: "r" }] }, nov3).length, 1);
});

test("earlier months are history: nothing is added to them", () => {
  // Marked recurring in September, missing in October: not filled in.
  const sep = tx("s", new Date(2026, 8, 1, 12), { recurrence_id: "r" });
  assert.equal(dueFixedCosts({ transactions: [sep] }, nov3).length, 0);
  assert.equal(dueFixedCosts({ transactions: [sep] }, new Date(2026, 9, 5, 9)).length, 1);
});

test("31st in a short month lands on the last day; income, advances and spread purchases are left alone", () => {
  const due = dueFixedCosts({ transactions: [tx("a", new Date(2026, 9, 31, 12), { recurrence_id: "r" })] }, new Date(2026, 10, 30, 13));
  assert.equal(new Date(due[0].date).getDate(), 30);
  const others = [
    tx("i", new Date(2026, 9, 1, 12), { type: "income", recurrence_id: "r1" }),
    tx("v", new Date(2026, 9, 1, 12), { advance: true, recurrence_id: "r2" }),
    tx("p", new Date(2026, 9, 1, 12), { spread_months: 12, recurrence_id: "r3" }),
    tx("x", new Date(2026, 9, 1, 12), { is_fixed_expense: false, recurrence_id: "r4" }),
  ];
  assert.equal(dueFixedCosts({ transactions: others }, nov3).length, 0);
});

test("still to come: a fixed cost later this month counts as upcoming until its day", () => {
  const data = { transactions: [tx("a", new Date(2026, 8, 29, 12)), tx("b", new Date(2026, 9, 29, 12))] };
  assert.equal(upcomingFixedCosts(data, nov3).length, 1);
  assert.equal(dueFixedCosts(data, nov3).length, 0);
  // On its day it's due instead (and booked), no longer upcoming.
  assert.equal(upcomingFixedCosts(data, new Date(2026, 10, 29, 8)).length, 0);
});
