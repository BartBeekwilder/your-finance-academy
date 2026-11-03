// The earlier month a page is showing (Expenses / Income month picker), so
// Quick Add can start its date there: looking at October, a new cost lands
// in October. null = this month.

let viewed: Date | null = null;

export function setViewedMonth(month: Date | null) {
  viewed = month;
}

/** The day Quick Add starts on: today, or the same day in the month being
 *  viewed (the last day when that month is shorter). */
export function startDate(now = new Date()): Date {
  if (!viewed) return now;
  const last = new Date(viewed.getFullYear(), viewed.getMonth() + 1, 0).getDate();
  return new Date(viewed.getFullYear(), viewed.getMonth(), Math.min(now.getDate(), last), 12);
}
