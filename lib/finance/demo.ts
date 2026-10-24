import { balanceSheet, live, num, spendByCategory, summarize } from "./calc";
import type { Category, FinanceData, Transaction } from "./types";

// Demo data shown until sign-in exists. The categories are the same starter
// set iOS seeds on first launch (Services/SeedData.swift), so the web and
// the app look identical out of the box.

const STARTERS: [name: string, icon: string, color: string][] = [
  ["Groceries", "cart.fill", "2E8B57"],
  ["Rent", "house.fill", "2F6690"],
  ["Transport", "car.fill", "F3A712"],
  ["Dining Out", "fork.knife", "E4572E"],
  ["Utilities", "bolt.fill", "6D4C41"],
  ["Shopping", "bag.fill", "9B5DE5"],
  ["Entertainment", "film.fill", "D64584"],
  ["Health", "cross.case.fill", "E63946"],
  ["Income", "dollarsign.circle.fill", "1C7C54"],
];

const FIXED = new Set(["Rent", "Utilities"]);

// Deterministic so server and client render the same numbers.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const id = (prefix: string, n: number) =>
  `00000000-0000-4000-8000-${prefix}${String(n).padStart(12 - prefix.length, "0")}`;

const meta = (n: number, prefix: string) => ({
  id: id(prefix, n),
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
});

export function buildDemoData(now = new Date()): FinanceData {
  const categories: Category[] = STARTERS.map(([name, icon, color], i) => ({
    ...meta(i, "c"),
    name,
    icon,
    color_hex: color,
    is_default: true,
    is_income_category: name === "Income",
    is_fixed_expense: FIXED.has(name),
    sort_order: i,
    parent_id: null,
  }));
  // Subcategories (ids after the starters): Utilities, Groceries and
  // Transport split up. Only the category of existing demo spend changes,
  // so every total stays the same as on iOS / Android.
  const SUBS: [string, string, string][] = [
    ["Utilities", "Electricity", "bolt.fill"],
    ["Utilities", "Gas", "flame.fill"],
    ["Utilities", "Water", "drop.fill"],
    ["Groceries", "Supermarket", "cart.fill"],
    ["Groceries", "Market", "leaf.fill"],
    ["Transport", "Public transport", "tram.fill"],
    ["Transport", "Fuel", "fuelpump.fill"],
    ["Transport", "Parking", "parkingsign.circle.fill"],
  ];
  for (const [parent, name, icon] of SUBS) {
    const p = categories.find((c) => c.name === parent)!;
    categories.push({ ...meta(100 + categories.length, "c"), name, icon, color_hex: p.color_hex, is_default: false, is_income_category: false, is_fixed_expense: p.is_fixed_expense, sort_order: categories.length, parent_id: p.id });
  }
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;
  const subFor: Record<string, string> = { "Albert Heijn": "Supermarket", Jumbo: "Supermarket", Lidl: "Supermarket", Market: "Market", "NS train": "Public transport", "OV top-up": "Public transport", Fuel: "Fuel", Parking: "Parking" };

  // Typical monthly spend per category: [min, max, entries per month]
  const pattern: Record<string, [number, number, number]> = {
    Groceries: [18, 95, 9],
    Transport: [12, 60, 5],
    "Dining Out": [15, 70, 4],
    Shopping: [20, 140, 2],
    Entertainment: [9, 45, 2],
    Health: [10, 80, 1],
  };
  const notes: Record<string, string[]> = {
    Groceries: ["Albert Heijn", "Jumbo", "Lidl", "Market"],
    Transport: ["NS train", "Fuel", "Parking", "OV top-up"],
    "Dining Out": ["Lunch", "Pizza", "Sushi", "Café"],
    Shopping: ["Clothing", "Bol.com", "Home goods"],
    Entertainment: ["Cinema", "Streaming", "Concert"],
    Health: ["Pharmacy", "Gym"],
  };

  const rand = rng(42);
  const transactions: Transaction[] = [];
  let n = 0;
  const push = (t: Omit<Transaction, "id" | "updated_at" | "deleted_at">) =>
    transactions.push({ ...meta(n++, "t"), ...t });

  for (let back = 11; back >= 0; back--) {
    const y = now.getFullYear();
    const m = now.getMonth() - back;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const lastDay = back === 0 ? now.getDate() : daysInMonth;
    const day = (d: number) => new Date(y, m, Math.min(d, lastDay), 12).toISOString();

    // Income that moves like a real year: salary ± overtime, holiday
    // allowance in May, a year-end bonus in December, a tax refund in April
    // and freelance jobs in about half of the months (finished months only).
    push({ amount: (3850 + (rand() * 2 - 1) * 260).toFixed(2), type: "income", date: day(25), note: "Salary", is_auto_income: true,
      is_fixed_expense: false, recurrence_id: null, category_id: cat("Income"), account_id: null });
    if (back === 0 && now.getDate() < 25) transactions.pop();
    const calMonth = new Date(y, m, 1).getMonth();
    const extra = (amount: number, d: number, note: string) =>
      push({ amount: amount.toFixed(2), type: "income", date: day(d), note, is_auto_income: false,
        is_fixed_expense: false, recurrence_id: null, category_id: cat("Income"), account_id: null });
    if (back > 0) {
      if (calMonth === 4) extra(2480, 20, "Holiday allowance");
      if (calMonth === 11) extra(1900, 18, "Year-end bonus");
      if (calMonth === 3) extra(640, 9, "Tax refund");
      if (rand() < 0.45) extra(150 + rand() * 500, 1 + Math.floor(rand() * 27), "Freelance");
    }

    push({ amount: "1250.00", type: "expense", date: day(1), note: "Rent", is_auto_income: false,
      is_fixed_expense: true, recurrence_id: id("r", 1), category_id: cat("Rent"), account_id: null });
    // Energy & water, split over its subcategories (same total as before).
    const utilities = Math.round((140 + rand() * 40) * 100);
    const elec = Math.round(utilities * 0.5), gas = Math.round(utilities * 0.35);
    for (const [cents, note, d, r] of [[elec, "Electricity", 3, 2], [gas, "Gas", 3, 3], [utilities - elec - gas, "Water", 8, 4]] as const) {
      push({ amount: (cents / 100).toFixed(2), type: "expense", date: day(d), note,
        is_auto_income: false, is_fixed_expense: true, recurrence_id: id("r", r), category_id: cat(note), account_id: null });
    }

    for (const [name, [min, max, count]] of Object.entries(pattern)) {
      for (let i = 0; i < count; i++) {
        const d = 1 + Math.floor(rand() * daysInMonth);
        if (d > lastDay) continue;
        const pool = notes[name];
        const amount = (min + rand() * (max - min)).toFixed(2);
        const note = pool[Math.floor(rand() * pool.length)];
        push({
          amount,
          type: "expense",
          date: day(d),
          note,
          is_auto_income: false,
          is_fixed_expense: false,
          recurrence_id: null,
          category_id: cat(subFor[note] ?? name),
          account_id: null,
        });
      }
    }
  }

  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const budgetAmounts: Record<string, number> = {
    Groceries: 450, Rent: 1250, Transport: 180, "Dining Out": 150,
    Utilities: 170, Shopping: 200, Entertainment: 80, Health: 60,
  };

  const base: FinanceData = {
    profile: {
      currency_code: "EUR",
      appearance_mode: "dark",
      expected_gross_monthly: "5200.00",
      expected_net_monthly: "3850.00",
      payday_day: 25,
      income_reminders: true,
    },
    accounts: [{ ...meta(0, "a"), name: "Default", type: "checking", balance: "8400.00", institution: null, is_default: true }],
    categories,
    budgets: Object.entries(budgetAmounts).map(([name, amount], i) => ({
      ...meta(i, "b"), category_id: cat(name), amount: amount.toFixed(2), month,
    })),
    transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
    incomeRecords: [],
    holdings: [
      { ...meta(0, "h"), symbol: "BTC", name: "Bitcoin", asset_type: "crypto", quantity: "0.0850000000", cost_basis: "4200.00", cost_basis_currency: null, date_added: "2025-03-02T10:00:00Z" },
      { ...meta(1, "h"), symbol: "AAPL", name: "Apple Inc.", asset_type: "stock", quantity: "12.0000000000", cost_basis: "2050.00", cost_basis_currency: "USD", date_added: "2025-06-14T10:00:00Z" },
      { ...meta(2, "h"), symbol: "XAU", name: "Gold", asset_type: "metal", quantity: "1.0000000000", cost_basis: "2100.00", cost_basis_currency: null, date_added: "2024-11-20T10:00:00Z" },
    ],
    ...demoBalance(now),
    ...demoRealEstate(),
    monthCloses: [],
    goals: [],
    achievements: [],
    activityDays: [],
    insurancePolicies: demoInsurance(now),
  };
  return { ...base, ...demoProgress(base, now) };
}

/** January … the month before last closed (with their snapshots; last
 *  month is left open so the close banner and wizard can be tried), the last six weeks
 *  of activity with a few gaps, and three goals. */
function demoProgress(data: FinanceData, now: Date): Pick<FinanceData, "monthCloses" | "goals" | "activityDays"> {
  const monthCloses = Array.from({ length: Math.max(now.getMonth() - 1, 0) }, (_, m) => {
    const month = new Date(now.getFullYear(), m, 1);
    const s = summarize(data.transactions, month);
    const saved = s.income - s.spent;
    const rate = s.income > 0 ? saved / s.income : 0;
    const kept = live(data.budgets).every((b) => {
      const c = data.categories.find((x) => x.id === b.category_id);
      return !c || spendByCategory(data, month).find((e) => e.category.id === c.id)!.spent <= num(b.amount);
    });
    const rings = 1 + (kept ? 1 : 0) + (rate >= 0.2 ? 1 : 0);
    return {
      ...meta(m, "mc"),
      month: `${now.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`,
      closed_at: new Date(now.getFullYear(), m + 1, 2, 20).toISOString(),
      summary: { income: s.income, spent: s.spent, saved, savingsRate: rate, equity: balanceSheet(data, now, month).equity, allBudgetsKept: kept, rings },
      points: 100 + 50 * rings,
    };
  });
  const skip = new Set([4, 13, 22, 31]);
  const activityDays = Array.from({ length: 45 }, (_, i) => i)
    .filter((i) => !skip.has(i))
    .map((i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i - 1);
      return { ...meta(i, "ad"), day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` };
    });
  const ago = (months: number) => new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString();
  const goals = [
    { ...meta(0, "g"), kind: "save" as const, name: "Emergency buffer", target: "10000.00", start_value: "4000.00", target_date: `${now.getFullYear() + 1}-06-01`, category_id: null, achieved_at: null, sort_order: 0, created_at: ago(4) },
    { ...meta(1, "g"), kind: "equity" as const, name: "€250k equity", target: "250000.00", start_value: "180000.00", target_date: null, category_id: null, achieved_at: null, sort_order: 1, created_at: ago(9) },
    { ...meta(2, "g"), kind: "category_limit" as const, name: "Dining out under €120", target: "120.00", start_value: "0.00", target_date: null, category_id: data.categories.find((c) => c.name === "Dining Out")?.id ?? null, achieved_at: null, sort_order: 2, created_at: ago(3) },
  ];
  return { monthCloses, goals, activityDays };
}

/** A home bought in 2019 with a two-part Dutch mortgage (annuity + linear),
 *  10-year fixed rates — it feeds the balance sheet's Home and Mortgage. */
function demoRealEstate(): Pick<FinanceData, "properties" | "mortgageParts"> {
  const home = { ...meta(0, "p"), name: "Home", value: "675000.00", value_date: null, purchase_price: "520000.00", purchase_date: "2019-06-01", country: "NL" as const, sort_order: 0 };
  const part = (n: number, name: string, kind: "annuity" | "linear", principal: string, rate: string) => ({
    ...meta(n, "mp"), property_id: home.id, name, kind, principal, rate, fixed_until: "2029-06-01", start_date: "2019-06-01", term_months: 360, nhg: false, extra_monthly: "0.00", sort_order: n,
  });
  return {
    properties: [home],
    mortgageParts: [part(0, "Annuity part", "annuity", "450000.00", "2.05"), part(1, "Linear part", "linear", "60000.00", "2.35")],
  };
}

/** A car, a car loan, a student loan, a credit card and tax to pay (the
 *  home and mortgage come from the real-estate module), with a month-end stand
 *  for each month so far (the mortgage paid down, the home slowly rising). */
function demoBalance(now: Date): Pick<FinanceData, "balanceItems" | "balanceValues"> {
  const posts: [string, "asset" | "liability", number, number][] = [
    ["Car", "asset", 18500, -250],
    ["Car loan", "liability", 9800, -300],
    ["Student loan (DUO)", "liability", 21400, -145],
    ["Credit card", "liability", 0, 0],
    ["Tax to pay", "liability", 0, 0],
  ];
  const months = now.getMonth() + 1;
  const iso = (m: number) => `${now.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`;
  const balanceItems = posts.map(([name, side, start, step], i) => ({
    ...meta(i, "bi"), name, side, sort_order: i, current_value: (start + step * (months - 1)).toFixed(2),
  }));
  // Credit card: what's outstanding at month end; tax: the yearly
  // assessment building up until it's paid in July.
  const wobble: Record<string, (m: number) => number> = {
    "Credit card": (m) => [640, 1180, 420, 890, 1560, 730, 2140, 980, 510, 1320, 870, 1650][m],
    "Tax to pay": (m) => (m < 6 ? 2400 + m * 180 : 350 + (m - 6) * 160),
  };
  const valueAt = (i: number, m: number) => wobble[posts[i][0]]?.(m) ?? posts[i][2] + posts[i][3] * m;
  for (const [i, item] of balanceItems.entries()) if (wobble[item.name]) item.current_value = valueAt(i, months - 1).toFixed(2);
  const balanceValues = posts.flatMap((_, i) =>
    Array.from({ length: months }, (_, m) => ({ ...meta(i * 12 + m, "bv"), item_id: balanceItems[i].id, month: iso(m), value: valueAt(i, m).toFixed(2) })),
  );
  return { balanceItems, balanceValues };
}

/** Insurance like a Dutch household with a home and a car. */
function demoInsurance(now: Date): FinanceData["insurancePolicies"] {
  const y = now.getFullYear();
  const p = (n: number, kind: FinanceData["insurancePolicies"][number]["kind"], name: string, insurer: string, premium: string, period: "month" | "quarter" | "year", deductible: string, renewal: string, coverage: string | null = null, notice = 1) => ({
    ...meta(n, "i"), kind, name, insurer, premium, period, deductible, coverage, start_date: null, renewal_date: renewal, notice_months: notice, notes: "", sort_order: n,
  });
  return [
    p(0, "health", "Basic + supplementary", "Zilveren Kruis", "168.40", "month", "385.00", `${y + 1}-01-01`),
    p(1, "liability", "Personal liability", "Centraal Beheer", "4.95", "month", "0.00", `${y}-11-15`, "2500000.00"),
    p(2, "contents", "Home contents", "Centraal Beheer", "11.20", "month", "100.00", `${y}-11-15`, "75000.00"),
    p(3, "home", "Building insurance", "Centraal Beheer", "24.80", "month", "250.00", `${y}-11-15`),
    p(4, "car", "Car — all risk", "ANWB", "87.50", "month", "300.00", `${y + 1}-03-01`),
    p(5, "travel", "Continuous travel", "ANWB", "62.00", "year", "50.00", `${y + 1}-05-20`),
    p(6, "legal", "Legal aid", "DAS", "21.60", "month", "0.00", `${y + 1}-02-01`),
  ];
}
