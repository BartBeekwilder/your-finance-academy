// Translations for the website.
//   node scripts/i18n.mjs extract          → lists every t("…") text in the
//                                             code into lib/i18n/keys.json
//   node scripts/i18n.mjs seed <xcstrings>  → fills missing translations from
//                                             the iOS app's Localizable.xcstrings
//                                             (same English text = same key)
//   node scripts/i18n.mjs report           → per language: how many are missing
// Message files: lib/i18n/messages/<lang>.json (English text → translation).
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MSG = join(ROOT, "lib/i18n/messages");
const KEYS = join(ROOT, "lib/i18n/keys.json");
// Texts translated through a variable (menu labels, onboarding lists…).
const EXTRA = [
  "Dashboard", "Income", "Expenses", "Net worth", "Balance sheet", "Investments", "Transactions", "Categories", "Budgets",
  "Euro", "US dollar", "British pound", "Swiss franc", "Swedish krona", "Japanese yen",
  "Rent or mortgage", "Energy & water", "Insurance", "Internet & phone", "Subscriptions", "Car or transit pass",
  "Groceries", "Dining out", "Transport", "Shopping", "Entertainment", "Health",
  "Crypto", "Stock", "Metal",
  ...["Spending", "Income"].flatMap((k) => ["month", "day"].flatMap((p) => ["category", "source"].map((g) => `${k} per ${p} by ${g}`))),
];

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(f)) out.push(p);
  }
  return out;
}

function extract() {
  const keys = new Set(EXTRA);
  for (const file of [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components")), ...walk(join(ROOT, "lib")).filter((f) => !f.includes("/i18n/"))]) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/\btr?\("((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${m[1]}"`));
  }
  const list = [...keys].sort((a, b) => a.localeCompare(b));
  writeFileSync(KEYS, JSON.stringify(list, null, 1) + "\n");
  console.log(`${list.length} texts`);
  return list;
}

const langs = () => readdirSync(MSG).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const load = (l) => JSON.parse(readFileSync(join(MSG, `${l}.json`), "utf8"));
const save = (l, m) => writeFileSync(join(MSG, `${l}.json`), JSON.stringify(Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b))), null, 1) + "\n");

function seed(xcstrings) {
  const keys = JSON.parse(readFileSync(KEYS, "utf8"));
  const cat = JSON.parse(readFileSync(xcstrings, "utf8")).strings;
  for (const l of langs()) {
    const m = load(l);
    let added = 0;
    for (const k of keys) {
      if (m[k]) continue;
      const v = cat[k]?.localizations?.[l]?.stringUnit?.value;
      if (v && !/%[@d]/.test(v)) { m[k] = v; added++; }
    }
    save(l, m);
    console.log(`${l}: +${added}`);
  }
}

function report() {
  const keys = JSON.parse(readFileSync(KEYS, "utf8"));
  for (const l of langs()) {
    const m = load(l);
    const missing = keys.filter((k) => !m[k]);
    console.log(`${l}: ${keys.length - missing.length}/${keys.length}`);
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "extract") extract();
else if (cmd === "seed") seed(arg);
else report();
