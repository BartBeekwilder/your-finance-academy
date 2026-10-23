// Mortgage maths. Run: node --test lib/finance/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { annuityPayment, schedule, summarize, extraEffect, ownership, nlMonthlyTaxEffect } from "../mortgage.ts";

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const part = (o = {}) => ({ id: "p", name: "Part", kind: "annuity", principal: 300000, rate: 4, start: new Date(2020, 0, 1), termMonths: 360, ...o });

test("annuity payment matches the textbook formula", () => {
  // €300,000 at 4% over 30 years ≈ €1,432.25 per month.
  near(annuityPayment(300000, 0.04 / 12, 360), 1432.25);
});

test("annuity: payment constant, debt reaches zero after the term", () => {
  const rows = schedule(part());
  assert.equal(rows.length, 360);
  near(rows[0].payment, rows[200].payment);
  near(rows[359].balance, 0);
  assert.ok(rows[0].interest > rows[0].repayment && rows[359].repayment > rows[359].interest);
});

test("linear: same repayment every month, payments fall", () => {
  const rows = schedule(part({ kind: "linear" }));
  near(rows[0].repayment, 300000 / 360);
  near(rows[100].repayment, 300000 / 360);
  assert.ok(rows[0].payment > rows[359].payment);
  near(rows[359].balance, 0);
});

test("interest-only: no repayment until the end", () => {
  const rows = schedule(part({ kind: "interest_only" }));
  near(rows[10].repayment, 0);
  near(rows[358].balance, 300000);
  near(rows[359].repayment, 300000);
});

test("total interest of the annuity = payments − principal", () => {
  const s = summarize(part(), new Date(2020, 0, 1));
  near(s.totalPaid - 300000, s.totalInterest, 1);
});

test("extra repayment shortens the loan and saves interest", () => {
  const e = extraEffect(part(), { extraMonthly: 200 });
  assert.ok(e.monthsSooner > 50, `months sooner ${e.monthsSooner}`);
  assert.ok(e.interestSaved > 40000, `saved ${e.interestSaved}`);
});

test("summary at a date: repaid + balance = principal", () => {
  const s = summarize(part(), new Date(2026, 9, 15));
  near(s.repaidSoFar + s.balance, 300000);
  assert.equal(s.thisMonth.i, 81);
});

test("ownership share", () => {
  near(ownership(500000, 300000), 0.4);
  near(ownership(500000, 600000), 0);
});

test("NL tax effect: interest above the forfait at the max rate", () => {
  const t = nlMonthlyTaxEffect([part()], new Date(2020, 0, 1), 400000);
  near(t.deductibleInterest, 1000);
  near(t.forfait, (400000 * 0.0035) / 12);
  near(t.effect, (1000 - t.forfait) * 0.3748);
});

test("extra repayment starting later only changes the months from then on", () => {
  const p = part();
  const from = new Date(2026, 9, 1);
  const rows = schedule(p, { extraMonthly: 200, extraFrom: from });
  const base = schedule(p);
  near(rows[80].balance, base[80].balance); // before October 2026: identical
  assert.equal(rows[81].extra, 200);
  const e = extraEffect(p, { extraMonthly: 200, extraFrom: from });
  const e0 = extraEffect(p, { extraMonthly: 200 });
  assert.ok(e.monthsSooner < e0.monthsSooner && e.interestSaved < e0.interestSaved);
});
