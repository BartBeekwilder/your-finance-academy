// A loan part from what the bank shows (Bart, 26 Nov): the debt now, the
// rate, the monthly payment and/or the end date — and, when it's there, the
// original loan. Gives the part as the app stores it: principal, first
// month and term, so its schedule runs through today's stand exactly.
// Pure (no imports), tested with plain node, ported 1:1 to the apps.

export type BankFigures = {
  kind: "annuity" | "linear" | "interest_only";
  /** What's owed now (after the latest payment). */
  outstanding: number;
  /** Annual rate in %. */
  rate: number;
  /** The monthly payment (interest + repayment), if known. */
  monthly?: number | null;
  /** The last payment's month (YYYY-MM-DD), if known. */
  endDate?: string | null;
  /** The amount originally borrowed for this part, if known. */
  original?: number | null;
};

export type PartFromBank = {
  principal: number;
  /** First payment's month, YYYY-MM-01. */
  start_date: string;
  term_months: number;
  /** The payment the part works out to for the next month. */
  payment: number;
  /** The monthly given doesn't fit the rest (more than €1 off). */
  mismatch: boolean;
};

const r12 = (rate: number) => rate / 1200;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const annuity = (debt: number, r: number, n: number) => (n <= 0 ? debt : r === 0 ? debt / n : (debt * r) / (1 - Math.pow(1 + r, -n)));
/** Months for an annuity of `pay` to clear `debt`; null when it never does. */
function monthsFor(debt: number, r: number, pay: number) {
  if (!(pay > 0)) return null;
  // At least one month: a small debt that one payment clears rounded to 0
  // months and read as "doesn't cover the interest" (28 Nov, Bart's mother
  // entering a home with very little mortgage left).
  if (r === 0) return Math.max(1, Math.round(debt / pay));
  const x = 1 - (r * debt) / pay;
  return x > 0 ? Math.max(1, Math.round(-Math.log(x) / Math.log(1 + r))) : null;
}
/** Payments left after today: next month up to and including the end month. */
function monthsTo(end: string, now: Date) {
  const [y, m] = end.slice(0, 7).split("-").map(Number);
  return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
}

/** The part as stored, from the bank's figures; null when they don't say
 *  enough (no end date and no payment that clears the debt). */
export function partFromBank(f: BankFigures, now: Date): PartFromBank | null {
  const r = r12(f.rate);
  const next = addMonths(now, 1); // the next payment's month
  const B = f.outstanding;
  // Payments still to make after today.
  let left = f.endDate ? monthsTo(f.endDate, now) : null;
  if (left == null && f.kind === "annuity" && f.monthly) left = monthsFor(B, r, f.monthly);
  if (left == null && f.kind === "linear" && f.monthly) left = Math.round(B / Math.max(f.monthly - B * r, 0.01));
  if (left == null || left < 1) return null;

  // With the original loan (annuity): the real start and term, so the past
  // months are right too — the term from the payment, the months done from
  // the debt now.
  if (f.original && f.original > B && f.kind === "annuity") {
    const pay = f.monthly ?? null;
    const term = (pay ? monthsFor(f.original, r, pay) : null) ?? null;
    if (term) {
      const A = annuity(f.original, r, term);
      let b = f.original, done = 0;
      while (done < term && b - B > 0.5) { b = b * (1 + r) - A; done++; }
      const start = addMonths(next, -done);
      return { principal: f.original, start_date: iso(start), term_months: term, payment: A, mismatch: !!pay && Math.abs(A - pay) > 1 };
    }
  }

  // Otherwise an equivalent part that starts this month: what was owed
  // before this month's payment, over the months left plus this one.
  const term = left + 1;
  let principal: number, payment: number;
  if (f.kind === "annuity") {
    payment = annuity(B, r, left);
    principal = (B + payment) / (1 + r);
  } else if (f.kind === "linear") {
    principal = (B * term) / left;
    payment = B / left + B * r;
  } else {
    principal = B;
    payment = B * r;
  }
  return { principal, start_date: iso(now), term_months: term, payment, mismatch: !!f.monthly && Math.abs(payment - f.monthly) > 1 };
}

/** The easy way (Bart, 26 Nov): the debt now and the monthly payment, gross
 *  or net. Net (Dutch home): the refund on the interest is estimated
 *  (maximum deduction rate, minus the forfait) and added back to get the
 *  gross payment. The rate is assumed (`rate`, ~3.8%) when not given. */
export function easyMortgage(f: { owed: number; monthly: number; net: boolean; dutch: boolean; woz: number; rate?: number }, now: Date) {
  const rate = f.rate ?? 3.8;
  const interest = f.owed * r12(rate);
  const refund = f.net && f.dutch ? Math.max(interest * 0.3748 - (f.woz * 0.0035) / 12, 0) : 0;
  const gross = f.monthly + refund;
  const part = partFromBank({ kind: "annuity", outstanding: f.owed, rate, monthly: gross }, now);
  return part ? { part, rate, refund, gross } : null;
}
