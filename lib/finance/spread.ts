import type { FinanceData, Transaction } from "./types";

// Spread expenses ("afschrijven"): a purchase with spread_months = N counts
// in spending, budgets and charts as N monthly parts (as a fixed cost,
// spread over the days), starting in the purchase month. The money left the
// account at once, so the balance sheet takes the part not yet used off
// Accounts and shows it as an asset: the book value.

// Own tiny helper (no imports beyond types), so the maths can be tested
// with plain node and ported 1:1.
const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

const MONTHS = (d: Date, k: number) => {
  const r = new Date(d.getFullYear(), d.getMonth() + k, 1, 12);
  r.setDate(Math.min(d.getDate(), new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  return r;
};

/** The monthly parts of one spread expense (cents rounded, the last part
 *  takes the remainder so they add up exactly). */
export function spreadParts(t: Transaction): Transaction[] {
  const n = t.spread_months ?? 0;
  if (t.type !== "expense" || n < 2) return [t];
  const cents = Math.round(num(t.amount) * 100);
  const each = Math.floor(cents / n);
  const start = new Date(t.date);
  return Array.from({ length: n }, (_, k) => ({
    ...t,
    id: `${t.id}~${k + 1}`,
    amount: ((k === n - 1 ? cents - each * (n - 1) : each) / 100).toFixed(2),
    date: MONTHS(start, k).toISOString(),
    is_fixed_expense: true,
    recurrence_id: null,
    spread_of: t,
    spread_index: k + 1,
    spread_total: n,
  }));
}

/** The data every screen sees: spread expenses replaced by their parts. */
export function withSpread(data: FinanceData): FinanceData {
  if (!data.transactions.some((t) => (t.spread_months ?? 0) >= 2 && t.type === "expense" && !t.deleted_at)) return data;
  return { ...data, transactions: data.transactions.flatMap((t) => (t.deleted_at ? [t] : spreadParts(t))) };
}

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** Book value of spread purchases at the end of `month` (bought by then):
 *  what's paid but not yet used. Works on either data (parts or originals). */
export function spreadBookValue(data: FinanceData, month: Date) {
  const at = monthKey(month);
  const originals = new Map<string, Transaction>();
  for (const t of data.transactions) {
    const o = t.spread_of ?? ((t.spread_months ?? 0) >= 2 && t.type === "expense" ? t : null);
    if (o && !o.deleted_at) originals.set(o.id, o);
  }
  const items = [...originals.values()]
    .filter((o) => monthKey(new Date(o.date)) <= at)
    .map((o) => {
      const used = spreadParts(o).filter((p) => monthKey(new Date(p.date)) <= at).reduce((s, p) => s + num(p.amount), 0);
      return { purchase: o, value: Math.max(num(o.amount) - used, 0) };
    })
    .filter((x) => x.value > 0.005);
  return { items, total: items.reduce((s, x) => s + x.value, 0) };
}
