// The year clock (Bart, 28 Nov): the year's income as the whole year, 1 Jan
// to 31 Dec. Each cost takes the days its share of the income takes — the
// biggest first, so the year starts with what costs the most ("until 3 April
// you work for your home") — and from the day after the last cost you work
// for yourself. Spending more than comes in never gets there: the costs run
// past New Year's Eve. With tips: spend less on a variable cost and that day
// comes sooner. Pure (no imports), so it's tested with plain node and ported
// to the apps.

export type YearRow = { key: string; name: string; color: string; amount: number; variable: boolean };

export type YearSlice = YearRow & {
  /** Days of the year this takes (income = the whole year). */
  days: number;
  /** Where it starts and ends, in days from 1 January (0 = 1 Jan 00:00). */
  from: number;
  to: number;
};

export type YearClock = {
  year: number;
  /** Days in the year (365 or 366). */
  length: number;
  income: number;
  spent: number;
  slices: YearSlice[];
  /** The day you start working for yourself (days from 1 Jan); null when the costs take the whole year. */
  freeFrom: number | null;
  /** What's left for yourself. */
  kept: number;
  /** Days past 31 December the costs run on (0 when within the year). */
  overDays: number;
};

export type YearTip = {
  key: string;
  name: string;
  color: string;
  /** The share less (0.25 = a quarter less). */
  cut: number;
  /** What that saves in the year. */
  saves: number;
  /** Days sooner you'd work for yourself. */
  daysSooner: number;
  /** The new day you'd start working for yourself (days from 1 Jan), or null if still none. */
  freeFrom: number | null;
};

/** Rows smaller than this share of the year (about two days) are grouped. */
const SMALL = 2 / 365;

export const daysInYear = (year: number) => (new Date(year, 1, 29).getMonth() === 1 ? 366 : 365);

export function yearClock(year: number, income: number, rows: YearRow[], rest = { key: "rest", name: "Other", color: "#8e8e93" }): YearClock | null {
  if (!(income > 0)) return null;
  const length = daysInYear(year);
  const spending = rows.filter((r) => r.amount > 0.005).sort((a, b) => b.amount - a.amount);
  const big = spending.filter((r) => r.amount / income >= SMALL);
  const small = spending.filter((r) => r.amount / income < SMALL);
  const smallTotal = small.reduce((s, r) => s + r.amount, 0);
  const ordered = smallTotal > 0.005 ? [...big, { ...rest, amount: smallTotal, variable: small.some((r) => r.variable) }] : big;

  let at = 0;
  const slices = ordered.map((r) => {
    const days = (r.amount / income) * length;
    const s = { ...r, days, from: at, to: at + days };
    at += days;
    return s;
  });
  const spent = spending.reduce((s, r) => s + r.amount, 0);
  const kept = income - spent;
  return { year, length, income, spent, slices, kept: Math.max(kept, 0), freeFrom: kept > 0.005 ? at : null, overDays: Math.max(at - length, 0) };
}

/** The variable costs that would move the day most: each `cut` less (the
 *  biggest first, at most `n`). Fixed costs (rent, the mortgage) are left
 *  out — those don't change by spending less this month. */
export function yearTips(clock: YearClock, rows: YearRow[], cut = 0.25, n = 3): YearTip[] {
  const per = clock.length / clock.income;
  return rows
    .filter((r) => r.variable && r.amount > 0.005)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n)
    .map((r) => {
      const saves = r.amount * cut;
      const end = clock.spent - saves;
      const left = clock.income - end;
      return { key: r.key, name: r.name, color: r.color, cut, saves, daysSooner: saves * per, freeFrom: left > 0.005 ? end * per : null };
    })
    .filter((tip) => tip.daysSooner >= 0.5);
}

/** Days from 1 January → that date (day 0 = 1 January). */
export function dateOf(year: number, day: number): Date {
  return new Date(year, 0, 1 + Math.floor(day));
}
