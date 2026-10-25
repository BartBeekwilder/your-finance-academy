// Comparing spending across years. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL, compareYears, cumulative, spendGrid, spread, yearTotals } from "../compare.ts";

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

test("year totals: oldest first, this year with the forecast ahead", () => {
  const ys = yearTotals(data, now, [{ income: 0, spent: 250 }, { income: 0, spent: 100 }], { back: 1 });
  assert.deepEqual(ys.map((y) => y.year), [2025, 2026]);
  assert.equal(ys[1].spent, 380); // 150 + 30 + 200
  assert.equal(ys[1].income, 999);
  assert.equal(ys[1].spentAhead, 50 + 100); // October: 250 − 200 entered, then November
  assert.equal(ys[0].spent, 70);
  assert.equal(ys[0].spentAhead, 0);
});

test("imported year totals fill the months without transactions, evenly", () => {
  const withHist = { ...data, yearCategoryTotals: [{ year: 2025, category_id: "fun", amount: "1270" }, { year: 2025, category_id: "market", amount: "110" }] };
  const fun = compareYears(withHist, now, { sample: true }).get("fun")[1];
  assert.equal(fun.values[10], 70); // real November stays
  assert.equal(fun.yearly[10], false);
  assert.equal(fun.values[0], 109.09); // (1270 − 70) over the 11 months without transactions
  assert.equal(fun.sample.some(Boolean), false);
  const food = compareYears(withHist, now, { sample: true }).get("food")[1];
  assert.equal(Math.round(food.values.reduce((a, b) => a + b, 0)), 110); // subcategory rolls up to its parent
  const inc = compareYears(withHist, now, { sample: true, type: "income" }).get(ALL)[1];
  assert.equal(inc.missing, true); // income isn't invented for an imported year
  assert.equal(inc.sample.some(Boolean), false);
});

test("imported income totals, one total per year", () => {
  const withInc = { ...data, yearCategoryTotals: [{ year: 2024, category_id: "fun", amount: "120" }], yearIncomeTotals: [{ year: 2024, amount: "1200", gross: "1800" }] };
  const inc = compareYears(withInc, now, { sample: true, type: "income", back: 2 }).get(ALL)[2];
  assert.equal(inc.year, 2024);
  assert.equal(inc.values[5], 100);
  assert.equal(inc.missing, false);
  const ys = yearTotals(withInc, now, [], { back: 2, sample: true });
  assert.equal(Math.round(ys[0].income), 1200);
  assert.equal(Math.round(ys[0].spent), 120);
});
