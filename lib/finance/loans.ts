import type { FinanceData, Loan } from "./types";

// Other loans (study, car, personal…): what's left now, at a rate, paid off
// by a fixed amount a month. The debt goes down by itself: on the 1st of each
// month after the stand was entered, the month's interest is added and the
// monthly payment comes off (the last one only what's left). Extra
// repayments booked on the loan (`extras`, from repayments.ts) come off on
// the day they were made.
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
/** A loan with the extra repayments booked on it (liveLoans attaches them). */
export type LoanLike = Pick<Loan, "balance" | "rate" | "monthly" | "start_date"> & { extras?: { date: Date; amount: number }[] };

/** The stand's moment: extras before it are in the stand already. */
const standAt = (loan: Pick<Loan, "start_date">) => {
  const [y, m, d] = loan.start_date.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d || 1, 23, 59, 59).getTime();
};
/** Extras made after the stand, from `from` (incl.) to `to` (excl.), ms. */
const extrasBetween = (loan: LoanLike, from: number, to: number) =>
  (loan.extras ?? []).reduce((t, e) => (e.date.getTime() > standAt(loan) && e.date.getTime() >= from && e.date.getTime() < to ? t + e.amount : t), 0);

/** Month by month from the first payment, until paid off (or 50 years).
 *  Extras made since the previous payment come off before each month. */
export function loanSchedule(loan: LoanLike): LoanMonth[] {
  const rate = num(loan.rate) / 100 / 12;
  const monthly = num(loan.monthly);
  const f = firstPayment(loan);
  const out: LoanMonth[] = [];
  let balance = num(loan.balance);
  // No payment: the stand stays as it is (less extras, see loanAt). A
  // payment below the interest: the debt grows month by month (never paid
  // off — payoff() says so).
  if (monthly <= 0) return out;
  let prev = -Infinity;
  for (let i = 0; i < MAX_MONTHS && balance > 0.005; i++) {
    const date = new Date(f.getFullYear(), f.getMonth() + i, 1, 12);
    const extra = Math.min(extrasBetween(loan, prev, date.getTime()), balance);
    prev = date.getTime();
    balance = cents(balance - extra);
    if (balance <= 0.005) {
      out.push({ date, interest: 0, repaid: cents(extra), balance: 0 });
      break;
    }
    const interest = cents(balance * rate);
    const pay = Math.min(monthly, balance + interest);
    balance = cents(balance + interest - pay);
    out.push({ date, interest, repaid: cents(pay - interest + extra), balance });
  }
  return out;
}

/** The loan at a moment: what's left, and what's been paid since the stand
 *  (extras included, also those since the last monthly payment). */
export function loanAt(loan: LoanLike, at: Date) {
  const n = paymentsBy(loan, at);
  const done = loanSchedule(loan).slice(0, n);
  const last = done[done.length - 1];
  const since = extrasBetween(loan, last ? last.date.getTime() : -Infinity, at.getTime() + 1);
  const before = last ? Math.max(last.balance, 0) : num(loan.balance);
  const off = Math.min(since, before);
  return {
    balance: cents(before - off),
    repaid: cents(done.reduce((s, m) => s + m.repaid, 0) + off),
    interest: cents(done.reduce((s, m) => s + m.interest, 0)),
  };
}

/** When it's paid off and the interest still to pay; null = never (the
 *  payment doesn't cover the interest, or there's no payment). */
export function payoff(loan: LoanLike, at: Date) {
  const all = loanSchedule(loan);
  const end = all[all.length - 1];
  if (!end || end.balance > 0.005) return null;
  const ahead = all.slice(paymentsBy(loan, at));
  return { date: end.date, months: ahead.length, interestLeft: cents(ahead.reduce((s, m) => s + m.interest, 0)) };
}

/** The loans that count (not deleted), in their order, each with the extra
 *  repayments booked on it. */
export function liveLoans(data: Pick<FinanceData, "loans" | "repayments">): (Loan & { extras: { date: Date; amount: number }[] })[] {
  return (data.loans ?? [])
    .filter((l) => !l.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => ({
      ...l,
      extras: (data.repayments ?? []).filter((t) => t.repays === l.id && !t.deleted_at).map((t) => ({ date: new Date(t.date), amount: num(t.amount) })),
    }));
}
