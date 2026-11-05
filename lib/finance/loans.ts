import type { FinanceData, Loan } from "./types";

// Other loans (study, car, personal…): what's left now, at a rate, paid off
// by a fixed amount a month. The debt goes down by itself: on the 1st of each
// month after the stand was entered, the month's interest is added and the
// monthly payment comes off (the last one only what's left).
//
// Own tiny helpers (no imports beyond types), so the maths can be tested with
// plain node and ported 1:1.

const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));
const cents = (v: number) => Math.round(v * 100) / 100;
/** Longest schedule worked out: 50 years. */
const MAX_MONTHS = 600;

/** The month payments start from: the 1st after the stand's date. */
function firstPayment(loan: Pick<Loan, "start_date">) {
  const [y, m] = loan.start_date.slice(0, 7).split("-").map(Number);
  return new Date(y, m, 1, 12); // month index m = the month after
}

/** Payments made between the stand and `at` (one on each 1st). */
export function paymentsBy(loan: Pick<Loan, "start_date">, at: Date) {
  const f = firstPayment(loan);
  const n = (at.getFullYear() - f.getFullYear()) * 12 + (at.getMonth() - f.getMonth()) + 1;
  return Math.max(0, Math.min(n, MAX_MONTHS));
}

export type LoanMonth = { date: Date; interest: number; repaid: number; balance: number };

/** Month by month from the first payment, until paid off (or 50 years). */
export function loanSchedule(loan: Pick<Loan, "balance" | "rate" | "monthly" | "start_date">): LoanMonth[] {
  const rate = num(loan.rate) / 100 / 12;
  const monthly = num(loan.monthly);
  const f = firstPayment(loan);
  const out: LoanMonth[] = [];
  let balance = num(loan.balance);
  // No payment: the stand stays as it is. A payment below the interest: the
  // debt grows month by month (never paid off — payoff() says so).
  if (monthly <= 0) return out;
  for (let i = 0; i < MAX_MONTHS && balance > 0.005; i++) {
    const interest = cents(balance * rate);
    const pay = Math.min(monthly, balance + interest);
    balance = cents(balance + interest - pay);
    out.push({ date: new Date(f.getFullYear(), f.getMonth() + i, 1, 12), interest, repaid: cents(pay - interest), balance });
  }
  return out;
}

/** The loan at a moment: what's left, and what's been paid since the stand. */
export function loanAt(loan: Pick<Loan, "balance" | "rate" | "monthly" | "start_date">, at: Date) {
  const n = paymentsBy(loan, at);
  const done = loanSchedule(loan).slice(0, n);
  const last = done[done.length - 1];
  return {
    balance: last ? Math.max(last.balance, 0) : num(loan.balance),
    repaid: cents(done.reduce((s, m) => s + m.repaid, 0)),
    interest: cents(done.reduce((s, m) => s + m.interest, 0)),
  };
}

/** When it's paid off and the interest still to pay; null = never (the
 *  payment doesn't cover the interest, or there's no payment). */
export function payoff(loan: Pick<Loan, "balance" | "rate" | "monthly" | "start_date">, at: Date) {
  const all = loanSchedule(loan);
  const end = all[all.length - 1];
  if (!end || end.balance > 0.005) return null;
  const ahead = all.slice(paymentsBy(loan, at));
  return { date: end.date, months: ahead.length, interestLeft: cents(ahead.reduce((s, m) => s + m.interest, 0)) };
}

/** The loans that count (not deleted), in their order. */
export function liveLoans(data: Pick<FinanceData, "loans">): Loan[] {
  return (data.loans ?? []).filter((l) => !l.deleted_at).sort((a, b) => a.sort_order - b.sort_order);
}
