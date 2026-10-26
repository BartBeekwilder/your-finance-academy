// Salary helpers. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSalaryName, mainIncomeCategory, nearestPayday } from "../salary.ts";

test("salary-like category names", () => {
  assert.ok(isSalaryName("Salaris"));
  assert.ok(isSalaryName("Netto loon"));
  assert.ok(isSalaryName("Salary"));
  assert.ok(!isSalaryName("Overig inkomen"));
  assert.ok(!isSalaryName(null));
});

test("the payday nearest a date", () => {
  const day = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  assert.equal(day(nearestPayday(24, new Date(2026, 9, 26))), "2026-10-24");
  assert.equal(day(nearestPayday(25, new Date(2026, 9, 3))), "2026-9-25");
  assert.equal(day(nearestPayday(1, new Date(2026, 9, 29))), "2026-11-1");
  assert.equal(day(nearestPayday(31, new Date(2026, 1, 20))), "2026-2-28");
});

test("the category the salary usually lands in", () => {
  const tx = [
    { type: "income", amount: "3000", category_id: "inc" },
    { type: "income", amount: "3100", category_id: "inc" },
    { type: "income", amount: "40", category_id: "other" },
    { type: "income", amount: "2500", category_id: "bonus" },
    { type: "expense", amount: "5000", category_id: "rent" },
  ];
  assert.equal(mainIncomeCategory(tx, 3000), "inc");
  assert.equal(mainIncomeCategory(tx, 0), null);
});
