// Repayments of a debt (Bart, 25 Nov): an expense marked `repays` (a loan or
// a mortgage part) isn't spending, leaves its account, lowers that debt and
// leaves equity as it was. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./tsAlias.mjs", import.meta.url);
const { accountFlows, balanceSheet, netWorthFigures, summarize } = await import("../calc.ts");
const { buildDemoData } = await import("../demo.ts");
const { withAdvances } = await import("../advances.ts");
const { withRepayments, repaidIn } = await import("../repayments.ts");
const { liveLoans, loanAt } = await import("../loans.ts");
const { homes } = await import("../realEstate.ts");
const { summarize: summarizePart } = await import("../mortgage.ts");

const now = new Date(2026, 10, 25, 14, 0);
const nov = new Date(2026, 10, 1);
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≠ ${b}`);
const meta = { updated_at: "", deleted_at: null, is_auto_income: false, is_fixed_expense: false, recurrence_id: null, category_id: null, gross_amount: null };

function setup(repayments = []) {
  const d = buildDemoData(now);
  const loan = { id: "loan", updated_at: "", deleted_at: null, name: "Studieschuld", kind: "student", balance: "10000.00", rate: "2.00", monthly: "200.00", start_date: "2026-06-15", sort_order: 0 };
  const raw = { ...d, loans: [loan], transactions: [...d.transactions, ...repayments] };
  return { raw, data: withRepayments(withAdvances(raw)), account: d.accounts[0].id, part: d.mortgageParts.find((p) => !p.deleted_at) };
}
const repay = (id, amount, day, account) => ({ ...meta, id: `r-${id}-${day}`, type: "expense", amount: amount.toFixed(2), date: new Date(2026, 10, day, 12).toISOString(), note: "Aflossing", account_id: account, repays: id });

test("a repayment is not spending", () => {
  const base = setup();
  const { data } = setup([repay("loan", 1000, 10, base.account)]);
  close(summarize(data.transactions, nov).spent, summarize(base.data.transactions, nov).spent);
  close(repaidIn(data, nov), 1000);
  assert.equal(data.repayments.length, 1);
});

test("it leaves its account", () => {
  const base = setup();
  const { data, account } = setup([repay("loan", 1000, 10, base.account)]);
  close(accountFlows(data, now).get(account), accountFlows(base.data, now).get(account) - 1000);
});

test("a loan goes down by the extra, from that day", () => {
  const base = setup();
  const { data } = setup([repay("loan", 1000, 10, base.account)]);
  const before = loanAt(liveLoans(base.data)[0], now).balance;
  const after = loanAt(liveLoans(data)[0], now).balance;
  close(before - after, 1000);
  // Not before the day it was made.
  close(loanAt(liveLoans(data)[0], new Date(2026, 10, 9)).balance, loanAt(liveLoans(base.data)[0], new Date(2026, 10, 9)).balance);
  // Next month's payment works on the lower debt: less interest, so more off.
  const dec = new Date(2026, 11, 5);
  assert.ok(loanAt(liveLoans(base.data)[0], dec).balance - loanAt(liveLoans(data)[0], dec).balance > 1000);
});

test("a mortgage part goes down by the extra", () => {
  const base = setup();
  const { data, part } = setup([repay(base.part.id, 5000, 12, base.account)]);
  const debt = (d) => homes(d).flatMap((h) => h.parts).filter((p) => p.id === part.id).reduce((t, p) => t + summarizePart(p, now).balance, 0);
  close(debt(base.data) - debt(data), 5000);
});

test("equity stays the same, liquidity goes down", () => {
  const base = setup();
  const { data } = setup([repay("loan", 1000, 10, base.account), repay(base.part.id, 2000, 12, base.account)]);
  const bs0 = balanceSheet(base.data, now, nov), bs1 = balanceSheet(data, now, nov);
  close(bs1.equity, bs0.equity);
  close(bs0.totalDebt - bs1.totalDebt, 3000);
  const nw0 = netWorthFigures(base.data, now), nw1 = netWorthFigures(data, now);
  close(nw0.liveChange(now.getTime()) - nw1.liveChange(now.getTime()), 3000);
});
