// The homepage's app screenshots per language (Month Wrapped wr-0..5, iPad
// stand st-*, laptop setup ob-*), from the demo data on the local dev server.
//   npm i --no-save puppeteer-core   (drives the installed Google Chrome)
//   npx next dev -p 3000 -H localhost
//   node scripts/home-shots.mjs en de nl …   → out/<lang>/*.png
// Then convert to public/home/img/<lang>/*.webp (same names; stand 1600×1154,
// setup 1600×1059, Wrapped 1100 wide).
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const B = "http://localhost:3000";
const langs = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--hide-scrollbars"] });
const page = await browser.newPage();
page.on("dialog", (d) => d.dismiss());
for (const lang of langs) {
  const out = `out/${lang}`; fs.mkdirSync(out, { recursive: true });
  // Stand screens
  await page.setViewport({ width: 1400, height: 1010, deviceScaleFactor: 1600 / 1400 });
  await page.goto(`${B}/app?demo=1`, { waitUntil: "networkidle2" });
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem("pf-lang", l); }, lang);
  for (const p of ["balance", "budgets", "figures", "investments", "progress"]) {
    await page.goto(`${B}/app/${p}?demo=1`, { waitUntil: "networkidle2" });
    await sleep(3500);
    await page.screenshot({ path: `${out}/st-${p}.png` });
  }
  // Month Wrapped cards
  await page.setViewport({ width: 1400, height: 1100, deviceScaleFactor: 2 });
  await page.goto(`${B}/app/close?demo=1`, { waitUntil: "networkidle2" });
  await sleep(2500);
  await page.evaluate(() => { const b = document.querySelectorAll("button[data-state]"); b[2]?.click(); });
  await sleep(2500);
  for (let i = 0; i < 6; i++) {
    for (let k = 0; ; k++) {
      try { const card = await page.$(".pf-wr-card"); await card.screenshot({ path: `${out}/wr-${i}.png` }); break; }
      catch (e) { if (k > 4) throw e; await sleep(1500); }
    }
    await page.evaluate(() => [...document.querySelectorAll(".pf-wr button")].find((b) => b.getAttribute("aria-label") && b === [...document.querySelectorAll(".pf-wr button[aria-label]")].pop())?.click());
    await sleep(1800);
  }
  // Onboarding
  const hideTest = () => page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Test: fill"); const d = document.querySelector(".pf-ob-drafts"); if (d) d.style.display = "none"; document.activeElement?.blur?.(); document.querySelectorAll("*").forEach((e) => { if (e.scrollLeft) e.scrollLeft = 0; }); window.scrollTo(0, scrollY); });
  await page.setViewport({ width: 1400, height: 927, deviceScaleFactor: 1600 / 1400 });
  await page.goto(`${B}/app/welcome?demo=1`, { waitUntil: "networkidle2" });
  await sleep(2000);
  let draft = null;
  for (let k = 0; k < 6; k++) {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Test: fill")?.click());
    await sleep(3000);
    draft = await page.evaluate(() => localStorage.getItem("pf-onboarding-preview-draft"));
    if (draft && JSON.parse(draft).net === "3800") break;
    draft = null;
  }
  if (!draft) throw new Error(`no test draft for ${lang}`);
  for (const [name, step, bottom] of [["route", "route", false], ["fixed", "fixed", true], ["subs", "subscriptions", false], ["mortgage", "balance", false]]) {
    await page.evaluate((d, s) => { const o = JSON.parse(d); o.step = s; localStorage.setItem("pf-onboarding-preview-draft", JSON.stringify(o)); }, draft, step);
    await page.reload({ waitUntil: "networkidle2" });
    await sleep(3000);
    if (bottom) { await page.evaluate(() => { const n = document.querySelector(".pf-ob-nav"); const r = n.getBoundingClientRect(); const dy = r.bottom - innerHeight + 30; let p = n.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement; (p || document.scrollingElement).scrollTop += dy; document.querySelectorAll("*").forEach((e) => { if (e.scrollLeft) e.scrollLeft = 0; }); document.activeElement?.blur?.(); }); await sleep(800); }
    await hideTest(); await sleep(400);
    await page.screenshot({ path: `${out}/ob-${name}.png` });
  }
  // Tour: finish from the last step
  await page.evaluate((d) => { const o = JSON.parse(d); o.step = "done"; localStorage.setItem("pf-onboarding-preview-draft", JSON.stringify(o)); }, draft);
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(2500);
  await page.evaluate(() => document.querySelector(".pf-ob-nav .pf-button")?.click());
  await sleep(4000);
  await hideTest(); await sleep(400);
  await page.screenshot({ path: `${out}/ob-tour.png` });
  console.log("done", lang);
}
await browser.close();
