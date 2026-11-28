import { live, num, spendByCategoryYear } from "./calc";
import type { Category, FinanceData } from "./types";

// Expenses › Year › an earlier year (Bart, 24 Nov): what each category took
// that year. Bookings and the imported year totals (yearCategoryTotals,
// yearIncomeTotals) are two views of the same year, so each category takes
// the larger of the two — books begun in November still show the whole year
// from the import. Per month: the bookings, and what the import adds on top
// spread evenly over the months without bookings. Ported 1:1 to the apps
// (PastYear.swift).

export type PastYear = {
  rows: { category: Category; spent: number }[];
  total: number;
  income: number;
  /** Spending per month, January first. */
  months: number[];
};

export function pastYear(data: FinanceData, year: number): PastYear {
  const cats = live(data.categories);
  const top = new Map(cats.map((c) => [c.id, c.parent_id ?? c.id]));
  const booked = new Map(spendByCategoryYear(data, year).map((r) => [r.category.id, r.spent]));
  const imported = new Map<string, number>();
  for (const r of data.yearCategoryTotals ?? []) {
    if (r.year !== year || !r.category_id) continue;
    const k = top.get(r.category_id) ?? r.category_id;
    imported.set(k, (imported.get(k) ?? 0) + num(r.amount));
  }
  const rows = cats
    .filter((c) => !c.is_income_category && c.parent_id === null)
    .map((category) => ({ category, spent: Math.max(booked.get(category.id) ?? 0, imported.get(category.id) ?? 0) }))
    .filter((r) => r.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const total = rows.reduce((s, r) => s + r.spent, 0);

  const tx = live(data.transactions).filter((t) => !t.advance && new Date(t.date).getFullYear() === year);
  const bookedIncome = tx.filter((t) => t.type === "income").reduce((s, t) => s + num(t.amount), 0);
  const importedIncome = (data.yearIncomeTotals ?? []).filter((r) => r.year === year).reduce((s, r) => s + num(r.amount), 0);

  const months = new Array(12).fill(0);
  for (const t of tx) if (t.type === "expense") months[new Date(t.date).getMonth()] += num(t.amount);
  const extra = total - months.reduce((a, b) => a + b, 0);
  const open = months.map((v, m) => (v === 0 ? m : -1)).filter((m) => m >= 0);
  if (extra > 0.005 && open.length) for (const m of open) months[m] += extra / open.length;
  return { rows, total, income: Math.max(bookedIncome, importedIncome), months };
}

/** The first year Expenses can go back to: bookings or an imported total. */
export function firstExpenseYear(data: FinanceData, now: Date): number {
  const years = [
    ...live(data.transactions).filter((t) => t.type === "expense").map((t) => new Date(t.date).getFullYear()),
    ...(data.yearCategoryTotals ?? []).map((r) => r.year),
  ];
  return Math.min(now.getFullYear(), ...years);
}
