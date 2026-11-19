// Do the numbers agree with each other? (Bart, 19 Nov: "kijken of alles
// overal klopt"). Read-only: runs the app's own calculations on a data file
// and checks that the different screens' figures add up.
//   node scripts/app-consistency.mjs [file]   (default: .private/test/finance.json)
import { createJiti } from "jiti";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const j = createJiti(import.meta.url, { alias: { "@": root } });
const calc = await j.import(path.join(root, "lib/finance/calc.ts"));
const { monthReport } = await j.import(path.join(root, "lib/finance/monthReport.ts"));
const { moneyModelBase } = await j.import(path.join(root, "components/finance/MoneyModel.tsx")).catch(() => ({}));

const { withAdvances } = await j.import(path.join(root, "lib/finance/advances.ts"));
const file = process.argv[2] ?? ".private/test/finance.json";
// As every screen sees it: advances apart (they aren't spending).
const data = withAdvances(JSON.parse(fs.readFileSync(file, "utf8")));
const now = new Date();
const y = now.getFullYear(), mo = now.getMonth();
const thisMonth = new Date(y, mo, 1), lastMonth = new Date(y, mo - 1, 1);

const fails = [];
let checks = 0;
const eur = (x) => (Math.round(x * 100) / 100).toFixed(2);
function same(name, a, b, tol = 0.01) {
  checks++;
  if (!(Math.abs(a - b) <= tol)) fails.push(`${name}: ${eur(a)} vs ${eur(b)} (diff ${eur(a - b)})`);
}
function ok(name, cond, detail = "") {
  checks++;
  if (!cond) fails.push(`${name}${detail ? `: ${detail}` : ""}`);
}

// Month figures: the report, the per-day chart, the categories and the raw list.
for (const [label, m] of [["this month", thisMonth], ["last month", lastMonth]]) {
  const r = monthReport(data, m, now);
  const s = calc.summarize(data.transactions, m);
  const tx = calc.live(data.transactions).filter((t) => calc.inMonth(t, m));
  same(`${label}: report spent = summary spent`, r.spent, s.spent);
  same(`${label}: report income = income transactions`, r.income, tx.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0));
  same(`${label}: per-day chart income = report income`, r.perDay.reduce((a, d) => a + d.income, 0), r.income);
  same(`${label}: per-day chart spending = report spent`, r.perDay.reduce((a, d) => a + d.fixed + d.variable, 0), r.spent);
  same(`${label}: fixed + variable = spent`, r.fixedTotal + r.variableTotal, r.spent);
  const cats = r.categories.reduce((a, c) => a + (c.spent ?? c.total ?? 0), 0);
  same(`${label}: categories add up to spent`, cats, r.spent);
  same(`${label}: fixed list = fixed total`, r.fixed.reduce((a, t) => a + Number(t.amount), 0), r.fixedTotal);
}

// Liquidity: one model behind the dashboard tile, the Liquidity page and the waterfalls.
const nw = calc.netWorthFigures(data, now);
same("liquidity: start of month = 1 January + finished months", nw.base, nw.startOfYear + nw.finished.reduce((a, v) => a + v, 0));
same("liquidity: change this month = work + market", nw.liveChange(now.getTime()), nw.workChange(now.getTime()) + nw.marketChange(now.getTime()));
same("liquidity: market change at the 1st is zero", nw.marketChange(thisMonth.getTime() - 1), 0, 0.5);
const fc = calc.yearForecast(data, now);
ok("forecast: this month spends at least what's booked", fc[0].spent + 0.01 >= calc.summarize(data.transactions, thisMonth).spent, `${eur(fc[0].spent)} < ${eur(calc.summarize(data.transactions, thisMonth).spent)}`);

// Balance sheet: assets − debts = equity; the money model starts from it.
const bs = calc.balanceSheet(data, now, thisMonth);
same("balance sheet: assets − debts = equity", bs.totalAssets - bs.totalDebt, bs.equity);
same("balance sheet: asset lines add up", bs.assets.reduce((a, l) => a + l.value, 0), bs.totalAssets);
same("balance sheet: debt lines add up", bs.liabilities.reduce((a, l) => a + l.value, 0), bs.totalDebt);
if (moneyModelBase) {
  const b = moneyModelBase(data, now);
  same("money model: equity now = balance sheet equity", b.cash + b.invest + b.home - b.mortgage - b.otherDebt, bs.equity);
  ok("money model: no negative month parts", b.income >= 0 && b.fixed >= 0 && b.repay >= 0 && b.variable >= 0, JSON.stringify(b));
}

// The report's equity line is the balance sheet's.
same("report equity = balance sheet equity", monthReport(data, thisMonth, now).equity, bs.equity, 0.5);

console.log(`${file}: ${checks} checks, ${fails.length} off`);
for (const f of fails) console.log("  ✗ " + f);
process.exit(fails.length ? 1 : 0);
