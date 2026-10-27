// Merging copies of the data between devices. Run: npm run test:calc
// The same cases run on Android (VaultMergeTest.kt) and iOS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { liveOnly, mergeData, trackChanges } from "../vaultMerge.ts";

const row = (id, at, extra = {}) => ({ id, updated_at: at, deleted_at: null, ...extra });

test("the newest version of a row wins; new rows from both sides stay", () => {
  const local = { profile: { currency_code: "EUR" }, transactions: [row("a", "2026-10-01T10:00:00Z", { amount: "1" }), row("b", "2026-10-02T10:00:00Z")] };
  const remote = { profile: { currency_code: "EUR" }, transactions: [row("a", "2026-10-03T10:00:00.5Z", { amount: "2" }), row("c", "2026-10-01T00:00:00Z")] };
  const m = mergeData(local, remote);
  const by = Object.fromEntries(m.transactions.map((r) => [r.id, r]));
  assert.equal(by.a.amount, "2");
  assert.ok(by.b && by.c);
  assert.equal(m.transactions.length, 3);
});

test("a deletion wins over older edits, loses to a later edit", () => {
  const local = { transactions: [row("a", "2026-10-01T10:00:00Z"), row("b", "2026-10-05T10:00:00Z")], deletions: [] };
  const remote = { transactions: [], deletions: [{ collection: "transactions", id: "a", deleted_at: "2026-10-02T00:00:00Z" }, { collection: "transactions", id: "b", deleted_at: "2026-10-03T00:00:00Z" }] };
  const m = mergeData(local, remote);
  const by = Object.fromEntries(m.transactions.map((r) => [r.id, r]));
  assert.equal(by.a.deleted_at, "2026-10-02T00:00:00Z");
  assert.equal(by.b.deleted_at, null);
  assert.deepEqual(liveOnly(m).transactions.map((r) => r.id), ["b"]);
  assert.equal(m.deletions.length, 2);
});

test("rows marked deleted_at (apps) count as deletions", () => {
  const local = { transactions: [row("a", "2026-10-01T10:00:00Z")] };
  const remote = { transactions: [{ ...row("a", "2026-10-02T10:00:00Z"), deleted_at: "2026-10-02T10:00:00Z" }] };
  assert.equal(liveOnly(mergeData(local, remote)).transactions.length, 0);
});

test("the newest profile wins; other keys come from local", () => {
  const local = { profile: { currency_code: "EUR", updated_at: "2026-10-01T00:00:00Z" }, yearSnapshots: [1] };
  const remote = { profile: { currency_code: "USD", updated_at: "2026-10-02T00:00:00Z" }, yearSnapshots: [2], extra: true };
  const m = mergeData(local, remote);
  assert.equal(m.profile.currency_code, "USD");
  assert.deepEqual(m.yearSnapshots, [1]);
  assert.equal(m.extra, true);
});

test("merging is the same whichever side goes first (for live rows)", () => {
  const a = { transactions: [row("x", "2026-10-01T00:00:00Z", { v: 1 }), row("y", "2026-10-04T00:00:00Z")], deletions: [{ collection: "transactions", id: "z", deleted_at: "2026-10-03T00:00:00Z" }] };
  const b = { transactions: [row("x", "2026-10-02T00:00:00Z", { v: 2 }), row("z", "2026-10-01T00:00:00Z")] };
  const ids = (d) => liveOnly(d).transactions.map((r) => `${r.id}${r.v ?? ""}`).sort();
  assert.deepEqual(ids(mergeData(a, b)), ids(mergeData(b, a)));
  assert.deepEqual(ids(mergeData(a, b)), ["x2", "y"]);
});

test("trackChanges records removed rows and stamps a changed profile", () => {
  const before = { profile: { currency_code: "EUR" }, transactions: [row("a", "x"), row("b", "x")], categories: [] };
  const after = { profile: { currency_code: "USD" }, transactions: [row("a", "x")], categories: [] };
  const now = new Date("2026-10-27T12:00:00Z");
  const t = trackChanges(before, after, now);
  assert.deepEqual(t.deletions, [{ collection: "transactions", id: "b", deleted_at: "2026-10-27T12:00:00.000Z" }]);
  assert.equal(t.profile.updated_at, "2026-10-27T12:00:00.000Z");
  const same = trackChanges(after, { ...after }, now);
  assert.equal(same.profile.updated_at, undefined);
});
