// Income rules: what counts as salary, the month's expected net, other
// income and the live month-to-date — Bart's November (25 Nov 2026): the
// payslip landed on a €900 one-off and kept its title and date (the 18th),
// the €900 was added again in "Overig inkomen", plus a small refund; the
// salary is in the plain income category and the expected net comes from an
// income record. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./tsAlias.mjs", import.meta.url);
const { bookedSalary, categoryYear, monthToDate, otherIncome, projectedNetIncome, salaryTest, summarize, yearForecast } = await import("../calc.ts");
const { buildDemoData } = await import("../demo.ts");

const now = new Date(2026, 10, 25, 14, 0);
const nov = new Date(2026, 10, 1);
const at = (d) => new Date(2026, 10, d, 12).toISOString();
const meta = { updated_at: "", deleted_at: null, is_auto_income: false, is_fixed_expense: false, recurrence_id: null, account_id: "acct", gross_amount: null };
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≠ ${b}`);

function bart({ withSalary = true, record = true, expected = null } = {}) {
  const d = buildDemoData(now);
  const other = { ...d.categories[0], id: "other", name: "Overig inkomen", is_income_category: true, parent_id: null };
  const salaris = { ...d.categories[0], id: "salaris", name: "Salaris", is_income_category: true, parent_id: null };
  const plain = { ...d.categories[0], id: "plain", name: "Inkomen", is_income_category: true, parent_id: null };
  const tx = [
    { ...meta, id: "refund", type: "income", amount: "26.05", date: at(3), note: "Terugbetaling", category_id: "other" },
    { ...meta, id: "oneoff", type: "income", amount: "900.00", date: at(18), note: "Tegemoetkoming Dubai-reis", category_id: "other" },
  ];
  if (withSalary) tx.push({ ...meta, id: "salary", type: "income", amount: "4630.70", gross_amount: "6450.00", date: at(18), note: "Tegemoetkoming Dubai-reis", category_id: "plain" });
  return {
    ...d,
    profile: { ...d.profile, expected_net_monthly: expected },
    categories: [...d.categories, other, salaris, plain],
    // Only November's income is Bart's; the rest of the demo stays.
    transactions: [...d.transactions.filter((t) => !(t.type === "income" && t.date.startsWith("2026-11"))), ...tx],
    incomeRecords: record ? [{ id: "r", updated_at: "", deleted_at: null, month: "2026-11-01", gross_amount: "6300.00", net_amount: "4547.33", is_actual: false, confirmed_date: null, transaction_id: null }] : [],
  };
}

test("salary: at least half the usual net (from the income record), whatever its title", () => {
  const data = bart();
  const salaryLike = salaryTest(data);
  const byId = Object.fromEntries(data.transactions.map((t) => [t.id, t]));
  assert.equal(salaryLike(byId.salary), true);
  assert.equal(salaryLike(byId.oneoff), false);
  assert.equal(salaryLike(byId.refund), false);
});

test("a booked salary replaces the expected net — never on top of it", () => {
  const data = bart();
  close(bookedSalary(data, nov), 4630.7);
  close(projectedNetIncome(data, nov), 4630.7);
  close(otherIncome(data, nov), 926.05);
  // Received this month: everything that came in.
  close(summarize(data.transactions, nov).income, 5556.75);
  // Expected this month: the salary once, plus the other income.
  close(yearForecast(data, now)[0].income, 4630.7 + 926.05);
});

test("before the salary is in, the income record is the expectation", () => {
  const data = bart({ withSalary: false });
  close(projectedNetIncome(data, nov), 4547.33);
  close(otherIncome(data, nov), 926.05);
  close(yearForecast(data, now)[0].income, 4547.33 + 926.05);
});

test("live month-to-date: the salary accrues once, other income on its day", () => {
  const data = bart();
  const { points } = monthToDate(data, now);
  const f = (now.getTime() - nov.getTime()) / (30 * 86_400_000);
  close(points.at(-1).income, 4630.7 * f + 926.05);
  // The 17th: only the refund is in besides the accrual.
  close(points[16].income, 4630.7 * (17 / 30) + 26.05);
  // Never the €9,347 of 25 Nov (the salary counted twice).
  assert.ok(points.at(-1).income < 5556.75);
});

test("no settings and no record: only a salary-named category is salary", () => {
  const data = bart({ record: false });
  const salaryLike = salaryTest(data);
  const salary = data.transactions.find((t) => t.id === "salary");
  assert.equal(salaryLike(salary), false);
  assert.equal(salaryLike({ ...salary, category_id: "salaris" }), true);
});

test("expected net from settings wins over the record for the usual net", () => {
  const data = bart({ expected: "10000.00" });
  // 4630.70 is under half of 10 000 now: other income.
  assert.equal(salaryTest(data)(data.transactions.find((t) => t.id === "salary")), false);
});

test("a category's own year counts its income (the Other income sheet)", () => {
  const data = bart();
  const other = data.categories.find((c) => c.id === "other");
  const { months } = categoryYear(data, other, now);
  close(months[10].total, 926.05);
});

test("Other income is a choice: never the salary, whatever the amount; Salary always is", () => {
  const data = bart();
  const salaryLike = salaryTest(data);
  const salary = data.transactions.find((t) => t.id === "salary");
  assert.equal(salaryLike({ ...salary, category_id: "other" }), false);
  assert.equal(salaryLike({ ...salary, amount: "100.00", category_id: "salaris" }), true);
  // A subcategory follows its parent.
  data.categories.push({ ...data.categories.find((c) => c.id === "salaris"), id: "bonus", name: "Bonus", parent_id: "salaris" });
  assert.equal(salaryTest(data)({ ...salary, amount: "100.00", category_id: "bonus" }), true);
});

test("a month ahead without its own record expects the usual net, not €0", () => {
  const data = bart();
  const forecast = yearForecast(data, now);
  close(forecast[1].income, 4547.33);
  close(projectedNetIncome(data, new Date(2026, 11, 1)), 4547.33);
});
