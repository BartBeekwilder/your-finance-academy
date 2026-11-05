// Other loans. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { loanAt, loanSchedule, paymentsBy, payoff } from "../loans.ts";

const car = { balance: "12000.00", rate: "6", monthly: "300.00", start_date: "2026-11-05" };

test("payments start on the 1st after the stand", () => {
  assert.equal(paymentsBy(car, new Date(2026, 10, 30)), 0);
  assert.equal(paymentsBy(car, new Date(2026, 11, 1)), 1);
  assert.equal(paymentsBy(car, new Date(2027, 10, 15)), 12);
});

test("each month: interest added, the payment comes off", () => {
  const [first, second] = loanSchedule(car);
  assert.equal(first.interest, 60); // 12,000 × 6% / 12
  assert.equal(first.repaid, 240);
  assert.equal(first.balance, 11760);
  assert.equal(second.interest, 58.8);
  assert.equal(second.balance, 11518.8);
});

test("the debt goes down by itself over time", () => {
  assert.equal(loanAt(car, new Date(2026, 10, 20)).balance, 12000);
  const year = loanAt(car, new Date(2027, 10, 20));
  assert.equal(year.balance, 9039.45); // 12 × 300 = 3,600, of which 639.45 interest
  assert.equal(Math.round(year.repaid + year.balance), 12000);
});

test("paid off: the last payment is only what's left, then zero", () => {
  const p = payoff(car, new Date(2026, 10, 5));
  assert.ok(p);
  assert.equal(p.months, loanSchedule(car).length);
  const s = loanSchedule(car);
  assert.equal(s[s.length - 1].balance, 0);
  assert.ok(s[s.length - 1].repaid <= 300);
  assert.equal(loanAt(car, new Date(2040, 0, 1)).balance, 0);
});

test("a student loan at 0%: straight down by the payment", () => {
  const study = { balance: "6000.00", rate: "0", monthly: "100.00", start_date: "2026-11-01" };
  assert.equal(payoff(study, new Date(2026, 10, 1)).months, 60);
  assert.equal(payoff(study, new Date(2026, 10, 1)).interestLeft, 0);
});

test("no payment, or one below the interest: never paid off", () => {
  assert.equal(payoff({ ...car, monthly: "0" }, new Date(2026, 10, 5)), null);
  assert.equal(loanAt({ ...car, monthly: "0" }, new Date(2030, 0, 1)).balance, 12000);
  assert.equal(payoff({ ...car, monthly: "50" }, new Date(2026, 10, 5)), null);
  assert.ok(loanAt({ ...car, monthly: "50" }, new Date(2027, 10, 5)).balance > 12000);
});
