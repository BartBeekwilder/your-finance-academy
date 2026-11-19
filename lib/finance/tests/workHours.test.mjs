import { test } from "node:test";
import assert from "node:assert/strict";
import { timeParts, workCost, workHoursFor } from "../workHours.ts";

test("workHoursFor: an amount as work hours at 40 hours a week", () => {
  assert.equal(Math.round(workHoursFor(1733, 17330) * 100) / 100, 17.33);
  assert.equal(workHoursFor(50, 0), null);
});

test("workCost: total and rows in work hours and real hours, biggest first", () => {
  const c = workCost(3100, 31, [{ key: "food", name: "Food", color: "#f00", amount: 310 }, { key: "home", name: "Home", color: "#00f", amount: 1240 }]);
  assert.deepEqual(c.rows.map((r) => r.key), ["home", "food"]);
  // A tenth of the income: a tenth of the month's hours.
  assert.equal(Math.round(c.rows[1].realHours * 100) / 100, 74.4);
  assert.equal(Math.round(c.rows[1].workHours * 100) / 100, 17.33);
  assert.equal(Math.round(c.total.realDays * 100) / 100, 15.5);
  assert.equal(Math.round(c.freeDays * 100) / 100, 15.5);
  assert.equal(workCost(0, 30, []), null);
});

test("timeParts: minutes under an hour, else hours", () => {
  assert.deepEqual(timeParts(0.25), { value: 15, unit: "min" });
  assert.deepEqual(timeParts(0.001), { value: 1, unit: "min" });
  assert.deepEqual(timeParts(3.46), { value: 3.5, unit: "h" });
});
