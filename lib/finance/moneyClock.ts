// The money clock (Bart, 19 Nov): a month's income as one day of 24 hours.
// Each category gets the hours its spending takes of that income — the
// biggest first, so the day starts with what costs the most ("until 08:00
// you work for your home") — and what's left is time for yourself. Spending
// more than came in runs past midnight. Pure (no imports), so it's tested
// with plain node and ported to the apps.

export type ClockRow = { key: string; name: string; color: string; amount: number };

export type ClockSlice = ClockRow & {
  /** Hours of the day this takes (income = 24). */
  hours: number;
  /** Where it starts and ends on the dial, in hours from midnight. */
  from: number;
  to: number;
  /** The same per day of the month. */
  perDay: number;
};

export type MoneyClock = {
  income: number;
  spent: number;
  slices: ClockSlice[];
  /** What's left for yourself: from [keptFrom] to midnight (null when nothing is left). */
  kept: number;
  keptFrom: number | null;
  /** Spent beyond the income: the hours past midnight (0 when within it). */
  overHours: number;
};

/** Rows smaller than this share of the day (about 20 minutes) are grouped. */
const SMALL = 1 / 72;

export function moneyClock(income: number, rows: ClockRow[], days: number, rest = { key: "rest", name: "Other", color: "#8e8e93" }): MoneyClock | null {
  if (!(income > 0)) return null;
  const spending = rows.filter((r) => r.amount > 0.005).sort((a, b) => b.amount - a.amount);
  const big = spending.filter((r) => r.amount / income >= SMALL);
  const small = spending.filter((r) => r.amount / income < SMALL);
  const smallTotal = small.reduce((s, r) => s + r.amount, 0);
  const ordered = smallTotal > 0.005 ? [...big, { ...rest, amount: smallTotal }] : big;

  let at = 0;
  const slices = ordered.map((r) => {
    const hours = (r.amount / income) * 24;
    const s = { ...r, hours, from: at, to: at + hours, perDay: r.amount / days };
    at += hours;
    return s;
  });
  const spent = spending.reduce((s, r) => s + r.amount, 0);
  const kept = income - spent;
  return { income, spent, slices, kept: Math.max(kept, 0), keptFrom: kept > 0.005 ? at : null, overHours: Math.max(at - 24, 0) };
}

/** 7.5 → "07:30"; past midnight it goes on (25.5 → "01:30"). */
export function clockTime(h: number): string {
  const m = Math.round(h * 60);
  const hh = Math.floor(m / 60) % 24, mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 2.25 → { h: 2, m: 15 }. */
export function duration(h: number) {
  const m = Math.round(h * 60);
  return { h: Math.floor(m / 60), m: m % 60 };
}
