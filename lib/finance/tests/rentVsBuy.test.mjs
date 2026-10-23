// Rent-or-buy rules. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { rentVsBuy, RENT_BUY_DEFAULTS } from "../rentVsBuy.ts";

const base = { ...RENT_BUY_DEFAULTS };

test("year 0: the renter has invested what the buyer put in", () => {
  const r = rentVsBuy(base);
  const y0 = r.timeline[0];
  assert.equal(y0.renter, base.ownMoney + base.price * base.buyCostsRate);
  assert.equal(r.loan, base.price - base.ownMoney);
  // Buying costs are gone the moment you buy: buyer starts behind.
  assert.ok(y0.buyer < y0.renter);
});

test("the mortgage is paid off at the end of the term", () => {
  const r = rentVsBuy({ ...base, years: 30, termYears: 30 });
  assert.ok(r.timeline[30].debt < 1);
  assert.ok(Math.abs(r.totals.repayment - r.loan) < 1);
});

test("linear repays the same each month and pays less interest than annuity", () => {
  const a = rentVsBuy({ ...base, kind: "annuity" });
  const l = rentVsBuy({ ...base, kind: "linear" });
  assert.ok(Math.abs(l.firstMonth.repayment - l.loan / 360) < 1e-6);
  assert.ok(l.totals.interest < a.totals.interest);
});

test("cheap rent and no appreciation: renting wins", () => {
  const r = rentVsBuy({ ...base, rent: 700, rentGrowth: 0, appreciation: 0 });
  assert.equal(r.breakEven, null);
  assert.ok(r.timeline.at(-1).renter > r.timeline.at(-1).buyer);
});

test("expensive rent and rising prices: buying wins, with a break-even year", () => {
  const r = rentVsBuy({ ...base, rent: 2_400, appreciation: 0.04 });
  assert.ok(r.breakEven !== null && r.breakEven >= 1);
  const at = r.timeline[r.breakEven];
  assert.ok(at.buyer >= at.renter);
});

test("Dutch tax: deduction lowers the monthly cost of owning", () => {
  const plain = rentVsBuy(base);
  const nl = rentVsBuy({ ...base, nlTax: true });
  assert.ok(nl.firstMonth.tax > 0);
  assert.ok(nl.firstMonth.total < plain.firstMonth.total);
});

test("per-year totals add up to the totals", () => {
  const r = rentVsBuy(base);
  assert.equal(r.byYear.length, base.years);
  const rent = r.byYear.reduce((s, y) => s + y.rent, 0);
  assert.ok(Math.abs(rent - r.totals.rent) < 1e-6);
  // Rent rises once a year.
  assert.ok(Math.abs(r.byYear[1].rent - r.byYear[0].rent * (1 + base.rentGrowth)) < 1e-6);
});
