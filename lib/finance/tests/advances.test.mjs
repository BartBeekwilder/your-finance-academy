// Advances ("voorgeschoten"). Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { advancesByAccount, openAdvances, withAdvances } from "../advances.ts";

const base = { type: "expense", is_auto_income: false, is_fixed_expense: false, recurrence_id: null, category_id: null, updated_at: "", deleted_at: null };
const tickets = { ...base, id: "A", amount: "120.00", date: new Date(2026, 9, 20, 12).toISOString(), note: "Concert tickets for Sam", account_id: "bank", advance: true, repaid_at: null };
const lunch = { ...base, id: "B", amount: "15.00", date: new Date(2026, 9, 21, 12).toISOString(), note: "Lunch", account_id: "bank" };

test("advances are taken out of the transactions every screen sums", () => {
  const shown = withAdvances({ transactions: [tickets, lunch] });
  assert.deepEqual(shown.transactions.map((t) => t.id), ["B"]);
  assert.deepEqual(shown.advances.map((t) => t.id), ["A"]);
});

test("open from the day it was paid until it's paid back", () => {
  const repaid = { ...tickets, repaid_at: new Date(2026, 9, 25, 12).toISOString() };
  const data = withAdvances({ transactions: [repaid, lunch] });
  assert.equal(openAdvances(data, new Date(2026, 9, 19)).length, 0);
  assert.equal(openAdvances(data, new Date(2026, 9, 22)).length, 1);
  assert.equal(openAdvances(data, new Date(2026, 9, 26)).length, 0);
});

test("per account: what open advances took off it (no account = the default)", () => {
  const data = withAdvances({ transactions: [tickets, { ...tickets, id: "C", amount: "30.00", account_id: null }] });
  const by = advancesByAccount(data, new Date(2026, 9, 28), "main");
  assert.equal(by.get("bank"), 120);
  assert.equal(by.get("main"), 30);
});
