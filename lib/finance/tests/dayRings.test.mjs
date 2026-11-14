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

test("saving with accrue: salary and fixed costs spread, not on their day", () => {
  // Payday on the 25th, rent on the 1st: cash alone is negative until
  // payday; spread, each day saves (3000 − 900) / 30 = 70 against a goal of
  // 600 / 30 = 20 a day → a second lap from day 1.
  const tx = [
    { type: "income", amount: "3000", date: "2026-11-25", is_fixed_expense: false, deleted_at: null, salary: true },
    { type: "expense", amount: "900", date: "2026-11-01", is_fixed_expense: true, deleted_at: null },
  ];
  const base = { transactions: tx, activeDays: [], month: new Date(2026, 10, 1), today: new Date(2026, 10, 3), allowance: 0, savingsTarget: 600 };
  assert.equal(dayRings(base)[0].saving, 0);
  const spread = dayRings({ ...base, accrue: { salary: 3000, isSalary: (t) => !!t.salary } });
  assert.equal(spread[0].saving, 2);
  assert.equal(spread[2].saving, 2);
});

test("under your income: a day is full when its spending stays under its income; the month at 80% of its days", async () => {
  const { dayRings, underIncomeMonth } = await import("../dayRings.ts");
  const at = (d) => new Date(2026, 3, d, 12).toISOString(); // April: 30 days
  const tx = (o) => ({ type: "expense", amount: "0", date: at(1), is_fixed_expense: false, deleted_at: null, ...o });
  // Salary 3000 → 100 a day; rent 900 fixed → 30 a day; so 70 a day is free.
  const transactions = [tx({ type: "income", amount: "3000", date: at(25), salary: true }), tx({ amount: "900", is_fixed_expense: true }), tx({ amount: "50", date: at(2) }), tx({ amount: "200", date: at(3) }), tx({ type: "income", amount: "150", date: at(3) })];
  const r = dayRings({ transactions, activeDays: [], month: new Date(2026, 3, 1), today: new Date(2026, 3, 30, 20), allowance: 0, savingsTarget: 0, accrue: { salary: 3000, isSalary: (t) => !!t.salary }, underIncome: true });
  assert.equal(r[0].budget, 1); // 30 out, 100 in
  assert.equal(r[1].budget, 1); // 80 out, 100 in
  assert.equal(r[2].budget, 1); // 230 out, 250 in (other income that day)
  const m = underIncomeMonth(r);
  assert.deepEqual([m.hits, m.goal, m.days, m.ring], [30, 24, 30, 1]);
  // A big day in the middle: over, the ring is income ÷ spending that day.
  const r2 = dayRings({ transactions: [...transactions, tx({ amount: "500", date: at(10) })], activeDays: [], month: new Date(2026, 3, 1), today: new Date(2026, 3, 15, 20), allowance: 0, savingsTarget: 0, accrue: { salary: 3000, isSalary: (t) => !!t.salary }, underIncome: true });
  assert.equal(Math.round(r2[9].budget * 1000) / 1000, Math.round((100 / 530) * 1000) / 1000);
  const m2 = underIncomeMonth(r2);
  assert.equal(m2.hits, 14); // days 1–15, day 10 over; the rest still to come
  assert.equal(m2.ring, 14 / 24);
});
