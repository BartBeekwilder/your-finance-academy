// Enter something, check it shows up everywhere, take it out again (Bart,
// 19 Nov). On fresh fictional data (the browser carries pf-local-file=test,
// so the dev server only touches .private/test/finance.json).
//   npx next dev -p 3000 -H localhost   (running)
//   node scripts/app-e2e.mjs
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const B = "http://localhost:3000";
const FILE = ".private/test/finance.json";
execFileSync(process.execPath, ["scripts/app-test-data.mjs"], { stdio: "ignore" });

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("dialog", (d) => d.accept());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setCookie({ name: "pf-local-file", value: "test", domain: "localhost", path: "/" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

// "€1,234.56" / "-€1,234.56" / "€ +1,234.56" (English format) → number.
const num = (s) => {
  const m = String(s).replace(/\s/g, "").match(/([+−-]?)€?([+−-]?)([\d,]+(?:\.\d+)?)/);
  if (!m) return NaN;
  const sign = (m[1] || m[2]).replace("−", "-") === "-" ? -1 : 1;
  return sign * Number(m[3].replace(/,/g, ""));
};
async function open(path, wait = 3500) {
  await page.goto(B + path, { waitUntil: "load", timeout: 60000 });
  await sleep(wait);
}
// The value printed right after a label on the page (first match).
async function after(label) {
  return page.evaluate((label) => {
    const lines = document.body.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
    const i = lines.findIndex((l) => l === label || l.startsWith(label + " "));
    if (i < 0) return null;
    const own = lines[i].slice(label.length).trim();
    return /€/.test(own) ? own : lines[i + 1];
  }, label);
}
const fileData = () => JSON.parse(fs.readFileSync(FILE, "utf8"));

// What the screens say now.
async function snapshot() {
  await open("/app/net-worth");
  const liquidity = num(await after("Liquidity now"));
  await open("/app/report?month=" + new Date().toISOString().slice(0, 7), 5000);
  const kpis = await page.evaluate(() => [...document.querySelectorAll(".rp-page")][0]?.querySelectorAll(".rp-kpi-value").length ? [...[...document.querySelectorAll(".rp-page")][0].querySelectorAll(".rp-kpi-value")].map((e) => e.textContent) : []);
  await open("/app/income");
  const received = num(await after("Received this month"));
  await open("/app/transactions");
  const rows = await page.evaluate(() => document.querySelectorAll(".pf-row-delete").length);
  return { liquidity, reportIncome: num(kpis[0]), reportSpent: num(kpis[1]), received, rows };
}

await open("/app?local=1", 2500);
await page.evaluate(() => localStorage.setItem("pf-lang", "en"));
const before = await snapshot();

// Quick Add: an expense and an income, today.
async function quickAdd(type, amount, note) {
  await open("/app", 3000);
  await page.click('[aria-label="Quick Add"]');
  await sleep(900);
  if (type === "income") {
    await page.evaluate(() => [...document.querySelectorAll(".pf-seg-option")].find((b) => b.textContent.trim() === "Income")?.click());
    await sleep(400);
  }
  await page.type('input[aria-label="Amount"]', amount);
  // The first category chip of the form.
  await page.evaluate(() => {
    const form = document.querySelector('input[aria-label="Amount"]').closest("form");
    [...form.querySelectorAll(".pf-chip")].find((c) => !c.classList.contains("pf-chip-new"))?.click();
  });
  await sleep(300);
  await page.type('input[aria-label="Note"]', note);
  // Today (an income in the main income category starts on the payday).
  await page.evaluate(() => {
    const el = document.querySelector('input[aria-label="Date"]'), d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, today);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(200);
  await page.evaluate(() => document.querySelector('input[aria-label="Amount"]').closest("form").querySelector("button.pf-button").click());
  await sleep(2500);
}
await quickAdd("expense", "123.45", "E2E test expense");
await quickAdd("income", "500", "E2E test income");

const saved = fileData().transactions.filter((t) => /^E2E test/.test(t.note ?? "") && !t.deleted_at);
check("both entries saved to the data file", saved.length === 2, saved.map((t) => `${t.type} ${t.amount} on ${t.date}`).join(", "));
check("expense saved with the right amount", saved.some((t) => t.type === "expense" && Number(t.amount) === 123.45));
check("income saved with the right amount", saved.some((t) => t.type === "income" && Number(t.amount) === 500));

const mid = await snapshot();
check("Transactions: two more rows", mid.rows === before.rows + 2, `${before.rows} → ${mid.rows}`);
check("Income: received +500", near(mid.received - before.received, 500), `${before.received} → ${mid.received}`);
check("Report: income +500", near(mid.reportIncome - before.reportIncome, 500), `${before.reportIncome} → ${mid.reportIncome}`);
check("Report: spent +123.45", near(mid.reportSpent - before.reportSpent, 123.45), `${before.reportSpent} → ${mid.reportSpent}`);
// Liquidity runs live (pay by the second, live market quotes): allow some drift.
check("Liquidity: +376.55 (500 − 123.45)", near(mid.liquidity - before.liquidity, 376.55, 10), `${before.liquidity} → ${mid.liquidity}`);

// Take both out again on the Transactions page.
await open("/app/transactions");
for (const note of ["E2E test expense", "E2E test income"]) {
  await page.evaluate((note) => document.querySelector(`[aria-label="Delete ${note}"]`)?.click(), note);
  await sleep(1500);
}
const left = fileData().transactions.filter((t) => /^E2E test/.test(t.note ?? "") && !t.deleted_at);
check("both entries deleted from the data file", left.length === 0, `${left.length} left`);
const after2 = await snapshot();
check("Transactions: back to the start", after2.rows === before.rows, `${before.rows} → ${after2.rows}`);
check("Report: back to the start", near(after2.reportSpent, before.reportSpent) && near(after2.reportIncome, before.reportIncome));
check("Income: back to the start", near(after2.received, before.received));
check("Liquidity: back to the start", near(after2.liquidity, before.liquidity, 10), `${before.liquidity} → ${after2.liquidity}`);
check("no script errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`${results.length} checks, ${bad.length} failed`);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
process.exit(bad.length ? 1 : 0);
