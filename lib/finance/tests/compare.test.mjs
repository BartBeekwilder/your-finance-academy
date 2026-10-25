// Comparing spending across years. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL, compareYears, cumulative, spendGrid, spread } from "../compare.ts";

const cat = (id, parent_id = null) => ({ id, parent_id, deleted_at: null });
const tx = (amount, y, m, category_id, type = "expense") => ({ amount: String(amount), type, date: new Date(y, m, 15, 12).toISOString(), category_id, deleted_at: null });
const data = {
  categories: [cat("food"), cat("market", "food"), cat("fun")],
  transactions: [tx(100, 2026, 0, "food"), tx(50, 2026, 0, "market"), tx(30, 2026, 1, "fun"), tx(200, 2026, 9, "fun"), tx(70, 2025, 10, "fun"), tx(999, 2026, 2, null, "income")],
};
const now = new Date(2026, 9, 25);

test("spend per top-level category, subcategories rolled up", () => {
  const g = spendGrid(data, 2026);
  assert.equal(g.get("food")[0], 150);
  assert.equal(g.get(ALL)[0], 150);
  assert.equal(g.get(ALL)[2], 0); // income ignored
});

test("this year stops after the current month", () => {
  const r = compareYears(data, now).get(ALL)[0];
  assert.equal(r.year, 2026);
  assert.equal(r.values[9], 200);
  assert.equal(r.values[10], null);
});

test("samples only where an earlier month has no real spending", () => {
  const rows = compareYears(data, now, { sample: true }).get("fun");
  const last = rows[1];
  assert.equal(last.year, 2025);
  assert.equal(last.values[10], 70); // real November 2025
  assert.equal(last.sample[10], false);
  assert.equal(last.sample[1], true); // February: sample from 2026's 30
  assert.ok(Math.abs(last.values[1] - 30 * 0.8) < 30 * 0.8 * 0.13);
  const without = compareYears(data, now).get("fun")[1];
  assert.equal(without.values[1], 0);
});

test("cumulative and spread", () => {
  assert.deepEqual(cumulative([1, 2, null]), [1, 3, null]);
  const s = spread([{ year: 1, values: [10, null], sample: [] }, { year: 2, values: [30, null], sample: [] }]);
  assert.deepEqual(s[0], { min: 10, max: 30, avg: 20 });
  assert.equal(s[1], null);
});
