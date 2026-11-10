import { BillingError, customerFor, fail, prices, status, stripe, userFrom, webPlan } from "@/lib/billing/server";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";

// Start a subscription: a Stripe-hosted Checkout for the chosen plan, with
// the free trial the first time. The App User ID travels on the
// subscription so the webhook can hand it to RevenueCat even if the browser
// never comes back.
export async function POST(req: Request) {
  try {
    const user = await userFrom(req);
    const { plan } = (await req.json()) as { plan?: string };
    const choice = PLANS.find((p) => p.key === plan);
    if (!choice) throw new BillingError(400, "Unknown plan.");
    const now = await status(user.id);
    if (now.active && now.store && now.store !== "stripe") throw new BillingError(409, "You already have Premium through the app store.");
    const customer = await customerFor(user, true);
    const { plan: current, trialUsed } = await webPlan(customer!);
    if (current) throw new BillingError(409, "You already have a subscription. Change it under Manage subscription.");
    const price = (await prices()).find((p) => p.key === choice.key);
    if (!price) throw new BillingError(503, "This plan isn't available.");
    const origin = new URL(req.url).origin;
    const session = await stripe<{ url: string }>("POST", "checkout/sessions", {
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: { ...(trialUsed ? {} : { trial_period_days: TRIAL_DAYS }), metadata: { app_user_id: user.id } },
      success_url: `${origin}/app/settings?billing=success&session_id={CHECKOUT_SESSION_ID}#subscription`,
      cancel_url: `${origin}/app/settings?billing=cancel#subscription`,
      locale: "auto",
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return fail(err);
  }
}
