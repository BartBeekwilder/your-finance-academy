// Check-in rules. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkinDays, checkinState, dayKey, periodOf, sinceLast } from "../checkin.ts";

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
