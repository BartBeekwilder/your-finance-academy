// Check-in rules. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkinDays, checkinState, coveredDays, dayKey, periodOf, sinceLast, trackedDays } from "../checkin.ts";

test("periods: daily, twice a week (Mon–Wed / Thu–Sun), weekly (Mon–Sun)", () => {
  const tue = new Date(2026, 10, 3); // Tuesday 3 Nov 2026
  assert.equal(dayKey(periodOf(tue, "daily").start), "2026-11-03");
  assert.equal(dayKey(periodOf(tue, "weekly").start), "2026-11-02");
  assert.equal(dayKey(periodOf(tue, "weekly").end), "2026-11-08");
  assert.equal(dayKey(periodOf(tue, "twice-weekly").end), "2026-11-04");
  const fri = new Date(2026, 10, 6);
  assert.equal(dayKey(periodOf(fri, "twice-weekly").start), "2026-11-05");
});

test("state: done this period and the run of periods in a row", () => {
  const days = checkinDays([
    { code: "checkin:2026-11-01" },
    { code: "checkin:2026-11-02" },
    { code: "checkin:2026-11-03" },
    { code: "first-close" },
    { code: "checkin:2026-10-30", deleted_at: "x" },
  ]);
  assert.deepEqual(days, ["2026-11-01", "2026-11-02", "2026-11-03"]);
  const daily = checkinState(days, new Date(2026, 10, 3), "daily");
  assert.equal(daily.done, true);
  assert.equal(daily.streak, 3);
  // Not yet today: the run up to yesterday still stands.
  const next = checkinState(days, new Date(2026, 10, 4), "daily");
  assert.equal(next.done, false);
  assert.equal(next.streak, 3);
  // Weekly: 1 Nov (Sun) is last week, 2–3 Nov this week → 2 weeks in a row.
  assert.equal(checkinState(days, new Date(2026, 10, 4), "weekly").streak, 2);
  assert.equal(checkinState([], new Date(2026, 10, 4), "daily").last, null);
});

test("since last: transactions dated after the last check-in", () => {
  const tx = [
    { type: "expense", date: "2026-11-02" },
    { type: "expense", date: "2026-11-04" },
    { type: "income", date: "2026-11-05" },
    { type: "expense", date: "2026-11-05", deleted_at: "x" },
  ];
  assert.deepEqual(sinceLast(tx, new Date(2026, 10, 3)), { expenses: 1, income: 1 });
  assert.deepEqual(sinceLast(tx, null), { expenses: 2, income: 1 });
});

test("covered days: a check-in counts the days back to the one before", () => {
  // First check-in on 3 Nov covers 1–3 Nov; the next on 6 Nov covers 4–6.
  assert.deepEqual(coveredDays(["2026-11-03"]), ["2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.deepEqual(coveredDays(["2026-11-03", "2026-11-06"]).slice(3), ["2026-11-04", "2026-11-05", "2026-11-06"]);
  // Visits and check-ins together, once each.
  assert.deepEqual(trackedDays(["2026-11-01T08:00", "2026-10-31"], ["2026-11-02"]), ["2026-10-31", "2026-11-01", "2026-11-02"]);
});
