import type { FinanceData } from "./types";

// Repayments of a debt ("aflossing", Bart 25 Nov): an expense marked with the
// debt it pays off (a loan or a mortgage part, `repays`). It isn't spending —
// equity stays the same — so every screen sees the data without them
// (data.repayments holds them, like advances). The money still leaves its
// account (liquidity goes down) and the debt goes down by the same amount:
// loans.ts and mortgage.ts take them as extra repayments.

// Own tiny helper (no imports beyond types), so it can be tested with plain
// node and ported 1:1.
const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

/** The data every screen sees: repayments out of `transactions`, into `repayments`. */
export function withRepayments(data: FinanceData): FinanceData {
  if (!data.transactions.some((t) => t.repays)) return data;
  return {
    ...data,
    transactions: data.transactions.filter((t) => !t.repays),
    repayments: data.transactions.filter((t) => t.repays && !t.deleted_at),
  };
}

/** Repaid in `month` (any day of it), up to `at` (ms) when given. */
export function repaidIn(data: Pick<FinanceData, "repayments">, month: Date, at = Infinity) {
  let total = 0;
  for (const t of data.repayments ?? []) {
    const d = new Date(t.date);
    if (d.getFullYear() !== month.getFullYear() || d.getMonth() !== month.getMonth() || d.getTime() > at) continue;
    total += num(t.amount);
  }
  return total;
}

/** Per account: what repayments took off it this year up to `at`. Paid from
 *  no account = the default account (like expenses). */
export function repaymentsByAccount(data: Pick<FinanceData, "repayments">, at: Date, fallback: string | null) {
  const out = new Map<string, number>();
  for (const t of data.repayments ?? []) {
    const d = new Date(t.date);
    if (d.getFullYear() !== at.getFullYear() || d > at) continue;
    const account = t.account_id ?? fallback;
    if (account) out.set(account, (out.get(account) ?? 0) + num(t.amount));
  }
  return out;
}

/** One debt's repayments (oldest first): the extras its schedule takes off. */
export function extrasFor(data: Pick<FinanceData, "repayments">, debtId: string): { date: Date; amount: number }[] {
  return (data.repayments ?? [])
    .filter((t) => t.repays === debtId)
    .map((t) => ({ date: new Date(t.date), amount: num(t.amount) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
