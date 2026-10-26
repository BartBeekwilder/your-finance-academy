// Progress — the game rules, pure functions only (no imports), so iOS and
// Android can port them 1:1 and they can be tested with plain node.
//
//   Rings   (per month): Tracking (days you updated the books), Budget
//           (share of budgets on track), Saving (saved vs. the target).
//   Streak  consecutive days with activity; one free day per 7 days, so a
//           missed day doesn't break it (fitness apps lose people there).
//   Points  for closing a month, for closed rings, for badges, a little for
//           each active day. Points make your level.
//   Badges  a catalogue of habits, progress and discipline; each is earned
//           once (achievements table).
// Rewards go to good habits and real progress — never to spending.

export const LEVELS = [
  { name: "Starter", min: 0 },
  { name: "Bookkeeper", min: 500 },
  { name: "Controller", min: 1500 },
  { name: "CFO", min: 4000 },
  { name: "Investor", min: 10000 },
] as const;

export const POINTS = {
  monthClose: 100,
  ring: 50,
  activeDay: 5,
} as const;

export function level(points: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i], next = LEVELS[i + 1] ?? null;
  const progress = next ? (points - cur.min) / (next.min - cur.min) : 1;
  return { index: i, name: cur.name, next: next?.name ?? null, toNext: next ? next.min - points : 0, progress };
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Consecutive active days up to today (or yesterday, if today isn't
 *  active yet), allowing one missed day in any 7 days. */
export function streak(activeDays: string[], today: Date) {
  const set = new Set(activeDays.map((d) => d.slice(0, 10)));
  let d = set.has(dayKey(today)) ? today : addDays(today, -1);
  let count = 0;
  const missed: number[] = []; // positions (in days walked) of free days used
  for (let walked = 0; walked < 3660; walked++, d = addDays(d, -1)) {
    if (set.has(dayKey(d))) {
      count++;
      continue;
    }
    // A free day is allowed if none was used in the last 6 walked days, and
    // the day before it is active (a gap of one, not the end of the run).
    const recent = missed.some((m) => walked - m < 7);
    if (!recent && set.has(dayKey(addDays(d, -1))) && count > 0) {
      missed.push(walked);
      continue;
    }
    break;
  }
  return count;
}

export type RingInput = {
  daysElapsed: number;
  activeDaysInMonth: number;
  /** Budgeted categories: spent so far and the budget for the month. */
  budgets: { spent: number; budget: number; fixed: boolean }[];
  /** Share of the month elapsed (1 for a finished month). */
  fraction: number;
  /** Saved so far this month (income − spending, live). */
  saved: number;
  /** The month's savings target (full month). */
  savingsTarget: number;
};

/** The three rings, each 0…1 (can exceed 1 for saving). */
export function rings(r: RingInput) {
  const tracking = r.daysElapsed > 0 ? Math.min(r.activeDaysInMonth / r.daysElapsed, 1) : 0;
  // Fixed costs are on track while within the budget; variable spending
  // while within the budget's share for the part of the month gone by.
  const onTrack = r.budgets.filter((b) => b.spent <= (b.fixed ? b.budget : b.budget * r.fraction) + 0.005);
  // No budgets, no ring: it closes by keeping budgets, not by having none.
  const budget = r.budgets.length ? onTrack.length / r.budgets.length : 0;
  const target = r.savingsTarget * r.fraction;
  const saving = target > 0 ? Math.max(r.saved / target, 0) : r.saved > 0 ? 1 : 0;
  return { tracking, budget, saving };
}

export const ringsClosed = (x: ReturnType<typeof rings>) => [x.tracking >= 0.999, x.budget >= 0.999, x.saving >= 0.999].filter(Boolean).length;

// ---- Badges ----------------------------------------------------------------

export type BadgeContext = {
  closes: number;
  /** Closed months in order, with what was saved and whether every budget
   *  was kept. */
  closed: { saved: number; savingsRate: number; allBudgetsKept: boolean }[];
  streak: number;
  savedTotal: number;
  equity: number;
  goals: number;
  goalsAchieved: number;
  balancePosts: number;
  properties: number;
  ownership: number;
  /** Debts other than the mortgage. */
  otherDebt: number;
  /** Payslips kept, each as its month ("2026-10") and the month it was
   *  added — earlier = uploaded afterwards. Optional for older callers. */
  payslips?: { month: string; added: string }[];
};

export type Badge = {
  code: string;
  group: "habits" | "progress" | "discipline" | "discover";
  title: string;
  hint: string;
  icon: string;
  points: number;
  earned: (c: BadgeContext) => boolean;
};

const consecutive = (c: BadgeContext, n: number, f: (m: BadgeContext["closed"][number]) => boolean) => {
  let run = 0;
  for (const m of c.closed) {
    run = f(m) ? run + 1 : 0;
    if (run >= n) return true;
  }
  return false;
};

/** Some year with a payslip for every month. */
const fullYear = (slips: { month: string }[]) => {
  const months = new Map<string, Set<string>>();
  for (const p of slips) months.set(p.month.slice(0, 4), (months.get(p.month.slice(0, 4)) ?? new Set()).add(p.month.slice(5, 7)));
  return [...months.values()].some((m) => m.size >= 12);
};

export const BADGES: Badge[] = [
  { code: "first-close", group: "habits", title: "First month closed", hint: "Close a month", icon: "calendar-check", points: 100, earned: (c) => c.closes >= 1 },
  { code: "closes-3", group: "habits", title: "Quarter in the books", hint: "Close 3 months", icon: "calendar-range", points: 150, earned: (c) => c.closes >= 3 },
  { code: "closes-12", group: "habits", title: "A full year closed", hint: "Close 12 months", icon: "trophy", points: 500, earned: (c) => c.closes >= 12 },
  { code: "streak-7", group: "habits", title: "One week streak", hint: "Update your books 7 days in a row", icon: "flame", points: 50, earned: (c) => c.streak >= 7 },
  { code: "streak-30", group: "habits", title: "30-day streak", hint: "Update your books 30 days in a row", icon: "flame", points: 200, earned: (c) => c.streak >= 30 },
  { code: "streak-100", group: "habits", title: "100-day streak", hint: "Update your books 100 days in a row", icon: "flame", points: 600, earned: (c) => c.streak >= 100 },
  { code: "saved-1k", group: "progress", title: "First €1,000 saved", hint: "Save 1,000 in total", icon: "piggy-bank", points: 100, earned: (c) => c.savedTotal >= 1000 },
  { code: "saved-10k", group: "progress", title: "€10,000 saved", hint: "Save 10,000 in total", icon: "piggy-bank", points: 300, earned: (c) => c.savedTotal >= 10000 },
  { code: "saved-50k", group: "progress", title: "€50,000 saved", hint: "Save 50,000 in total", icon: "gem", points: 800, earned: (c) => c.savedTotal >= 50000 },
  { code: "equity-positive", group: "progress", title: "In the black", hint: "Have positive equity", icon: "trending-up", points: 100, earned: (c) => c.equity > 0 },
  { code: "equity-100k", group: "progress", title: "Six figures", hint: "Reach 100,000 in equity", icon: "landmark", points: 500, earned: (c) => c.equity >= 100000 },
  { code: "home-25", group: "progress", title: "A quarter of your home", hint: "Own 25% of your home", icon: "house", points: 200, earned: (c) => c.properties > 0 && c.ownership >= 0.25 },
  { code: "home-50", group: "progress", title: "Half your home", hint: "Own 50% of your home", icon: "house", points: 400, earned: (c) => c.properties > 0 && c.ownership >= 0.5 },
  { code: "home-75", group: "progress", title: "Three quarters home", hint: "Own 75% of your home", icon: "house", points: 600, earned: (c) => c.properties > 0 && c.ownership >= 0.75 },
  { code: "debt-free", group: "progress", title: "Debt-free (except the home)", hint: "No debts besides the mortgage", icon: "shield-check", points: 400, earned: (c) => c.balancePosts > 0 && c.otherDebt <= 0.005 },
  { code: "rate-20", group: "discipline", title: "Saved 20% of income", hint: "Close a month with a 20% savings rate", icon: "percent", points: 150, earned: (c) => c.closed.some((m) => m.savingsRate >= 0.2) },
  { code: "budget-month", group: "discipline", title: "Every budget kept", hint: "Close a month with all budgets kept", icon: "target", points: 150, earned: (c) => c.closed.some((m) => m.allBudgetsKept) },
  { code: "budget-3", group: "discipline", title: "Three months on budget", hint: "Keep every budget 3 closed months in a row", icon: "medal", points: 400, earned: (c) => consecutive(c, 3, (m) => m.allBudgetsKept) },
  { code: "saver-3", group: "discipline", title: "Three months in the plus", hint: "Save something 3 closed months in a row", icon: "sprout", points: 200, earned: (c) => consecutive(c, 3, (m) => m.saved > 0) },
  { code: "first-payslip", group: "discover", title: "First payslip", hint: "Keep a payslip with your income", icon: "file-text", points: 50, earned: (c) => (c.payslips?.length ?? 0) >= 1 },
  { code: "payslips-back-12", group: "habits", title: "Paper trail", hint: "Add 12 payslips from earlier months", icon: "history", points: 200, earned: (c) => (c.payslips ?? []).filter((p) => p.month < p.added).length >= 12 },
  { code: "payslips-year", group: "habits", title: "A full year of payslips", hint: "Keep the payslips of all 12 months of a year", icon: "folder-check", points: 300, earned: (c) => fullYear(c.payslips ?? []) },
  { code: "first-goal", group: "discover", title: "Goal setter", hint: "Create your first goal", icon: "flag", points: 50, earned: (c) => c.goals >= 1 },
  { code: "goal-achieved", group: "discover", title: "Goal reached", hint: "Reach one of your goals", icon: "party-popper", points: 300, earned: (c) => c.goalsAchieved >= 1 },
  { code: "balance-sheet", group: "discover", title: "Books balanced", hint: "Add posts to your balance sheet", icon: "scale", points: 50, earned: (c) => c.balancePosts >= 1 },
  { code: "home-added", group: "discover", title: "Home owner", hint: "Add your home in Real estate", icon: "house-plus", points: 50, earned: (c) => c.properties >= 1 },
];

/** Badges newly earned given what's already stored. */
export const newBadges = (c: BadgeContext, have: Set<string>) => BADGES.filter((b) => !have.has(b.code) && b.earned(c));

// ---- Goals -----------------------------------------------------------------

/** Where a goal stands: share done and, from the pace since it started, the
 *  date it's reached (null when there's no progress to extrapolate). */
export function goalProgress(start: number, current: number, target: number, since: Date, now: Date) {
  const span = target - start;
  const done = span !== 0 ? (current - start) / span : current >= target ? 1 : 0;
  const share = Math.min(Math.max(done, 0), 1);
  const days = Math.max((now.getTime() - since.getTime()) / 86_400_000, 1);
  const perDay = (current - start) / days;
  const left = target - current;
  const eta = share >= 1 ? now : perDay !== 0 && Math.sign(perDay) === Math.sign(left) ? addDays(now, Math.ceil(left / perDay)) : null;
  return { share, eta };
}
