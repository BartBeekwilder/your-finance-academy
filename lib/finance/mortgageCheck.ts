import { live, num } from "./calc";
import { summarize as summarizePart } from "./mortgage";
import { homes } from "./realEstate";
import type { FinanceData, Transaction } from "./types";

// The mortgage as booked against the mortgage on its schedule (Bart, 25 Nov:
// a statement read only €1,118.86 of the €2,047.22 he pays, and nothing
// said so). The fixed costs in a mortgage category are the booked payment;
// the parts in Real estate say what it should be, split into interest and
// repayment; the tax refund (voorlopige teruggaaf) makes it net.

const MORTGAGE = /hypothe|mortgage|hipotec|prêt immobilier|pret immobilier|mutuo|kredyt hipot|ipotek|ипотек|رهن|बंधक|होम लोन|kpr|thế chấp|住宅ローン|주택담보|房贷|按揭/i;
const REFUND = /teruggaaf|hypotheekrente|tax refund|steuererstattung|remboursement d'impôt|devolución|rimborso|zwrot podatku|vergi iadesi|налоговый вычет|استرداد ضريب|कर वापसी|restitusi pajak|hoàn thuế|還付|환급|退税|voorlopige aanslag/i;

/** A mortgage-like category or description, in any of the app's languages. */
export const isMortgageName = (name: string | null | undefined) => !!name && MORTGAGE.test(name);

function namesOf(data: FinanceData) {
  const byId = new Map(data.categories.map((c) => [c.id, c]));
  return (t: Transaction) => {
    const c = t.category_id ? byId.get(t.category_id) : undefined;
    const parent = c?.parent_id ? byId.get(c.parent_id) : undefined;
    return [t.note, c?.name, parent?.name];
  };
}

/** A booked mortgage payment: a fixed cost in a mortgage category (or so described). */
export function isMortgagePayment(data: FinanceData) {
  const names = namesOf(data);
  return (t: Transaction) => t.type === "expense" && !t.deleted_at && names(t).some(isMortgageName);
}

export type MortgageMonth = {
  /** What the parts say this month's payment is (interest + repayment + planned extra). */
  expected: number;
  interest: number;
  repayment: number;
  /** Mortgage payments booked this month. */
  booked: number;
  payments: Transaction[];
  /** Tax refunds booked this month (the Dutch monthly voorlopige teruggaaf). */
  refund: number;
  /** What it costs after the refund: the payment (booked, else expected) − refund. */
  net: number;
  /** Booked and clearly not what the parts say (over €25 and 5% apart). */
  off: boolean;
};

/** `month`'s mortgage: on schedule, booked, the refund and the net cost; null without mortgage parts. */
export function mortgageMonth(data: FinanceData, month: Date): MortgageMonth | null {
  const parts = homes(data).flatMap((h) => h.parts);
  if (!parts.length) return null;
  const at = new Date(month.getFullYear(), month.getMonth(), 1);
  let interest = 0, repayment = 0, extra = 0;
  for (const p of parts) {
    const row = summarizePart(p, at).thisMonth;
    if (!row) continue;
    interest += row.interest;
    repayment += row.repayment;
    extra += Math.min(p.extraMonthly ?? 0, row.extra);
  }
  const expected = interest + repayment + extra;
  if (!(expected > 0)) return null;
  const inMonth = (t: Transaction) => { const d = new Date(t.date); return d.getFullYear() === at.getFullYear() && d.getMonth() === at.getMonth(); };
  const isPayment = isMortgagePayment(data);
  const payments = live(data.transactions).filter((t) => inMonth(t) && isPayment(t));
  const booked = payments.reduce((s, t) => s + num(t.amount), 0);
  const names = namesOf(data);
  const refund = live(data.transactions)
    .filter((t) => t.type === "income" && inMonth(t) && names(t).some((n) => !!n && REFUND.test(n)))
    .reduce((s, t) => s + num(t.amount), 0);
  const gap = Math.abs(expected - booked);
  return {
    expected,
    interest,
    repayment: repayment + extra,
    booked,
    payments,
    refund,
    net: (booked > 0 ? booked : expected) - refund,
    off: booked > 0 && gap > 25 && gap > expected * 0.05,
  };
}
