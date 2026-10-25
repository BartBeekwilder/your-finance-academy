// Comparing spending across years and months — pure functions, no imports
// beyond types, so they can be tested with plain node and ported 1:1.
//
// Spending per top-level category (subcategories roll up) per calendar
// month, for this year and the years before. Three sources, in this order:
//   real    — transactions in that month;
//   yearly  — an imported year total per category (data.yearCategoryTotals):
//             what the transactions of that year don't cover yet, spread
//             evenly over its months without transactions;
//   sample  — (opt-in) a year with no data at all: this year's pattern
//             scaled (−20 %, +20 %, −10 %) with a little wobble per month, so
//             the charts can be tried. Never stored.
// A year that has imported spending but no income is not sampled for
// income — it's marked missing instead of invented.

import type { FinanceData } from "./types";

/** Key for all categories together. */
export const ALL = "all";

export type YearRow = {
  year: number;
  /** Per month (Jan = 0); null = still to come (this year). */
  values: (number | null)[];
  /** Per month: true when the value is a sample, not real data. */
  sample: boolean[];
  /** Per month: true when the value comes from an imported year total. */
  yearly: boolean[];
  /** No data of this kind for the year at all (and not sampled). */
  missing: boolean;
};

type Data = Pick<FinanceData, "transactions" | "categories" | "yearCategoryTotals" | "yearIncomeTotals">;

const FACTORS = [0.8, 1.2, 0.9, 1.1];

/** Deterministic month-to-month variation for sample years. */
const wobble = (k: number, m: number) => 1 + 0.12 * Math.sin(k * 7.3 + m * 1.9);

/** Spending (or income) per key (top-level category id, and ALL) per month
 *  of `year`. */
export function spendGrid(data: Pick<FinanceData, "transactions" | "categories">, year: number, type: "expense" | "income" = "expense") {
  const parent = new Map(data.categories.map((c) => [c.id, c.parent_id ?? c.id]));
  const grid = new Map<string, number[]>();
  const row = (k: string) => grid.get(k) ?? (grid.set(k, new Array(12).fill(0)), grid.get(k)!);
  for (const t of data.transactions) {
    if (t.deleted_at || t.type !== type) continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== year) continue;
    const v = Number(t.amount) || 0;
    row(ALL)[d.getMonth()] += v;
    const key = t.category_id ? (parent.get(t.category_id) ?? t.category_id) : "none";
    row(key)[d.getMonth()] += v;
  }
  return grid;
}

/**
 * This year plus `back` earlier years, per key. `sample`: fill months of
 * earlier years that have no spending at all with a sample (see above).
 */
export function compareYears(data: Data, now: Date, opts: { back?: number; sample?: boolean; type?: "expense" | "income" } = {}) {
  const back = opts.back ?? 3;
  const year = now.getFullYear(), current = now.getMonth();
  const grids = new Map<number, Map<string, number[]>>();
  for (let y = year - back; y <= year; y++) grids.set(y, spendGrid(data, y, opts.type));
  const thisYear = grids.get(year)!;
  const keys = new Set<string>([ALL]);
  for (const g of grids.values()) for (const k of g.keys()) keys.add(k);

  // The base a sample is made from: this year's month, or — for this month
  // (still running) and the months ahead — this year's finished average.
  const base = (key: string, m: number) => {
    const row = thisYear.get(key) ?? new Array(12).fill(0);
    if (m < current) return row[m];
    const done = row.slice(0, current);
    return done.length ? done.reduce((a, b) => a + b, 0) / done.length : row[current];
  };

  // Imported year totals, per year and key: spending per category, income
  // as one total (ALL).
  const type = opts.type ?? "expense";
  const parent = new Map(data.categories.map((c) => [c.id, c.parent_id ?? c.id]));
  const hist = new Map<number, Map<string, number>>();
  const add = (year: number, key: string, v: number) => {
    const m = hist.get(year) ?? (hist.set(year, new Map()), hist.get(year)!);
    m.set(key, (m.get(key) ?? 0) + v);
    if (key !== ALL) m.set(ALL, (m.get(ALL) ?? 0) + v);
    keys.add(key);
  };
  if (type === "expense")
    for (const h of data.yearCategoryTotals ?? []) add(h.year, h.category_id ? (parent.get(h.category_id) ?? h.category_id) : "none", Number(h.amount) || 0);
  else for (const h of data.yearIncomeTotals ?? []) add(h.year, ALL, Number(h.amount) || 0);
  // Years with any imported history (either kind) are never sampled.
  const imported = new Set([...(data.yearCategoryTotals ?? []).map((h) => h.year), ...(data.yearIncomeTotals ?? []).map((h) => h.year)]);

  const rows = new Map<string, YearRow[]>();
  for (const key of keys) {
    const list: YearRow[] = [];
    for (let y = year; y >= year - back; y--) {
      const g = grids.get(y)!;
      const real = g.get(key) ?? new Array(12).fill(0);
      const allReal = g.get(ALL) ?? new Array(12).fill(0);
      const k = year - y;
      const values: (number | null)[] = [];
      const sample: boolean[] = [];
      const yearly: boolean[] = [];
      const yh = y < year ? hist.get(y) : undefined;
      // Imported total: what the year's transactions don't cover, over the
      // months that have no transactions at all.
      const open = allReal.map((v, m) => v === 0 && (y < year || m <= current));
      const left = yh ? Math.max((yh.get(key) ?? 0) - real.reduce((a, b) => a + b, 0), 0) : 0;
      const nOpen = open.filter(Boolean).length;
      const hasData = allReal.some((v) => v !== 0) || !!yh;
      // A year with imported spending but no income isn't invented.
      const histYear = imported.has(y);
      // Samples only for years nothing was imported for.
      const canSample = y < year && !!opts.sample && !histYear;
      for (let m = 0; m < 12; m++) {
        if (y === year && m > current) {
          values.push(null);
          sample.push(false);
          yearly.push(false);
        } else if (yh && open[m]) {
          values.push(nOpen ? Math.round((left / nOpen) * 100) / 100 : 0);
          sample.push(false);
          yearly.push(true);
        } else if (canSample && allReal[m] === 0) {
          values.push(Math.round(base(key, m) * FACTORS[(k - 1) % FACTORS.length] * wobble(k, m) * 100) / 100);
          sample.push(true);
          yearly.push(false);
        } else {
          values.push(real[m]);
          sample.push(false);
          yearly.push(false);
        }
      }
      list.push({ year: y, values, sample, yearly, missing: y < year && !hasData && !canSample });
    }
    rows.set(key, list);
  }
  return rows;
}

/** Running total; nulls stay null. */
export const cumulative = (values: (number | null)[]) => {
  let s = 0;
  return values.map((v) => (v == null ? null : (s += v)));
};

/** Earlier years' min, average and max per month (null when none). */
export function spread(rows: YearRow[]) {
  return Array.from({ length: 12 }, (_, m) => {
    const vs = rows.map((r) => r.values[m]).filter((v): v is number => v != null);
    if (!vs.length) return null;
    return { min: Math.min(...vs), max: Math.max(...vs), avg: vs.reduce((a, b) => a + b, 0) / vs.length };
  });
}

export type YearTotal = {
  year: number;
  income: number;
  spent: number;
  /** This year: what the forecast adds for the rest of the year. */
  incomeAhead: number;
  spentAhead: number;
  /** Some months are samples (see compareYears). */
  sample: boolean;
  /** Some months come from imported year totals. */
  yearly: boolean;
  /** No income known for this year (imported spending only). */
  incomeMissing: boolean;
};

/** Income and spending per calendar year, this year and `back` before it,
 *  for the dashboard's Years view. This year counts what's entered so far;
 *  `ahead` (from the caller's forecast, per month from the current one on)
 *  gives the rest. Earlier years can be sampled like compareYears. */
export function yearTotals(
  data: Data,
  now: Date,
  ahead: { income: number; spent: number }[] = [],
  opts: { back?: number; sample?: boolean } = {},
): YearTotal[] {
  const spent = compareYears(data, now, { ...opts, type: "expense" }).get(ALL)!;
  const income = compareYears(data, now, { ...opts, type: "income" }).get(ALL)!;
  const sum = (v: (number | null)[]) => v.reduce<number>((a, b) => a + (b ?? 0), 0);
  // Ahead starts with the current month in full; what's entered this month
  // is already in the totals, so only the rest of it counts.
  const cur = now.getMonth();
  return spent.map((s, i) => {
    const inc = income[i];
    const isNow = i === 0;
    const enteredSpent = s.values[cur] ?? 0, enteredIncome = inc.values[cur] ?? 0;
    return {
      year: s.year,
      income: sum(inc.values),
      spent: sum(s.values),
      incomeAhead: isNow ? ahead.reduce((a, f, k) => a + (k === 0 ? Math.max(f.income - enteredIncome, 0) : f.income), 0) : 0,
      spentAhead: isNow ? ahead.reduce((a, f, k) => a + (k === 0 ? Math.max(f.spent - enteredSpent, 0) : f.spent), 0) : 0,
      sample: s.sample.some(Boolean) || inc.sample.some(Boolean),
      yearly: s.yearly.some(Boolean),
      incomeMissing: inc.missing,
    };
  }).reverse();
}

/** How many years back the history goes (imported totals, snapshots or
 *  transactions), at least `min` (so samples can fill a short history). */
export function historyBack(data: Data & Pick<FinanceData, "yearSnapshots">, now: Date, min = 3, max = 12) {
  const years = [
    ...(data.yearCategoryTotals ?? []).map((h) => h.year),
    ...(data.yearIncomeTotals ?? []).map((h) => h.year),
    ...data.transactions.filter((t) => !t.deleted_at).map((t) => new Date(t.date).getFullYear()),
  ];
  const first = years.length ? Math.min(...years) : now.getFullYear();
  return Math.min(Math.max(now.getFullYear() - first, min), max);
}
