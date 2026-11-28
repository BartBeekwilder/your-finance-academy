// The year clock: costs take their share of the year, biggest first, and
// from the day after the last one you work for yourself.
// Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { yearClock, yearTips, dateOf } from "../yearClock.ts";

const close = (a, b, d = 0.01) => assert.ok(Math.abs(a - b) < d, `${a} ≠ ${b}`);
const rows = [
  { key: "home", name: "Home", color: "#2f6690", amount: 18250, variable: false },
  { key: "food", name: "Groceries", color: "#2e8b57", amount: 7300, variable: true },
  { key: "out", name: "Dining out", color: "#e4572e", amount: 3650, variable: true },
];

test("each cost takes its share of the year, biggest first", () => {
  const c = yearClock(2026, 36500, rows);
  assert.equal(c.length, 365);
  assert.deepEqual(c.slices.map((s) => s.key), ["home", "food", "out"]);
  close(c.slices[0].days, 182.5);
  close(c.slices[1].from, 182.5);
  close(c.freeFrom, 292); // 29 200 of 36 500 → day 292
  assert.equal(dateOf(2026, c.freeFrom).getMonth(), 9); // 20 October
  close(c.kept, 7300);
  assert.equal(c.overDays, 0);
});

test("spending more than comes in: no day for yourself, the costs run past New Year", () => {
  const c = yearClock(2026, 20000, rows);
  assert.equal(c.freeFrom, null);
  assert.ok(c.overDays > 0);
});

test("tips: a quarter less on a variable cost moves the day forward", () => {
  const c = yearClock(2026, 36500, rows);
  const tips = yearTips(c, rows);
  assert.deepEqual(tips.map((t) => t.key), ["food", "out"]); // the home is fixed
  close(tips[1].saves, 912.5);
  close(tips[1].daysSooner, 9.125);
  close(tips[1].freeFrom, 292 - 9.125);
});

test("no income: no clock", () => {
  assert.equal(yearClock(2026, 0, rows), null);
});
