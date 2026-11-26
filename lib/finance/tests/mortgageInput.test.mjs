// A loan part from the bank's figures — Bart's two parts on 26 Nov 2026
// (3.85% annuity): 101 borrowed €174,698, owes €170,856.54, pays €850.34;
// 102 borrowed €255,302, owes €250,295.12, pays €1,196.88, ends Oct 2055.
// Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { partFromBank } from "../mortgageInput.ts";
import { summarize } from "../mortgage.ts";

const now = new Date(2026, 10, 26, 12);
const close = (a, b, d = 0.02) => assert.ok(Math.abs(a - b) < d, `${a} ≠ ${b}`);
const asPart = (p) => ({ id: "x", name: "x", kind: "annuity", principal: p.principal, rate: 3.85, start: new Date(`${p.start_date}T12:00:00`), termMonths: p.term_months });

test("with the original loan: the real start (Nov 2025) and term", () => {
  const p101 = partFromBank({ kind: "annuity", outstanding: 170856.54, rate: 3.85, monthly: 850.34, original: 174698 }, now);
  assert.equal(p101.start_date, "2025-11-01");
  assert.equal(p101.term_months, 336);
  close(p101.payment, 850.34, 0.01);
  assert.equal(p101.mismatch, false);
  const p102 = partFromBank({ kind: "annuity", outstanding: 250295.12, rate: 3.85, monthly: 1196.88, original: 255302, endDate: "2055-10-01" }, now);
  assert.equal(p102.start_date, "2025-11-01");
  assert.equal(p102.term_months, 360);
  // The schedule lands on the bank's stand today.
  close(summarize(asPart(p102), now).balance, 250295.12, 1);
});

test("without it: an equivalent part from this month, same payment and debt", () => {
  const p = partFromBank({ kind: "annuity", outstanding: 250295.12, rate: 3.85, endDate: "2055-10-01" }, now);
  assert.equal(p.start_date, "2026-11-01");
  close(p.payment, 1196.88, 0.05);
  const s = summarize(asPart(p), now);
  close(s.balance, 250295.12, 0.5);
  close(s.thisMonth.payment, 1196.88, 0.05);
});

test("the payment alone gives the months left", () => {
  const p = partFromBank({ kind: "annuity", outstanding: 170856.54, rate: 3.85, monthly: 850.34 }, now);
  close(p.payment, 850.34, 0.6);
});

test("a payment that doesn't fit the end date is flagged", () => {
  const p = partFromBank({ kind: "annuity", outstanding: 250295.12, rate: 3.85, monthly: 1500, endDate: "2055-10-01" }, now);
  assert.equal(p.mismatch, true);
});

test("not enough to go on: null", () => {
  assert.equal(partFromBank({ kind: "annuity", outstanding: 1000, rate: 3, monthly: 2 }, now), null);
});
