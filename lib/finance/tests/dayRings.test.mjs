// Daily rings and streaks. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { dayRings, longestStreak, ringStreak } from "../dayRings.ts";

const tx = (type, amount, day, fixed = false) => ({ type, amount: String(amount), date: `2026-10-${String(day).padStart(2, "0")}T12:00:00`, is_fixed_expense: fixed, deleted_at: null });

test("rings per day: tracking, budget on track so far, saving so far", () => {
  const rings = dayRings({
    transactions: [tx("expense", 50, 1), tx("expense", 400, 2), tx("expense", 1000, 1, true), tx("income", 3100, 10)],
    activeDays: ["2026-10-01", "2026-10-02"],
    month: new Date(2026, 9, 1),
    today: new Date(2026, 9, 10, 15),
    allowance: 3100, // 100 a day
    savingsTarget: 620, // 20 a day
  });
  assert.equal(rings.length, 31);
  assert.deepEqual([rings[0].tracking, rings[2].tracking], [1, 0]);
  assert.equal(rings[0].budget, 1); // 50 of 100
  assert.equal(rings[1].budget, 200 / 450); // 450 against 200 allowed
  assert.equal(rings[4].budget, 1); // 450 of 500 by the 5th
  assert.equal(rings[1].saving, 0); // nothing saved yet
  assert.equal(rings[9].saving, 2); // 1650 saved against 200: capped at two laps
  assert.ok(rings[10].future && !rings[9].future);
});

test("streaks", () => {
  assert.equal(longestStreak(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"]), 3);
  const r = (budget, future = false) => ({ budget, future, perfect: budget === 1 });
  assert.equal(ringStreak([r(1), r(0.5), r(1), r(1), r(0.8), r(1, true)], "budget"), 2); // today not yet: still counts the run before
  assert.equal(ringStreak([r(1), r(1), r(1)], "perfect"), 3);
});
