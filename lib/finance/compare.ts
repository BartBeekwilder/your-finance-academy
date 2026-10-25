// Comparing spending across years and months — pure functions, no imports
// beyond types, so they can be tested with plain node and ported 1:1.
//
// Spending per top-level category (subcategories roll up) per calendar
// month, for this year and the years before. Until earlier years are
// imported, a missing year can be filled with a *sample*: this year's
// pattern scaled (−20 %, +20 %, −10 %) with a little wobble per month, so the
// charts can be tried. Sample months are flagged and never stored; a month
// that has real spending always uses the real numbers.

import type { FinanceData } from "./types";

/** Key for all categories together. */
export const ALL = "all";

export type YearRow = {
  year: number;
  /** Per month (Jan = 0); null = still to come (this year). */
  values: (number | null)[];
  /** Per month: true when the value is a sample, not real data. */
  sample: boolean[];
};

const FACTORS = [0.8, 1.2, 0.9, 1.1];

/** Deterministic month-to-month variation for sample years. */
const wobble = (k: number, m: number) => 1 + 0.12 * Math.sin(k * 7.3 + m * 1.9);

/** Spending per key (top-level category id, and ALL) per month of `year`. */
export function spendGrid(data: Pick<FinanceData, "transactions" | "categories">, year: number) {
  const parent = new Map(data.categories.map((c) => [c.id, c.parent_id ?? c.id]));
  const grid = new Map<string, number[]>();
  const row = (k: string) => grid.get(k) ?? (grid.set(k, new Array(12).fill(0)), grid.get(k)!);
  for (const t of data.transactions) {
    if (t.deleted_at || t.type !== "expense") continue;
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
export function compareYears(data: Pick<FinanceData, "transactions" | "categories">, now: Date, opts: { back?: number; sample?: boolean } = {}) {
  const back = opts.back ?? 3;
  const year = now.getFullYear(), current = now.getMonth();
  const grids = new Map<number, Map<string, number[]>>();
  for (let y = year - back; y <= year; y++) grids.set(y, spendGrid(data, y));
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
      for (let m = 0; m < 12; m++) {
        if (y === year && m > current) {
          values.push(null);
          sample.push(false);
        } else if (y < year && opts.sample && allReal[m] === 0) {
          values.push(Math.round(base(key, m) * FACTORS[(k - 1) % FACTORS.length] * wobble(k, m) * 100) / 100);
          sample.push(true);
        } else {
          values.push(real[m]);
          sample.push(false);
        }
      }
      list.push({ year: y, values, sample });
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
