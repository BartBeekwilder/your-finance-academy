// Household: income per person, who paid. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { SHARED, householdOf, newHousehold, splitByPerson } from "../household.ts";

let n = 0;
const hh = newHousehold("Bart", "Partner", () => `p${++n}`);
const tx = (amount, type, m, person_id = null) => ({ amount: String(amount), type, date: new Date(2026, m, 10, 12).toISOString(), person_id, deleted_at: null });

test("one person is no household; two are", () => {
  assert.deepEqual(householdOf({ household: [hh[0]] }), []);
  assert.equal(householdOf({ household: hh }).length, 2);
  assert.deepEqual(householdOf({}), []);
});

test("income per person, expenses per payer, unknown or missing → shared", () => {
  const ts = [tx(3000, "income", 0, "p1"), tx(2500, "income", 0, "p2"), tx(100, "expense", 0, "p1"), tx(80, "expense", 0), tx(50, "expense", 1, "gone")];
  const inc = splitByPerson(ts, "income", 2026, hh);
  assert.equal(inc.get("p1")[0], 3000);
  assert.equal(inc.get("p2")[0], 2500);
  const exp = splitByPerson(ts, "expense", 2026, hh);
  assert.equal(exp.get("p1")[0], 100);
  assert.equal(exp.get(SHARED)[0], 80);
  assert.equal(exp.get(SHARED)[1], 50);
});
