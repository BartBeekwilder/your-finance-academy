// Fictional data for the automated app tests: the demo household, written to
// .private/test/finance.json (git-ignored), which the dev server serves only
// to a browser carrying the cookie pf-local-file=test. Never the real file.
//   node scripts/app-test-data.mjs
import { createJiti } from "jiti";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const { buildDemoData } = await jiti.import(path.join(root, "lib/finance/demo.ts"));
const data = buildDemoData(new Date());
const dir = path.join(root, ".private", "test");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(dir, "finance.json"), JSON.stringify(data, null, 1), { mode: 0o600 });
console.log("test data:", data.transactions.length, "transactions,", data.accounts.length, "accounts,", data.holdings.length, "holdings");
