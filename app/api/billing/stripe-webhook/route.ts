import { fail, sendToRevenueCat, verifyStripeSignature } from "@/lib/billing/server";

// Stripe → RevenueCat: a new (or changed) subscription goes to RevenueCat
// under the App User ID it carries, as RevenueCat's docs advise (after
// customer.subscription.created). Renewals, plan changes and cancellations
// RevenueCat then follows through its own Stripe connection.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Not set up." }, { status: 503 });
  const body = await req.text();
  if (!verifyStripeSignature(body, req.headers.get("stripe-signature"), secret)) return Response.json({ error: "Bad signature." }, { status: 400 });
  try {
    const event = JSON.parse(body) as { type: string; data: { object: { id: string; metadata?: Record<string, string> } } };
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const appUserId = sub.metadata?.app_user_id;
      if (appUserId) await sendToRevenueCat(appUserId, sub.id);
    }
    return Response.json({ received: true });
  } catch (err) {
    return fail(err);
  }
}
