// Insurance rules. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageCheck, perMonth, renewal, totals } from "../insurance.ts";
import { guessCountry, healthRule } from "../countries.ts";

test("premiums per month whatever the period", () => {
  assert.equal(perMonth(120, "year"), 10);
  assert.equal(perMonth(30, "quarter"), 10);
  assert.equal(perMonth(10, "month"), 10);
});

test("totals per month, per year, deductibles and the biggest kind first", () => {
  const t = totals([
    { kind: "health", premium: 150, period: "month", deductible: 385, renewalDate: null, noticeMonths: 1 },
    { kind: "liability", premium: 60, period: "year", deductible: 0, renewalDate: null, noticeMonths: 1 },
  ]);
  assert.equal(t.perMonth, 155);
  assert.equal(t.perYear, 1860);
  assert.equal(t.deductibles, 385);
  assert.equal(t.byKind[0].kind, "health");
});

test("renewal rolls forward a year and the cancel date is notice months before", () => {
  const r = renewal({ renewalDate: "2024-01-01", noticeMonths: 1 }, new Date(2026, 9, 23));
  assert.equal(r.next.getFullYear(), 2027);
  assert.equal(r.next.getMonth(), 0);
  assert.equal(r.cancelBy.getMonth(), 11);
  assert.equal(r.cancelBy.getFullYear(), 2026);
  assert.ok(r.canStillCancel);
  assert.equal(renewal({ renewalDate: null, noticeMonths: 1 }, new Date()), null);
});

test("coverage check follows your situation", () => {
  const items = coverageCheck([{ kind: "health", premium: 1, period: "month", deductible: 0, renewalDate: null, noticeMonths: 1 }], { ownsHome: true, hasMortgage: true, hasCar: false, country: "NL", health: "required" });
  const by = Object.fromEntries(items.map((i) => [i.kind, i]));
  assert.equal(by.health.importance, "required");
  assert.ok(by.health.have);
  assert.ok(by.home && !by.home.have);
  assert.ok(by.life);
  assert.equal(by.car, undefined);
});

test("health insurance follows the country, not the language", () => {
  const health = (country) => coverageCheck([], { ownsHome: false, hasMortgage: false, hasCar: false, country, health: healthRule(country), countryName: country }).find((i) => i.kind === "health");
  assert.equal(health("NL").importance, "required");
  assert.equal(health("DE").vars.country, "DE");
  assert.equal(health("GB").importance, "optional");
  assert.equal(health("US").importance, "recommended");
  assert.equal(health(null).importance, "recommended");
});

test("a country guess is a two-letter code or nothing", () => {
  const c = guessCountry();
  assert.ok(c === null || /^[A-Z]{2}$/.test(c));
});
