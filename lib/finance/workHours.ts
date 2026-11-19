// What spending costs in time (Bart, 19 Nov): in work hours (net pay at 40
// hours a week, as on the "An hour of your work" tile) and in real hours
// (the money clock's day: the month's income spread over every hour of the
// month). Shown on the Month Wrapped, under each expense and in the monthly
// PDF. Pure (no imports), so it's tested with plain node and ported to the apps.

/** Net hours worked in a month at 40 hours a week (52 × 40 / 12). */
export const WORK_HOURS_MONTH = 173.3;
/** A working day. */
export const WORK_DAY = 8;

export type WorkCostRow = { key: string; name: string; color: string; amount: number };

/** An amount in work hours, for a monthly net income. Null without income. */
export function workHoursFor(amount: number, monthlyIncome: number): number | null {
  return monthlyIncome > 0 ? (amount / monthlyIncome) * WORK_HOURS_MONTH : null;
}

/** The month's spending in time: in total and per row, biggest first. */
export function workCost(income: number, days: number, rows: WorkCostRow[]) {
  if (!(income > 0)) return null;
  const perWorkHour = income / WORK_HOURS_MONTH;
  const realHoursMonth = days * 24;
  const perRealHour = income / realHoursMonth;
  const of = (amount: number) => ({ amount, workHours: amount / perWorkHour, realHours: amount / perRealHour });
  const list = rows.filter((r) => r.amount > 0.005).sort((a, b) => b.amount - a.amount).map((r) => ({ ...r, ...of(r.amount) }));
  const spent = list.reduce((s, r) => s + r.amount, 0);
  const total = of(spent);
  return {
    perWorkHour,
    perRealHour,
    total: { ...total, workDays: total.workHours / WORK_DAY, realDays: total.realHours / 24 },
    /** Days of the month left for yourself (the rest of the real days). */
    freeDays: Math.max(days - total.realHours / 24, 0),
    rows: list,
  };
}

export type WorkCost = NonNullable<ReturnType<typeof workCost>>;

/** A time as a short reading: minutes under an hour, else hours to one decimal. */
export function timeParts(hours: number): { value: number; unit: "min" | "h" } {
  if (hours < 1) return { value: Math.max(Math.round(hours * 60), 1), unit: "min" };
  return { value: Math.round(hours * 10) / 10, unit: "h" };
}
