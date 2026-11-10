import { configured, customerFor, fail, status, userFrom, webPlan } from "@/lib/billing/server";

// The signed-in user's Premium: from RevenueCat (every store), and for a
// web subscription the plan from Stripe.
export async function GET(req: Request) {
  try {
    if (!configured()) return Response.json({ error: "Billing is not set up yet." }, { status: 503 });
    const user = await userFrom(req);
    const s = await status(user.id);
    if (s.active && s.store === "stripe") {
      const customer = await customerFor(user, false);
      if (customer) s.plan = (await webPlan(customer)).plan;
    }
    return Response.json(s);
  } catch (err) {
    return fail(err);
  }
}
