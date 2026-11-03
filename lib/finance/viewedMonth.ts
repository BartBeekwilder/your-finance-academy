// The earlier month a page is showing (Expenses / Income month picker), so
// Quick Add can start its date there: looking at October, a new cost lands
// in October, and a category opened there shows October. null = this month.

let viewed: Date | null = null;

export function setViewedMonth(month: Date | null) {
  viewed = month;
}

/** The last moment of the month being viewed (that month seen as
 *  finished), or null when it's this month. */
export function viewedMonthEnd(): Date | null {
  return viewed ? new Date(viewed.getFullYear(), viewed.getMonth() + 1, 0, 23, 59, 59) : null;
}

/** The day Quick Add starts on: today, or the same day in the month being
 *  viewed (the last day when that month is shorter). */
export function startDate(now = new Date()): Date {
  if (!viewed) return now;
  const last = new Date(viewed.getFullYear(), viewed.getMonth() + 1, 0).getDate();
  return new Date(viewed.getFullYear(), viewed.getMonth(), Math.min(now.getDate(), last), 12);
}
