// Mortgage maths — pure functions, no imports, so the same rules can be
// ported 1:1 to iOS and Android (and tested with plain node).
//
// A mortgage is one or more parts ("leningdelen"), each:
//   annuity       — the same monthly payment; the interest share shrinks and
//                   the repayment share grows over time.
//   linear        — the same repayment every month (principal ÷ term) plus
//                   interest on what's left; payments fall over time.
//   interest_only — interest only; the whole principal is due at the end.
// Extra repayments shorten the loan (the monthly payment stays the same).
// A rate change (end of the fixed-rate period) recalculates the annuity
// payment on the remaining debt and term.

export type MortgageKind = "annuity" | "linear" | "interest_only";

export type MortgagePart = {
  id: string;
  name: string;
  kind: MortgageKind;
  principal: number;
  /** Annual interest rate in %, e.g. 3.9. */
  rate: number;
  /** First month of the loan (any day of that month). */
  start: Date;
  termMonths: number;
  /** End of the fixed-rate period, if known. */
  fixedUntil?: Date | null;
  nhg?: boolean;
  /** Planned extra repayment every month. */
  extraMonthly?: number;
};

export type Row = {
  /** 0-based month number since the start. */
  i: number;
  /** The month this payment belongs to (1st of the month). */
  month: Date;
  interest: number;
  /** Regular repayment (excluding extra). */
  repayment: number;
  extra: number;
  /** interest + repayment + extra */
  payment: number;
  /** Remaining debt after this month. */
  balance: number;
  rate: number;
};

export type Scenario = {
  /** Extra repayment every month (overrides the part's own plan). */
  extraMonthly?: number;
  /** First month the extra monthly repayment applies (default: the start). */
  extraFrom?: Date | null;
  /** One-off extra repayments. */
  lumps?: { month: Date; amount: number }[];
  /** A different rate from a month onwards (e.g. after the fixed period). */
  rateFrom?: { month: Date; rate: number } | null;
};

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/** The annuity payment for a debt over n months at a monthly rate r. */
export function annuityPayment(debt: number, monthlyRate: number, n: number) {
  if (n <= 0) return debt;
  if (monthlyRate === 0) return debt / n;
  return (debt * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
}

/** Month-by-month schedule of one part, until it's paid off. */
export function schedule(p: MortgagePart, s: Scenario = {}): Row[] {
  const start = monthStart(p.start);
  const extraMonthly = s.extraMonthly ?? p.extraMonthly ?? 0;
  const extraStart = s.extraFrom ? monthsBetween(start, monthStart(s.extraFrom)) : 0;
  const lumps = new Map((s.lumps ?? []).map((l) => [monthsBetween(start, monthStart(l.month)), l.amount]));
  const rateChangeAt = s.rateFrom ? monthsBetween(start, monthStart(s.rateFrom.month)) : Infinity;
  const rows: Row[] = [];
  let balance = p.principal;
  let rate = p.rate;
  let payment = annuityPayment(balance, rate / 1200, p.termMonths);
  const linearRepayment = p.principal / p.termMonths;

  for (let i = 0; i < p.termMonths && balance > 0.005; i++) {
    if (i === rateChangeAt && s.rateFrom) {
      rate = s.rateFrom.rate;
      payment = annuityPayment(balance, rate / 1200, p.termMonths - i);
    }
    const r = rate / 1200;
    const interest = balance * r;
    let repayment =
      p.kind === "annuity" ? payment - interest : p.kind === "linear" ? linearRepayment : i === p.termMonths - 1 ? balance : 0;
    repayment = Math.min(Math.max(repayment, 0), balance);
    const extra = Math.min((i >= extraStart ? extraMonthly : 0) + (lumps.get(i) ?? 0), balance - repayment);
    balance = Math.max(balance - repayment - extra, 0);
    rows.push({ i, month: addMonths(start, i), interest, repayment, extra, payment: interest + repayment + extra, balance, rate });
  }
  return rows;
}

export type PartSummary = {
  part: MortgagePart;
  rows: Row[];
  /** Remaining debt at the end of `at`'s month (principal before start). */
  balance: number;
  repaidSoFar: number;
  interestSoFar: number;
  /** This month's row (null before the start or after payoff). */
  thisMonth: Row | null;
  totalInterest: number;
  totalPaid: number;
  end: Date;
  monthsLeft: number;
};

export function summarize(p: MortgagePart, at: Date, s: Scenario = {}): PartSummary {
  const rows = schedule(p, s);
  const k = monthsBetween(monthStart(p.start), monthStart(at));
  const done = rows.filter((r) => r.i <= k);
  const last = done[done.length - 1];
  const balance = k < 0 ? p.principal : (last?.balance ?? p.principal);
  return {
    part: p,
    rows,
    balance,
    repaidSoFar: p.principal - balance,
    interestSoFar: done.reduce((t, r) => t + r.interest, 0),
    thisMonth: rows.find((r) => r.i === k) ?? null,
    totalInterest: rows.reduce((t, r) => t + r.interest, 0),
    totalPaid: rows.reduce((t, r) => t + r.payment, 0),
    end: rows.length ? rows[rows.length - 1].month : monthStart(p.start),
    monthsLeft: Math.max(rows.length - 1 - k, 0),
  };
}

/** All parts together, per calendar month (for charts and totals). */
export function combined(parts: MortgagePart[], s: (p: MortgagePart) => Scenario = () => ({})) {
  const byMonth = new Map<number, { month: Date; interest: number; repayment: number; extra: number; balance: number }>();
  const all = parts.map((p) => schedule(p, s(p)));
  const first = parts.length ? Math.min(...parts.map((p) => monthStart(p.start).getTime())) : Date.now();
  const lastEnd = Math.max(first, ...all.map((rows) => (rows.length ? rows[rows.length - 1].month.getTime() : first)));
  // Every month from the first start to the last payoff; parts not yet
  // started count with their full principal, paid-off parts with 0.
  for (let m = new Date(first); m.getTime() <= lastEnd; m = addMonths(m, 1)) {
    const key = m.getTime();
    const row = { month: new Date(m), interest: 0, repayment: 0, extra: 0, balance: 0 };
    parts.forEach((p, j) => {
      const r = all[j].find((x) => x.month.getTime() === key);
      if (r) {
        row.interest += r.interest;
        row.repayment += r.repayment;
        row.extra += r.extra;
        row.balance += r.balance;
      } else if (key < monthStart(p.start).getTime()) row.balance += p.principal;
    });
    byMonth.set(key, row);
  }
  return [...byMonth.values()];
}

/** Calendar-year totals of the combined schedule. */
export function perYear(rows: ReturnType<typeof combined>) {
  const years = new Map<number, { year: number; interest: number; repayment: number; extra: number; balance: number }>();
  for (const r of rows) {
    const y = r.month.getFullYear();
    const e = years.get(y) ?? { year: y, interest: 0, repayment: 0, extra: 0, balance: 0 };
    e.interest += r.interest;
    e.repayment += r.repayment;
    e.extra += r.extra;
    e.balance = r.balance;
    years.set(y, e);
  }
  return [...years.values()];
}

/** Your share of the home: (value − debt) ÷ value, between 0 and 1. */
export const ownership = (value: number, debt: number) => (value > 0 ? Math.min(Math.max((value - debt) / value, 0), 1) : 0);

/** Loan-to-value: debt ÷ value. */
export const ltv = (value: number, debt: number) => (value > 0 ? debt / value : 0);

/** What an extra repayment plan saves, against the plan without it. */
export function extraEffect(p: MortgagePart, extra: Scenario) {
  const base = schedule(p, { extraMonthly: 0, lumps: [] });
  const withExtra = schedule(p, extra);
  const sum = (rows: Row[]) => rows.reduce((t, r) => t + r.interest, 0);
  return {
    interestSaved: sum(base) - sum(withExtra),
    monthsSooner: base.length - withExtra.length,
    end: withExtra.length ? withExtra[withExtra.length - 1].month : monthStart(p.start),
  };
}

// ---- Netherlands -----------------------------------------------------------
// Estimates for the "eigen woning" (box 1). The rates change every year;
// these are the 2025 values — check the Belastingdienst for the current year.
export const NL = {
  /** Maximum rate at which mortgage interest is deductible. */
  maxDeductionRate: 0.3748,
  /** Eigenwoningforfait: share of the WOZ value added to income. */
  forfaitRate: 0.0035,
  /** Above this WOZ value a higher forfait applies (not modelled). */
  forfaitCap: 1_330_000,
  /** Boetevrij extra aflossen: usually 10% of the original loan per year. */
  penaltyFreeShare: 0.1,
};

/** Monthly tax effect in the Netherlands: deductible interest (annuity and
 *  linear parts — interest-only parts taken out after 2013 don't qualify,
 *  so they're excluded) minus the forfait, at the maximum deduction rate.
 *  Positive = you get money back. Simplified (no Wet Hillen, no partner
 *  split); shown as an estimate. */
export function nlMonthlyTaxEffect(parts: MortgagePart[], at: Date, woz: number) {
  const interest = parts
    .filter((p) => p.kind !== "interest_only")
    .reduce((t, p) => t + (summarize(p, at).thisMonth?.interest ?? 0), 0);
  const forfait = (Math.min(woz, NL.forfaitCap) * NL.forfaitRate) / 12;
  const effect = Math.max(interest - forfait, 0) * NL.maxDeductionRate;
  return { deductibleInterest: interest, forfait, effect };
}
