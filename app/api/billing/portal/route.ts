import { BillingError, customerFor, fail, stripe, userFrom } from "@/lib/billing/server";

// Manage the web subscription (change plan, payment method, invoices,
// cancel) in Stripe's customer portal.
export async function POST(req: Request) {
  try {
    const user = await userFrom(req);
    const customer = await customerFor(user, false);
    if (!customer) throw new BillingError(404, "No web subscription yet.");
    const origin = new URL(req.url).origin;
    const s = await stripe<{ url: string }>("POST", "billing_portal/sessions", { customer, return_url: `${origin}/app/settings#subscription` });
    return Response.json({ url: s.url });
  } catch (err) {
    return fail(err);
  }
}
