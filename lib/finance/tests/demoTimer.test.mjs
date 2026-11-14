// The demo's time limit. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { clock, demoLeft, demoStartValid, earliestStart, DEMO_MINUTES, DEMO_RESET_DAYS } from "../demoTimer.ts";

const MIN = 60_000, DAY = 86_400_000;
const t0 = Date.UTC(2026, 10, 14, 10);

test("the demo runs for its minutes, then it's over", () => {
  assert.equal(demoLeft(t0, t0), DEMO_MINUTES * MIN);
  assert.equal(demoLeft(t0, t0 + 4 * MIN), (DEMO_MINUTES - 4) * MIN);
  assert.equal(demoLeft(t0, t0 + DEMO_MINUTES * MIN), 0);
  assert.equal(demoLeft(t0, t0 + 2 * DAY), 0);
});

test("a remembered start counts until the reset period has passed", () => {
  assert.ok(demoStartValid(t0, t0 + 5 * MIN));
  assert.ok(demoStartValid(t0, t0 + (DEMO_RESET_DAYS - 1) * DAY));
  assert.ok(!demoStartValid(t0, t0 + DEMO_RESET_DAYS * DAY));
  assert.ok(!demoStartValid(t0 + DAY, t0)); // in the future: tampered with
  assert.ok(!demoStartValid(null, t0));
  assert.ok(!demoStartValid(Number.NaN, t0));
});

test("clearing one store doesn't restart the clock: the earliest wins", () => {
  assert.equal(earliestStart([t0 + 3 * MIN, t0], t0 + 5 * MIN), t0);
  assert.equal(earliestStart([null, t0], t0 + 5 * MIN), t0);
  assert.equal(earliestStart([t0 - 40 * DAY, null], t0), null);
});

test("the clock reads minutes and seconds", () => {
  assert.equal(clock(10 * MIN), "10:00");
  assert.equal(clock(65_000), "1:05");
  assert.equal(clock(400), "0:01");
});
