// Key figures: the numbers that say how someone is doing — from a handful
// of month and balance figures. Pure (no imports), so the onboarding tour,
// the Key figures page and the dashboard share them, and the apps can port
// them 1:1. Each figure carries a rule of thumb ("20% or more is strong")
// and a tone, so the number means something.

export type MetricInput = {
  /** Net income per month (expected). */
  income: number;
  /** Fixed costs per month. */
  fixed: number;
  /** Everything spent per month (fixed + variable, expected). */
  spending: number;
  /** In accounts now. */
  cash: number;
  /** Investments at market value now. */
  investments: number;
  /** Balance sheet totals now. */
  assets: number;
  debts: number;
  /** This year so far: kept from income + debt paid off, and the investments' market gain. */
  growth?: { work: number; investments: number } | null;
  /** Budgets still free this month, and the days left in it (incl. today). */
  freeThisMonth?: number | null;
  daysLeft?: number;
  /** Runway goal in months (profile; default 6). */
  runwayGoal?: number;
};

export type Tone = "good" | "ok" | "bad" | "neutral";
export type Metric = {
  key: string;
  /** English keys for t(). */
  label: string;
  note: string;
  value: number;
  unit: "pct" | "money" | "months" | "years" | "duration";
  /** 0–1 for a bar (null: no bar). */
  bar: number | null;
  tone: Tone;
  /** Amounts for the note's {placeholders}, formatted as money when shown. */
  noteMoney?: Record<string, number>;
  /** A second amount under the value (English key for t(), {amount} filled in). */
  sub?: { label: string; value: number };
};

/** Net hours worked in a month at 40 hours a week (52 × 40 / 12). */
export const WORK_HOURS = 173.3;

/** Every hour of a month, day and night (365.25 × 24 / 12) — the money clock's day. */
export const CLOCK_HOURS = 730.5;

/** The freedom number (25 × a year's spending — the 4% rule), the share of
 *  it already there (cash + investments), and the years to get there saving
 *  `left` a month at `growth` a year (null: not at this rate; 0: there). */
export function freedom(spendingPerMonth: number, have: number, left: number, growth = 0.05) {
  const target = spendingPerMonth * 12 * 25;
  const share = target > 0 ? Math.max(0, have) / target : 0;
  if (target <= 0) return { target, share, years: null as number | null };
  if (have >= target) return { target, share, years: 0 };
  if (left <= 0) return { target, share, years: null };
  const r = (1 + growth) ** (1 / 12) - 1;
  let v = have;
  for (let m = 1; m <= 12 * 80; m++) {
    v = v * (1 + r) + left;
    if (v >= target) return { target, share, years: m / 12 };
  }
  return { target, share, years: null };
}

/** Months until a negative equity reaches zero, saving `left` a month
 *  (null: not negative, or not at this rate). */
export function monthsToPositive(equity: number, left: number) {
  if (equity >= 0 || left <= 0) return null;
  return Math.ceil(-equity / left);
}

/** Where this year's equity growth came from (Bart, 19 Nov): what was kept
 *  from income plus debt paid off ("work"), against the investments' market
 *  gain. The share from work of what grew (losses count as nothing grown);
 *  null when nothing grew. */
export function growthFromWork(work: number, investments: number) {
  const w = Math.max(work, 0), i = Math.max(investments, 0);
  return w + i > 0.005 ? w / (w + i) : null;
}

export function keyMetrics(x: MetricInput): Metric[] {
  const out: Metric[] = [];
  const left = x.income - x.spending;
  const equity = x.assets - x.debts;
  if (x.income > 0) {
    const rate = left / x.income;
    out.push({ key: "rate", label: "Savings rate", note: "20% or more is strong.", value: rate, unit: "pct", bar: rate / 0.3, tone: rate >= 0.2 ? "good" : rate >= 0.1 ? "ok" : "bad" });
  }
  if (x.spending > 0) {
    const runway = x.cash / x.spending;
    const goal = x.runwayGoal ?? 6;
    out.push({ key: "runway", label: "Runway", note: "How long your accounts would last without income. 3–6 months is a healthy buffer.", value: runway, unit: "months", bar: runway / goal, tone: runway >= goal ? "good" : runway >= goal / 2 ? "ok" : "bad" });
  }
  if (x.income > 0) {
    const share = x.fixed / x.income;
    out.push({ key: "fixed", label: "Fixed costs of income", note: "Under 50% leaves room to breathe.", value: share, unit: "pct", bar: share, tone: share <= 0.5 ? "good" : share <= 0.65 ? "ok" : "bad" });
    out.push({ key: "hour", label: "An hour of your work", note: "Net, at 40 hours a week.", value: x.income / WORK_HOURS, unit: "money", bar: null, tone: "neutral", sub: { label: "{amount} an hour around the clock (24 h a day)", value: x.income / CLOCK_HOURS } });
  }
  if (x.freeThisMonth != null && (x.daysLeft ?? 0) > 0) {
    const perDay = x.freeThisMonth / (x.daysLeft as number);
    out.push({ key: "day", label: "Free to spend per day", note: "What's left of your budgets, over the days left this month.", value: perDay, unit: "money", bar: null, tone: perDay >= 0 ? "neutral" : "bad" });
  }
  const fromWork = x.growth ? growthFromWork(x.growth.work, x.growth.investments) : null;
  if (x.growth && fromWork != null) {
    out.push({ key: "growth", label: "Equity growth from work", note: "{work} from work · {investments} from investments, this year.", noteMoney: { work: x.growth.work, investments: x.growth.investments }, value: fromWork, unit: "pct", bar: fromWork, tone: "neutral" });
  }
  if (x.spending > 0) {
    const months = equity / x.spending;
    out.push({ key: "equity", label: "Equity in months of living", note: "How many months your whole equity would carry you.", value: months, unit: "months", bar: null, tone: equity > 0 ? "good" : "bad" });
  }
  if (x.assets > 0) {
    const ratio = x.debts / x.assets;
    out.push({ key: "debt", label: "Debt ratio", note: "Debts against everything you own. Lower means more of it is yours.", value: ratio, unit: "pct", bar: ratio, tone: ratio <= 0.5 ? "good" : ratio <= 0.8 ? "ok" : "bad" });
  }
  return out;
}
