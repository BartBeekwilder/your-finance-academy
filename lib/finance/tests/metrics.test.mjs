// Key figures. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { freedom, keyMetrics, monthsToPositive } from "../metrics.ts";

const base = { income: 4000, fixed: 1600, spending: 3000, cash: 12000, investments: 20000, assets: 400000, debts: 300000 };

test("savings rate, runway, fixed share and debt ratio", () => {
  const m = Object.fromEntries(keyMetrics(base).map((x) => [x.key, x]));
  assert.equal(m.rate.value, 0.25);
  assert.equal(m.rate.tone, "good");
  assert.equal(m.runway.value, 4);
  assert.equal(m.runway.tone, "ok");
  assert.equal(m.fixed.value, 0.4);
  assert.equal(m.debt.value, 0.75);
  assert.equal(m.equity.value, 100000 / 3000);
  assert.ok(Math.abs(m.hour.value - 4000 / 173.3) < 1e-9);
});

test("free per day only with budgets left and days to go", () => {
  assert.ok(!keyMetrics(base).some((x) => x.key === "day"));
  const day = keyMetrics({ ...base, freeThisMonth: 300, daysLeft: 10 }).find((x) => x.key === "day");
  assert.equal(day.value, 30);
});

test("freedom number: 25x a year's spending, share there, years to go", () => {
  const f = freedom(3000, 32000, 1000);
  assert.equal(f.target, 900000);
  assert.ok(Math.abs(f.share - 32000 / 900000) < 1e-9);
  assert.ok(f.years > 20 && f.years < 40);
  assert.equal(freedom(3000, 1e6, 0).years, 0);
  assert.equal(freedom(3000, 1000, 0).years, null);
});

test("negative equity turns positive at what's left each month", () => {
  assert.equal(monthsToPositive(-34600, 1550), 23);
  assert.equal(monthsToPositive(1000, 1550), null);
  assert.equal(monthsToPositive(-1000, 0), null);
});
