// Salary helpers: which income is salary, and the payday nearest a date.
// Pure (no imports), so it's tested with plain node and ported to the apps.

const SALARY = /salar|loon|lohn|gehalt|salaire|sueldo|stipend|wage|maaş|зарплат|給|급여|工资|راتب|वेतन|gaji|lương/i;

/** A salary-like category name, in any of the app's languages. */
export const isSalaryName = (name: string | null | undefined) => !!name && SALARY.test(name);

/** The payday (day of the month, clamped to short months) nearest `today`:
 *  this month's, last month's or next month's. */
export function nearestPayday(payday: number, today: Date) {
  const at = (offset: number) => {
    const y = today.getFullYear(), m = today.getMonth() + offset;
    return new Date(y, m, Math.min(payday, new Date(y, m + 1, 0).getDate()));
  };
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return [at(-1), at(0), at(1)].reduce((best, d) => (Math.abs(d.getTime() - day) < Math.abs(best.getTime() - day) ? d : best));
}

/** The income category the salary usually lands in: the one with the most
 *  incomes of at least half the expected net pay (null if none). */
export function mainIncomeCategory(transactions: { type: string; amount: string | number; category_id: string | null; deleted_at?: string | null }[], expectedNet: number) {
  if (!(expectedNet > 0)) return null;
  const count = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "income" || t.deleted_at || !t.category_id || Number(t.amount) < expectedNet * 0.5) continue;
    count.set(t.category_id, (count.get(t.category_id) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [id, n] of count) if (best === null || n > count.get(best)!) best = id;
  return best;
}
