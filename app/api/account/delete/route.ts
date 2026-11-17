import { BillingError, fail, status, userFrom } from "@/lib/billing/server";

// Before an account is deleted (the browser then calls the database function
// delete_my_account): no running paid subscription may be left behind — it
// would keep charging — and the RevenueCat customer is removed.
// A Premium given as a gift (store "promotional") doesn't block it.
export async function POST(req: Request) {
  try {
    const user = await userFrom(req);
    const now = await status(user.id);
    if (now.active && !now.cancelled && now.store && now.store !== "promotional") {
      throw new BillingError(
        409,
        now.store === "stripe"
          ? "Cancel your subscription first: Settings › Personal Finance Premium › Manage subscription."
          : "Cancel your subscription in the App Store or Google Play first.",
      );
    }
    const key = process.env.REVENUECAT_SECRET_KEY;
    if (key) {
      await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } }).catch(() => {});
    }
    return Response.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
