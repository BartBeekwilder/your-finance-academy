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
  "Dashboard", "Income", "Expenses", "Net worth", "Balance sheet", "First month closed", "Close a month", "Quarter in the books", "Close 3 months", "A full year closed", "Close 12 months", "One week streak", "Update your books 7 days in a row", "30-day streak", "Update your books 30 days in a row", "100-day streak", "Update your books 100 days in a row", "First €1,000 saved", "Save 1,000 in total", "€10,000 saved", "Save 10,000 in total", "€50,000 saved", "Save 50,000 in total", "In the black", "Have positive equity", "Six figures", "Reach 100,000 in equity", "A quarter of your home", "Own 25% of your home", "Half your home", "Own 50% of your home", "Three quarters home", "Own 75% of your home", "Debt-free (except the home)", "No debts besides the mortgage", "Saved 20% of income", "Close a month with a 20% savings rate", "Every budget kept", "Close a month with all budgets kept", "Three months on budget", "Keep every budget 3 closed months in a row", "Three months in the plus", "Save something 3 closed months in a row", "Goal setter", "Create your first goal", "Goal reached", "Reach one of your goals", "Books balanced", "Add posts to your balance sheet", "Home owner", "Add your home in Real estate", "Health", "Liability", "Contents", "Home", "Car", "Travel", "Life", "Disability", "Legal aid", "Pet", "Other", "Required", "Recommended", "Optional", "Insurance", "Required by law in the Netherlands", "Medical costs can be very high", "Covers damage you cause to others — cheap and important", "Your belongings, in case of fire, theft or water damage", "Your house itself; often required by the mortgage lender", "Third-party car insurance is required by law", "Term life cover so the mortgage can be paid if you die", "Income if you can't work — especially if self-employed", "Medical costs, cancellations and luggage while travelling", "Legal help in disputes with employers, sellers or neighbours", "Rent or buy", "Real estate", "Annuity", "Linear", "Interest-only", "Progress", "Starter", "Bookkeeper", "Controller", "CFO", "Investor", "Habits", "Discipline", "Discover", "Save", "Pay off debt", "Equity", "Spending limit", "Income", "Fixed costs", "Budgets", "Month-end balances", "Summary", "Investments", "Transactions", "Categories", "Budgets",
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
