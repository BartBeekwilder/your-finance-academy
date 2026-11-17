// The currency a visitor sees. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { currencyFor } from "../plans.ts";

test("dollars in the US, pounds in the UK, euros elsewhere; ?currency= wins", () => {
  assert.equal(currencyFor("US"), "usd");
  assert.equal(currencyFor("GB"), "gbp");
  assert.equal(currencyFor("NL"), "eur");
  assert.equal(currencyFor("CH"), "eur");
  assert.equal(currencyFor(null), "eur");
  assert.equal(currencyFor("NL", "USD"), "usd");
  assert.equal(currencyFor("US", "yen"), "usd");
});
