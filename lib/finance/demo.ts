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
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;

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
    push({ amount: (140 + rand() * 40).toFixed(2), type: "expense", date: day(3), note: "Energy & water",
      is_auto_income: false, is_fixed_expense: true, recurrence_id: id("r", 2), category_id: cat("Utilities"), account_id: null });

    for (const [name, [min, max, count]] of Object.entries(pattern)) {
      for (let i = 0; i < count; i++) {
        const d = 1 + Math.floor(rand() * daysInMonth);
        if (d > lastDay) continue;
        const pool = notes[name];
        push({
          amount: (min + rand() * (max - min)).toFixed(2),
          type: "expense",
          date: day(d),
          note: pool[Math.floor(rand() * pool.length)],
          is_auto_income: false,
          is_fixed_expense: false,
          recurrence_id: null,
          category_id: cat(name),
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

  return {
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
  };
}

/** A home, a mortgage in two parts and a car loan, with a month-end stand
 *  for each month so far (the mortgage paid down, the home slowly rising). */
function demoBalance(now: Date): Pick<FinanceData, "balanceItems" | "balanceValues"> {
  const posts: [string, "asset" | "liability", number, number][] = [
    ["Home", "asset", 660000, 1500],
    ["Car", "asset", 18500, -250],
    ["Mortgage (annuity)", "liability", 428000, -620],
    ["Mortgage (linear)", "liability", 50500, -210],
    ["Car loan", "liability", 9800, -300],
  ];
  const months = now.getMonth() + 1;
  const iso = (m: number) => `${now.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`;
  const balanceItems = posts.map(([name, side, start, step], i) => ({
    ...meta(i, "bi"), name, side, sort_order: i, current_value: (start + step * (months - 1)).toFixed(2),
  }));
  const balanceValues = posts.flatMap(([, , start, step], i) =>
    Array.from({ length: months }, (_, m) => ({ ...meta(i * 12 + m, "bv"), item_id: balanceItems[i].id, month: iso(m), value: (start + step * m).toFixed(2) })),
  );
  return { balanceItems, balanceValues };
}
