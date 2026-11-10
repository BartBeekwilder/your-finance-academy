import { fail, prices } from "@/lib/billing/server";

// The three Premium prices (by lookup key), for the subscription card.
export async function GET() {
  try {
    const list = await prices();
    // Test mode while the key is a test key (no KvK yet: sandbox only).
    const test = !/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
    return Response.json({ test, prices: list.map(({ key, amount, currency, months }) => ({ key, amount, currency, months })) }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  } catch (err) {
    return fail(err);
  }
}
