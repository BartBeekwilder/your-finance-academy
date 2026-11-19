import { test } from "node:test";
import assert from "node:assert/strict";
import { clockTime, duration, moneyClock } from "../moneyClock.ts";

const row = (key, amount) => ({ key, name: key, color: "#fff", amount });

test("moneyClock: income is 24 hours, biggest first, the rest is yours", () => {
  const c = moneyClock(3000, [row("food", 500), row("home", 1000), row("fun", 250)], 30);
  assert.deepEqual(c.slices.map((s) => s.key), ["home", "food", "fun"]);
  assert.equal(c.slices[0].hours, 8); // a third of the income: until 08:00
  assert.equal(c.slices[1].from, 8);
  assert.equal(c.slices[1].to, 12);
  assert.equal(c.slices[0].perDay, 1000 / 30);
  assert.equal(c.kept, 1250);
  assert.equal(c.keptFrom, 14);
  assert.equal(c.overHours, 0);
});

test("moneyClock: spending more than came in runs past midnight", () => {
  const c = moneyClock(2000, [row("home", 1500), row("food", 1000)], 30);
  assert.equal(c.keptFrom, null);
  assert.equal(c.kept, 0);
  assert.equal(c.overHours, 6);
});

test("moneyClock: tiny categories are grouped, no income is no clock", () => {
  const c = moneyClock(3000, [row("home", 1000), row("a", 10), row("b", 20)], 30);
  assert.deepEqual(c.slices.map((s) => s.key), ["home", "rest"]);
  assert.equal(c.slices[1].amount, 30);
  assert.equal(moneyClock(0, [row("home", 10)], 30), null);
});

test("clockTime and duration", () => {
  assert.equal(clockTime(7.5), "07:30");
  assert.equal(clockTime(19.7), "19:42");
  assert.equal(clockTime(25.5), "01:30");
  assert.deepEqual(duration(2.25), { h: 2, m: 15 });
});
