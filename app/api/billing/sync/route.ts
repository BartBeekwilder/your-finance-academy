import { BillingError, fail, sendToRevenueCat, status, stripe, userFrom } from "@/lib/billing/server";

// Back from Checkout: hand the new subscription to RevenueCat right away
// (the webhook does the same, for when the browser doesn't come back).
export async function POST(req: Request) {
  try {
    const user = await userFrom(req);
    const { session_id } = (await req.json()) as { session_id?: string };
    if (!session_id?.startsWith("cs_")) throw new BillingError(400, "Unknown checkout.");
    const s = await stripe<{ client_reference_id: string | null; status: string; subscription: string | null }>("GET", `checkout/sessions/${session_id}`);
    if (s.client_reference_id !== user.id) throw new BillingError(403, "This checkout belongs to someone else.");
    if (s.status !== "complete" || !s.subscription) throw new BillingError(409, "The checkout isn't finished.");
    await sendToRevenueCat(user.id, s.subscription);
    return Response.json(await status(user.id));
  } catch (err) {
    return fail(err);
  }
}
