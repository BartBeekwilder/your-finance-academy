// Personal Finance Premium on the web: one product in Stripe with three
// prices, found by lookup key (so a new amount is a new price with the same
// key, never a code change). The subscription lands in RevenueCat under the
// Supabase user id, the same App User ID the apps log in with, so one
// Premium works on every device.

export const ENTITLEMENT = "personal_finance_premium";
export const TRIAL_DAYS = 7;

export const PLANS = [
  { key: "monthly", lookup: "pf_premium_monthly", months: 1 },
  { key: "yearly", lookup: "pf_premium_yearly", months: 12 },
  { key: "2year", lookup: "pf_premium_2year", months: 24 },
] as const;

export type PlanKey = (typeof PLANS)[number]["key"];

/** Fixed prices per currency (Stripe currency_options on each price, Bart
 *  17 Nov): the US pays in dollars, the UK in pounds, everyone else in euros
 *  (Managed Payments converts those at checkout where it applies). */
export const CURRENCIES = ["eur", "usd", "gbp"] as const;
export type Currency = (typeof CURRENCIES)[number];
const BY_COUNTRY: Record<string, Currency> = { US: "usd", GB: "gbp", GG: "gbp", JE: "gbp", IM: "gbp" };

/** The currency shown to a visitor: ?currency= (testing) first, else the
 *  country Vercel saw the visitor in. */
export function currencyFor(country: string | null | undefined, asked?: string | null): Currency {
  const a = asked?.toLowerCase();
  if (a && (CURRENCIES as readonly string[]).includes(a)) return a as Currency;
  return BY_COUNTRY[(country ?? "").toUpperCase()] ?? "eur";
}

export type PlanPrice = { key: PlanKey; amount: number; currency: string; months: number };

export type BillingStatus = {
  active: boolean;
  /** Where the subscription was bought: "stripe" (web), "app_store", "play_store"… */
  store: string | null;
  expires: string | null;
  trial: boolean;
  /** The plan, when bought on the web. */
  plan: PlanKey | null;
  /** Cancelled, runs until `expires`. */
  cancelled: boolean;
};
