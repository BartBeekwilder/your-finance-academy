// Merging copies of the data between devices. Run: npm run test:calc
// The same cases run on Android (VaultMergeTest.kt) and iOS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { foldIds, liveOnly, mergeData, safeMerge, trackChanges } from "../vaultMerge.ts";

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

// 19 Nov 2026: a tab still holding the 18 Nov wipe (few rows, hundreds of
// deletion marks) merged with the restored copy and emptied it again.
const many = (n, at) => Array.from({ length: n }, (_, i) => row(`t${i}`, at));
const marks = (n, at) => Array.from({ length: n }, (_, i) => ({ collection: "transactions", id: `t${i}`, deleted_at: at }));

test("safeMerge: a side carrying a wipe never empties the other side", () => {
  const restored = { transactions: many(100, "2026-11-01T00:00:00Z"), deletions: [] };
  const staleTab = { transactions: [row("x", "2026-11-18T20:00:00Z")], deletions: marks(100, "2026-11-18T20:27:00Z") };
  for (const [a, b] of [[staleTab, restored], [restored, staleTab]]) {
    const { data, guarded } = safeMerge(a, b);
    assert.equal(guarded, true);
    assert.equal(data.transactions.length, 101);
    assert.ok(data.transactions.every((r) => !r.deleted_at));
    assert.equal(data.deletions.length, 0);
  }
});

test("safeMerge: ordinary deletions still go through", () => {
  const local = { transactions: many(100, "2026-11-01T00:00:00Z"), deletions: [] };
  const remote = { transactions: many(100, "2026-11-01T00:00:00Z").slice(3), deletions: marks(3, "2026-11-02T00:00:00Z") };
  const { data, guarded } = safeMerge(local, remote);
  assert.equal(guarded, false);
  assert.equal(data.transactions.length, 97);
  assert.equal(data.deletions.length, 3);
});

// 18 Nov: the iPad wrote every id in upper case (Swift uuidString), the web in
// lower case — merged as different strings, every row came back twice.
const A = "3f2b8c1e-9d4a-4b6e-8f10-2a7c5d9e1b34", C = "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f", K = "11111111-2222-4333-8444-555555555555";
test("the same id in another case is one row: folded, newest wins, fields kept", () => {
  const web = { profile: { household: [{ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", name: "Bart" }] },
    accounts: [row(K, "2026-11-01T00:00:00Z", { name: "Lopende rekening" })],
    categories: [row(C, "2026-11-01T00:00:00Z", { name: "Groceries" })],
    transactions: [row(A, "2026-11-10T00:00:00Z", { amount: "12.50", category_id: C, account_id: K, gross_amount: null, person_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" })] };
  const ipad = { accounts: [row(K.toUpperCase(), "2026-11-18T09:00:00Z", { name: "Lopende rekening" })],
    categories: [row(C.toUpperCase(), "2026-11-18T09:00:00Z", { name: "Groceries" })],
    // The app doesn't know every field (no gross_amount here) and wrote upper-case references.
    transactions: [{ id: A.toUpperCase(), updated_at: "2026-11-18T09:00:00Z", amount: "12.50", category_id: C.toUpperCase(), account_id: K.toUpperCase() }] };
  const doubled = { ...web, accounts: [...web.accounts, ...ipad.accounts], categories: [...web.categories, ...ipad.categories], transactions: [...web.transactions, ...ipad.transactions] };
  const f = foldIds(doubled);
  assert.equal(f.changed, true);
  assert.equal(f.doc.transactions.length, 1);
  assert.equal(f.doc.accounts.length, 1);
  assert.equal(f.doc.categories.length, 1);
  const t = f.doc.transactions[0];
  assert.equal(t.id, A);
  assert.equal(t.category_id, C);
  assert.equal(t.account_id, K);
  assert.equal(t.person_id, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  assert.ok("gross_amount" in t, "a field only the web row had is kept");
  assert.equal(t.updated_at, "2026-11-18T09:00:00Z");
  // A merge of the web copy with the iPad's never doubles anything.
  const m = liveOnly(mergeData(web, ipad));
  assert.equal(m.transactions.length, 1);
  assert.equal(m.accounts.length, 1);
  // A clean copy isn't touched.
  assert.equal(foldIds(web).changed, false);
});

test("ids that aren't UUIDs are left as they are", () => {
  const d = { achievements: [row("Checkin:2026-11-18", "2026-11-18T00:00:00Z")] };
  assert.equal(foldIds(d).changed, false);
});

test("a deletion that only came from the case mix-up doesn't delete the row", () => {
  // The app saw the web's lower-case row as gone (its own copy was upper case)
  // and recorded a deletion at the same moment it re-sent the row.
  const at = "2026-11-18T09:00:00Z";
  const vault = { transactions: [{ id: A.toUpperCase(), updated_at: at, amount: "12.50" }], deletions: [{ collection: "transactions", id: A, deleted_at: at }] };
  const web = { transactions: [row(A, "2026-11-10T00:00:00Z", { amount: "12.50" })], deletions: [] };
  const m = liveOnly(mergeData(web, vault));
  assert.equal(m.transactions.length, 1);
  assert.equal(m.transactions[0].id, A);
  assert.equal(m.deletions.length, 0);
  // A real deletion (no live twin) still deletes.
  const gone = liveOnly(mergeData(web, { transactions: [], deletions: [{ collection: "transactions", id: A.toUpperCase(), deleted_at: at }] }));
  assert.equal(gone.transactions.length, 0);
});

test("the doubling of 19 Nov: the iPad's upper-case copy + its 'deletions' fold back to one copy, nothing lost", () => {
  // The web copy (lower case), and what the iPad sent: every row in upper case,
  // and every lower-case row marked deleted. safeMerge used to keep both sides.
  const web = { transactions: many(40, "2026-11-10T00:00:00Z").map((r, i) => ({ ...r, id: `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000` })), deletions: [] };
  const at = "2026-11-19T12:00:00Z";
  const ipad = { transactions: web.transactions.map((r) => ({ ...r, id: r.id.toUpperCase(), updated_at: at })),
    deletions: web.transactions.map((r) => ({ collection: "transactions", id: r.id, deleted_at: at })) };
  for (const [a, b] of [[web, ipad], [ipad, web]]) {
    const { data } = safeMerge(a, b);
    assert.equal(data.transactions.length, 40);
    assert.ok(data.transactions.every((r) => r.id === r.id.toLowerCase()));
  }
  // And a copy that already has both (what's in the vault now) folds to 40.
  const doubled = { transactions: [...web.transactions, ...ipad.transactions] };
  assert.equal(liveOnly(doubled).transactions.length, 40);
});
