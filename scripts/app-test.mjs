// Automated app tests on fictional data (Bart, 19 Nov): every page on a
// laptop and a phone, in a few languages, plus the PDF reports and a month
// close. Per page it records script errors, failed requests, sideways
// overflow, raw placeholders ("{month}"), NaN / undefined / Infinity in the
// text, and PDF sheets whose content runs past the page.
//   npm i --no-save puppeteer-core jiti
//   npx next dev -p 3000 -H localhost
//   node scripts/app-test-data.mjs          (fresh fictional data)
//   node scripts/app-test.mjs [nl en ar ja] → out/app-test/report.json + screenshots
// The browser carries the cookie pf-local-file=test, so the dev server reads
// and writes .private/test/finance.json — never the real data file.
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const B = "http://localhost:3000";
const OUT = "out/app-test";
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["nl", "en", "ar", "ja"];
const PAGES = ["", "income", "expenses", "transactions", "categories", "budgets", "balance", "net-worth", "figures", "investments", "real-estate", "loans", "insurance", "rent-vs-buy", "progress", "glossary", "settings"];
const VIEWS = { laptop: { width: 1440, height: 900 }, phone: { width: 390, height: 844, isMobile: true, hasTouch: true } };
// Known and harmless on the dev server: no billing keys, quotes may be missing.
const IGNORE = [/\/api\/billing\/(status|prices)/, /status of 503/, /favicon/, /_next\/webpack-hmr/, /\/api\/quotes/];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--hide-scrollbars"] });
const page = await browser.newPage();
page.on("dialog", (d) => d.dismiss());
await page.setCookie({ name: "pf-local-file", value: "test", domain: "localhost", path: "/" });

const issues = [];
let ctx = "";
const add = (kind, detail) => issues.push({ where: ctx, kind, detail: String(detail).slice(0, 300) });
page.on("pageerror", (e) => add("script error", e.message));
page.on("console", (m) => { if (m.type() === "error" && !IGNORE.some((r) => r.test(m.text() + (m.location()?.url ?? "")))) add("console error", m.text()); });
page.on("response", (r) => { if (r.status() >= 400 && !IGNORE.some((x) => x.test(r.url()))) add(`HTTP ${r.status()}`, r.url()); });

// Text checks on what's on screen.
async function inspect(retry = true) {
  // The dev server can reload a page mid-check (a rebuild): wait and look again once.
  const r = await page.evaluate(() => {
    const text = document.body.innerText;
    const over = document.documentElement.scrollWidth - innerWidth;
    // Elements that stick out on the right (the culprit of a sideways scroll).
    const wide = over > 1 ? [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); return b.right > innerWidth + 1 && b.width > 0 && getComputedStyle(e).position !== "fixed"; }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`) : [];
    return {
      over,
      wide,
      placeholders: [...new Set(text.match(/\{[a-zA-Z]+\}/g) ?? [])],
      bad: [...new Set(text.match(/\b(NaN|undefined|Infinity|null)\b/g) ?? [])],
      error: /Something went wrong|Application error|Unhandled Runtime Error/i.test(text),
    };
  }).catch(async (e) => {
    if (!retry) { add("check failed", e.message); return null; }
    await sleep(3000);
    await inspect(false);
    return null;
  });
  if (!r) return;
  if (r.over > 1) add("sideways overflow", `${r.over}px · ${r.wide.join(", ")}`);
  if (r.placeholders.length) add("raw placeholder", r.placeholders.join(" "));
  if (r.bad.length) add("bad value in text", r.bad.join(" "));
  if (r.error) add("error screen", "the page shows an error");
}

async function open(path, wait = 2500) {
  await page.goto(`${B}${path}`, { waitUntil: "load", timeout: 60000 }).catch((e) => add("load", e.message));
  await sleep(wait);
}

for (const lang of langs) {
  for (const [view, vp] of Object.entries(VIEWS)) {
    await page.setViewport(vp);
    ctx = `${lang} ${view} start`;
    await open("/app?local=1", 1500);
    await page.evaluate((l) => localStorage.setItem("pf-lang", l), lang);
    for (const p of PAGES) {
      ctx = `${lang} ${view} /app/${p}`;
      await open(`/app/${p}`);
      await inspect();
      if (lang === langs[0]) await page.screenshot({ path: `${OUT}/${view}-${p || "dashboard"}.png` });
    }
  }

  // PDF reports: every sheet's content must fit on its page.
  await page.setViewport(VIEWS.laptop);
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const key = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  for (const q of [`month=${key}`, `year=${now.getFullYear()}`]) {
    ctx = `${lang} report ${q}`;
    await open(`/app/report?${q}`, 5000);
    await inspect();
    const sheets = await page.evaluate(() => [...document.querySelectorAll(".rp-page")].map((p) => { const b = p.querySelector(".rp-body"); return b ? b.scrollHeight - b.clientHeight : 0; }));
    if (!sheets.length) add("report", "no sheets rendered");
    sheets.forEach((d, i) => { if (d > 2) add("report page overflows", `page ${i + 1}: ${d}px too long`); });
    if (lang === langs[0]) await page.pdf({ path: `${OUT}/report-${q.split("=")[0]}.pdf`, format: "A4", printBackground: true }).catch((e) => add("pdf", e.message));
  }
}

// A month close, end to end, on the fictional data (first language only).
await page.setViewport(VIEWS.laptop);
ctx = `${langs[0]} month close`;
await page.evaluate((l) => localStorage.setItem("pf-lang", l), langs[0]);
await open("/app/close", 3000);
await inspect();
for (let i = 0; i < 8; i++) {
  const done = await page.evaluate(() => {
    // The step's own Continue / Close button (not the round + button).
    const btns = [...document.querySelectorAll("section.pf-close-step + div .pf-button")];
    const last = btns[btns.length - 1];
    if (!last || last.disabled) return "stuck";
    const isClose = !last.querySelector("svg");
    last.click();
    return isClose ? "closed" : "next";
  });
  await sleep(1800);
  await inspect();
  if (done === "closed") break;
  if (done === "stuck") { add("month close", "no enabled button to go on"); break; }
}
const celebration = await page.evaluate(() => ({ shown: !!document.querySelector(".pf-celebrate"), print: !!document.querySelector(".pf-celebrate-action") }));
if (!celebration.shown) add("month close", "no celebration after closing");
else if (!celebration.print) add("month close", "no print button in the celebration");
await page.screenshot({ path: `${OUT}/close-done.png` });

await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(issues, null, 1));
const byKind = {};
for (const i of issues) (byKind[i.kind] ??= []).push(i);
console.log(`${issues.length} issues`);
for (const [k, list] of Object.entries(byKind)) {
  console.log(`\n## ${k} (${list.length})`);
  for (const i of list.slice(0, 25)) console.log(`- ${i.where}: ${i.detail}`);
}
