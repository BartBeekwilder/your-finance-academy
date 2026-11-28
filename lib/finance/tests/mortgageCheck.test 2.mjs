// The mortgage as booked against its schedule — Bart's November 2026: two
// annuity parts (€174,698 over 334 months + €255,302 over 360, 3.85%) cost
// €2,047.22 a month; a statement read only €1,118.86; the tax office pays
// €628 back each month. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./tsAlias.mjs", import.meta.url);
const { isMortgageName, mortgageMonth } = await import("../mortgageCheck.ts");

const syn = { updated_at: "", deleted_at: null };
const nov = new Date(2026, 10, 1);
const part = (id, principal, term) => ({ ...syn, id, property_id: "home", name: id, kind: "annuity", principal, rate: "3.85", fixed_until: null, start_date: "2025-12-01", term_months: term, nhg: false, extra_monthly: "0.00", sort_order: 0 });
const tx = (id, type, amount, note, category_id, day = 27) => ({ ...syn, id, type, amount, note, category_id, date: new Date(2026, 10, day, 12).toISOString(), is_auto_income: false, is_fixed_expense: type === "expense", recurrence_id: null, account_id: "acct" });
const close = (a, b, d = 0.01) => assert.ok(Math.abs(a - b) < d, `${a} ≠ ${b}`);

function bart(transactions) {
  return {
    profile: {}, accounts: [], budgets: [], incomeRecords: [], holdings: [],
    categories: [{ ...syn, id: "hyp", name: "Hypotheek", parent_id: null, is_income_category: false }, { ...syn, id: "ov", name: "Overig inkomen", parent_id: null, is_income_category: true }],
    properties: [{ ...syn, id: "home", name: "Huis", value: "600000", value_date: null, purchase_price: null, purchase_date: null, country: "NL", sort_order: 0 }],
    mortgageParts: [part("101", "174698.00", 334), part("102", "255302.00", 360)],
    transactions,
  };
}

test("mortgage names in the app's languages", () => {
  for (const n of ["Hypotheek", "Mortgage", "Hypothek", "Hipoteca", "Prêt immobilier", "住宅ローン", "房贷"]) assert.ok(isMortgageName(n), n);
  for (const n of ["Huur", "Rent", "Energie", null]) assert.equal(isMortgageName(n), false);
});

test("on schedule: the parts' payment, split into interest and repayment", () => {
  const m = mortgageMonth(bart([]), nov);
  close(m.expected, 2050, 5);
  close(m.interest + m.repayment, m.expected);
  assert.ok(m.interest > m.repayment);
  assert.equal(m.booked, 0);
  assert.equal(m.off, false); // nothing booked: nothing to warn about
});

test("a partly booked payment is flagged; the refund makes it net", () => {
  const m = mortgageMonth(bart([tx("a", "expense", "1118.86", "Hypotheek", "hyp"), tx("r", "income", "628.00", "Belastingdienst (voorlopige teruggaaf nov)", "ov", 16)]), nov);
  close(m.booked, 1118.86);
  close(m.refund, 628);
  assert.equal(m.off, true);
  close(m.net, 1118.86 - 628);
});

test("the full payment matches; net is what Bart used to book (≈ €1,418)", () => {
  const m = mortgageMonth(bart([tx("a", "expense", "2047.22", "Hypotheek", "hyp"), tx("r", "income", "628.00", "Belastingdienst (voorlopige teruggaaf nov)", "ov", 16)]), nov);
  assert.equal(m.off, false);
  close(m.net, 1419.22);
});

test("two debits (one per part) add up", () => {
  const m = mortgageMonth(bart([tx("a", "expense", "1118.86", "Hypotheek", "hyp"), tx("b", "expense", "928.36", "Hypotheek deel 2", "hyp", 28)]), nov);
  close(m.booked, 2047.22);
  assert.equal(m.off, false);
});

test("no mortgage parts: no check", () => {
  assert.equal(mortgageMonth({ ...bart([]), mortgageParts: [] }, nov), null);
});
