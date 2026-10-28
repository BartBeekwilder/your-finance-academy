import type { FinanceData, Transaction } from "./types";

// Advances ("voorgeschoten"): an expense paid on someone else's behalf that
// will be paid back. It isn't spending — it left the account and is owed to
// you — so every screen sees the data without them (data.advances holds
// them), and the balance sheet moves the open ones from Accounts to Amounts
// to receive. Paid back = the money is on the same account again.

// Own tiny helper (no imports beyond types), so it can be tested with plain
// node and ported 1:1.
const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

/** The data every screen sees: advances out of `transactions`, into `advances`. */
export function withAdvances(data: FinanceData): FinanceData {
  if (!data.transactions.some((t) => t.advance)) return data;
  return {
    ...data,
    transactions: data.transactions.filter((t) => !t.advance),
    advances: data.transactions.filter((t) => t.advance && !t.deleted_at),
  };
}

/** Advances paid by `at` and not yet back by then, newest first. */
export function openAdvances(data: FinanceData, at: Date): Transaction[] {
  return (data.advances ?? [])
    .filter((t) => new Date(t.date) <= at && (!t.repaid_at || new Date(t.repaid_at) > at))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Per account: what the open advances took off it at `at`. Paid from no
 *  account = the default account (like expenses). */
export function advancesByAccount(data: FinanceData, at: Date, fallback: string | null) {
  const out = new Map<string, number>();
  for (const t of openAdvances(data, at)) {
    const account = t.account_id ?? fallback;
    if (account) out.set(account, (out.get(account) ?? 0) + num(t.amount));
  }
  return out;
}
