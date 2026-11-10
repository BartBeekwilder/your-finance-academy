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
