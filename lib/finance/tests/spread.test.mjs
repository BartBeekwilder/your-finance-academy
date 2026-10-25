// Spread expenses. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { spreadBookValue, spreadParts, withSpread } from "../spread.ts";

const laptop = { id: "L", amount: "2000.00", type: "expense", date: new Date(2026, 9, 10, 12).toISOString(), note: "Laptop", is_auto_income: false, is_fixed_expense: false, recurrence_id: null, category_id: null, account_id: null, spread_months: 48, updated_at: "", deleted_at: null };

test("a €2,000 laptop over 4 years is 48 parts of €41.66/€41.67 that add up exactly", () => {
  const parts = spreadParts(laptop);
  assert.equal(parts.length, 48);
  assert.equal(parts[0].amount, "41.66");
  assert.equal(parts.reduce((s, p) => s + Number(p.amount) * 100, 0), 200000);
  assert.equal(parts[0].spread_index, 1);
  assert.equal(parts[47].spread_total, 48);
  assert.ok(parts.every((p) => p.is_fixed_expense));
  assert.equal(new Date(parts[47].date).getFullYear(), 2030);
  assert.equal(new Date(parts[47].date).getMonth(), 8);
});

test("one-off expenses and income stay as they are", () => {
  assert.equal(spreadParts({ ...laptop, spread_months: null }).length, 1);
  assert.equal(spreadParts({ ...laptop, type: "income" }).length, 1);
});

test("book value: paid, not yet used up", () => {
  const data = { transactions: [laptop] };
  assert.equal(spreadBookValue(data, new Date(2026, 8, 1)).total, 0); // before the purchase
  assert.equal(Math.round(spreadBookValue(data, new Date(2026, 9, 1)).total * 100), 200000 - 4166); // after October's part
  const shown = withSpread({ transactions: [laptop] });
  assert.equal(shown.transactions.length, 48);
  assert.equal(Math.round(spreadBookValue(shown, new Date(2027, 9, 1)).total * 100), 200000 - 13 * 4166);
  assert.equal(spreadBookValue(shown, new Date(2030, 8, 1)).total, 0);
});
