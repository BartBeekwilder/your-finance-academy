import type { FinanceData, Transaction } from "./types";
import { budgetIn } from "./budgetPlan.ts";

// Earlier months that are still empty, filled with an estimate: the net pay
// on payday, every monthly fixed cost on its own day, and each budget as if
// it was spent (mid-month). Rows are marked `estimated` until the month is
// confirmed ("Klopt") or the row is edited, so charts and lists can say so.
// Used by the setup ("From 1 January") and an empty month's "Use the
// estimate". Pure (types only), so it's tested with plain node and ported to
// the apps.

/** Confirming an estimated month earns points (achievement code + "YYYY-MM"). */
export const CONFIRM_PREFIX = "confirm-month:";
export const CONFIRM_POINTS = 25;

export type EstimateRow = Omit<Transaction, "id" | "updated_at" | "deleted_at">;

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const sameMonth = (iso: string, m: Date) => key(new Date(iso)) === key(m);
const alive = (t: Transaction) => !t.deleted_at;

/** No income and no spending booked in the month yet. */
export function isEmptyMonth(data: Pick<FinanceData, "transactions">, month: Date) {
  return !data.transactions.some((t) => alive(t) && sameMonth(t.date, month));
}

/** The months from `from` up to (not including) this month that are still
 *  empty, oldest first. */
export function emptyMonthsSince(data: Pick<FinanceData, "transactions">, from: Date, now: Date): Date[] {
  const out: Date[] = [];
  for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m < new Date(now.getFullYear(), now.getMonth(), 1); m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    if (isEmptyMonth(data, m)) out.push(m);
  }
  return out;
}

/** "YYYY-MM" of every month that still holds estimated rows, oldest first. */
export function estimatedMonths(data: Pick<FinanceData, "transactions">): string[] {
  return [...new Set(data.transactions.filter((t) => alive(t) && t.estimated).map((t) => key(new Date(t.date))))].sort();
}

/** The fixed costs that repeat every month, as booked in the latest month
 *  that has any (up to this one): a recurrence (setup, earlier copies) or the
 *  same cost the month before. A yearly payment isn't copied back. */
function monthlyFixed(data: Pick<FinanceData, "transactions">, now: Date): Transaction[] {
  const fixedIn = (m: Date) => data.transactions.filter((t) => alive(t) && t.type === "expense" && t.is_fixed_expense && !t.advance && !t.spread_months && !t.spread_of && sameMonth(t.date, m));
  for (let back = 0; back < 13; back++) {
    const m = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const here = fixedIn(m);
    if (!here.length) continue;
    const before = fixedIn(new Date(m.getFullYear(), m.getMonth() - 1, 1));
    return here.filter((t) => t.recurrence_id || before.some((b) => b.category_id === t.category_id && (b.note ?? "") === (t.note ?? "")));
  }
  return [];
}

/** The estimate for one month (all rows `estimated: true`). Nothing when
 *  there's nothing to go on. */
export function estimateMonth(data: FinanceData, month: Date, now: Date): EstimateRow[] {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const at = (day: number) => new Date(month.getFullYear(), month.getMonth(), Math.min(Math.max(day, 1), days), 12).toISOString();
  const account = data.accounts.find((a) => !a.deleted_at && a.is_default)?.id ?? null;
  const base = { note: null, is_auto_income: false, is_fixed_expense: false, recurrence_id: null, category_id: null, account_id: account, estimated: true } as const;
  const rows: EstimateRow[] = [];

  const net = Number(data.profile.expected_net_monthly ?? 0);
  if (net > 0) {
    const gross = Number(data.profile.expected_gross_monthly ?? 0);
    const lastIncome = data.transactions.find((t) => alive(t) && t.type === "income" && t.category_id);
    const incomeCat = lastIncome?.category_id ?? data.categories.find((c) => !c.deleted_at && c.is_income_category && !c.parent_id)?.id ?? null;
    rows.push({ ...base, type: "income", amount: net.toFixed(2), date: at(data.profile.payday_day ?? 25), category_id: incomeCat, ...(gross > net ? { gross_amount: gross.toFixed(2) } : {}) });
  }

  for (const f of monthlyFixed(data, now)) {
    rows.push({ ...base, type: "expense", amount: f.amount, date: at(new Date(f.date).getDate()), note: f.note, is_fixed_expense: true, recurrence_id: f.recurrence_id, category_id: f.category_id, account_id: f.account_id ?? account });
  }

  // Each top-level spending category's budget for that month, as spent.
  for (const c of data.categories) {
    if (c.deleted_at || c.is_income_category || c.is_fixed_expense || c.parent_id) continue;
    const b = budgetIn(data.budgets, c.id, month) ?? budgetIn(data.budgets, c.id, now);
    if (b) rows.push({ ...base, type: "expense", amount: b.toFixed(2), date: at(15), category_id: c.id });
  }
  return rows;
}
