import { createClient } from "@supabase/supabase-js";
import { ENTITLEMENT, PLANS, type BillingStatus, type PlanKey, type PlanPrice } from "./plans";
import { form } from "./stripeWire";
export { verifyStripeSignature } from "./stripeWire";

// Server side of web billing: Stripe (plain REST, no SDK), RevenueCat and
// the signed-in Supabase user. Keys come from the environment only
// (Vercel): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, REVENUECAT_SECRET_KEY,
// REVENUECAT_STRIPE_PUBLIC_KEY. Without them the routes answer 503 and the
// subscription card stays hidden.

export class BillingError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const configured = () => !!process.env.STRIPE_SECRET_KEY;

export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST", path: string, params: Record<string, unknown> = {}): Promise<T> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new BillingError(503, "Billing is not set up yet.");
  const body = form(params);
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && [...body].length ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${secret}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new BillingError(502, json.error?.message ?? `Stripe ${res.status}`);
  return json;
}

/** The signed-in user, from the Supabase access token in Authorization. */
export async function userFrom(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) throw new BillingError(401, "Sign in first.");
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  if (error || !data.user) throw new BillingError(401, "Sign in first.");
  return { id: data.user.id, email: data.user.email ?? null };
}

type Price = { id: string; lookup_key: string; unit_amount: number; currency: string };

/** The three prices by lookup key. */
export async function prices(): Promise<(PlanPrice & { id: string })[]> {
  const list = await stripe<{ data: Price[] }>("GET", "prices", { active: true, lookup_keys: PLANS.map((p) => p.lookup), limit: 10 });
  return PLANS.flatMap((p) => {
    const price = list.data.find((x) => x.lookup_key === p.lookup);
    return price ? [{ key: p.key, id: price.id, amount: price.unit_amount / 100, currency: price.currency.toUpperCase(), months: p.months }] : [];
  });
}

/** The user's Stripe customer (one per user, marked with its App User ID),
 *  made on first use. Looked up by email first: Stripe's search index lags
 *  a minute or so behind, so a customer made just now (Manage right after
 *  subscribing, a double click on Start) would be missed. Search catches a
 *  customer whose email has changed since. */
export async function customerFor(user: { id: string; email: string | null }, create: boolean) {
  type Customers = { data: { id: string; metadata?: Record<string, string> }[] };
  if (user.email) {
    const byEmail = await stripe<Customers>("GET", "customers", { email: user.email, limit: 100 });
    const hit = byEmail.data.find((c) => c.metadata?.app_user_id === user.id);
    if (hit) return hit.id;
  }
  const found = await stripe<Customers>("GET", "customers/search", { query: `metadata['app_user_id']:'${user.id}'`, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  if (!create) return null;
  const made = await stripe<{ id: string }>("POST", "customers", { email: user.email ?? undefined, metadata: { app_user_id: user.id } });
  return made.id;
}

/** Hand a Stripe subscription to RevenueCat under the user's App User ID. */
export async function sendToRevenueCat(appUserId: string, subscriptionId: string) {
  const key = process.env.REVENUECAT_STRIPE_PUBLIC_KEY;
  if (!key) throw new BillingError(503, "RevenueCat is not set up yet.");
  const res = await fetch("https://api.revenuecat.com/v1/receipts", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "X-Platform": "stripe", "Content-Type": "application/json" },
    body: JSON.stringify({ app_user_id: appUserId, fetch_token: subscriptionId }),
  });
  if (!res.ok) throw new BillingError(502, `RevenueCat ${res.status}`);
}

type RcEntitlement = { expires_date: string | null; product_identifier: string };
type RcSubscription = { store: string; period_type: string; unsubscribe_detected_at: string | null; expires_date: string | null };

/** Premium as RevenueCat sees it (all stores together). */
export async function status(appUserId: string): Promise<BillingStatus> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  const none: BillingStatus = { active: false, store: null, expires: null, trial: false, plan: null, cancelled: false };
  if (!key) return none;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!res.ok) return none;
  const { subscriber } = (await res.json()) as { subscriber: { entitlements: Record<string, RcEntitlement>; subscriptions: Record<string, RcSubscription> } };
  const ent = subscriber.entitlements?.[ENTITLEMENT];
  if (!ent) return none;
  const sub = subscriber.subscriptions?.[ent.product_identifier];
  const active = !ent.expires_date || Date.parse(ent.expires_date) > Date.now();
  // Stripe products show up in RevenueCat as the Stripe product (or price) id;
  // the plan is told from the price's lookup key when the web route asks Stripe.
  return { active, store: sub?.store ?? null, expires: ent.expires_date, trial: sub?.period_type === "trial", plan: null, cancelled: !!sub?.unsubscribe_detected_at };
}

/** The plan of the customer's current web subscription, if any. */
export async function webPlan(customer: string): Promise<{ plan: PlanKey | null; trialUsed: boolean }> {
  const subs = await stripe<{ data: { status: string; items: { data: { price: { lookup_key: string | null } }[] } }[] }>("GET", "subscriptions", { customer, status: "all", limit: 10 });
  const live = subs.data.find((s) => ["active", "trialing", "past_due"].includes(s.status));
  const lookup = live?.items.data[0]?.price.lookup_key;
  return { plan: PLANS.find((p) => p.lookup === lookup)?.key ?? null, trialUsed: subs.data.length > 0 };
}

/** A route's answer for a thrown error. */
export function fail(err: unknown) {
  const status = err instanceof BillingError ? err.status : 500;
  return Response.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status });
}
