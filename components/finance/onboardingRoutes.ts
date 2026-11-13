import { CalendarClock, ChartPie, Coins, FileText, House, Landmark, Repeat, ShieldCheck, Users, Wallet, type LucideIcon } from "lucide-react";

// The two routes through the setup. Quick: five questions, budgets suggested
// from the income. Complete: eight chapters, from the basics to security.
// The journey bar shows a node per step (quick) or per chapter (complete);
// the dashboard's "Finish your setup" card counts the chapters answered.

export type Step =
  | "welcome" | "route"
  | "currency" | "household" | "income" | "housing" | "accounts" | "investments" | "fixed" | "subscriptions" | "insurance"
  | "balance" | "budgets" | "goal" | "history" | "statement" | "security"
  | "done";

export type Route = "quick" | "complete";

/** A node on the journey bar: one step (quick) or one chapter (complete). */
export type JourneyNode = { id: string; label: string; icon: LucideIcon; steps: Step[] };

/** Labels are English keys for t(). */
export const QUICK: JourneyNode[] = [
  { id: "currency", label: "Currency", icon: Coins, steps: ["currency"] },
  { id: "household", label: "Household", icon: Users, steps: ["household"] },
  { id: "income", label: "Income", icon: Wallet, steps: ["income"] },
  { id: "housing", label: "Your home", icon: House, steps: ["housing"] },
  { id: "accounts", label: "Accounts", icon: Landmark, steps: ["accounts"] },
  { id: "fixed", label: "Fixed costs", icon: Repeat, steps: ["fixed"] },
  { id: "statement", label: "Bank statement", icon: FileText, steps: ["statement"] },
];

export const CHAPTERS: JourneyNode[] = [
  { id: "basics", label: "Basics", icon: Users, steps: ["currency", "household"] },
  { id: "income", label: "Income", icon: Wallet, steps: ["income"] },
  { id: "money", label: "Money now", icon: Landmark, steps: ["accounts", "investments"] },
  { id: "debts", label: "Home and debts", icon: House, steps: ["housing", "balance"] },
  { id: "fixed", label: "Fixed costs and insurance", icon: Repeat, steps: ["fixed", "subscriptions", "insurance"] },
  { id: "budgets", label: "Budgets and goals", icon: ChartPie, steps: ["budgets", "goal"] },
  { id: "history", label: "History", icon: CalendarClock, steps: ["history", "statement"] },
  { id: "security", label: "Security", icon: ShieldCheck, steps: ["security"] },
];

export const nodesFor = (route: Route) => (route === "quick" ? QUICK : CHAPTERS);

/** Every screen of a route, in order. */
export function stepsFor(route: Route): Step[] {
  return ["welcome", "route", ...nodesFor(route).flatMap((n) => n.steps), "done"];
}

/** The chapters whose every question has been answered. */
export function chaptersDone(answered: string[]) {
  // Added later: the bank statement is optional, and your home was part of
  // "balance" before it got its own screen — so earlier setups stay done.
  const has = (s: Step) => answered.includes(s) || s === "statement" || (s === "housing" && answered.includes("balance"));
  return CHAPTERS.filter((c) => c.steps.every(has));
}
