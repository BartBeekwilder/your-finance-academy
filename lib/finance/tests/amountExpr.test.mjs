// Amounts typed as a sum. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { evalAmount, parseNumber } from "../amountExpr.ts";

test("numbers with a comma or a point", () => {
  assert.equal(parseNumber("12,50"), 12.5);
  assert.equal(parseNumber("12.50"), 12.5);
  assert.equal(parseNumber("1.234,56"), 1234.56);
  assert.equal(parseNumber("1,234.56"), 1234.56);
  assert.equal(parseNumber("1.234.567"), 1234567);
  assert.equal(parseNumber(",13,15"), 13.15);
  assert.equal(parseNumber("abc"), null);
});

test("sums, products and a single amount", () => {
  assert.deepEqual(evalAmount("1,22+12,52+13,15"), { value: 26.89, isSum: true });
  assert.deepEqual(evalAmount("1,22+12,52+,13,15"), { value: 26.89, isSum: true });
  assert.deepEqual(evalAmount("3*4,50 + 1"), { value: 14.5, isSum: true });
  assert.deepEqual(evalAmount("20-2,5"), { value: 17.5, isSum: true });
  assert.deepEqual(evalAmount("10/3"), { value: 3.33, isSum: true });
  assert.deepEqual(evalAmount("€ 4,38"), { value: 4.38, isSum: false });
  assert.deepEqual(evalAmount("12,50+"), { value: 12.5, isSum: false });
});

test("what can't be read", () => {
  assert.equal(evalAmount(""), null);
  assert.equal(evalAmount("12++3"), null);
  assert.equal(evalAmount("5/0"), null);
  assert.equal(evalAmount("taxi"), null);
});
