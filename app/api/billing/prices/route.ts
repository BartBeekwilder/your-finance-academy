import { fail, prices } from "@/lib/billing/server";
import { currencyFor } from "@/lib/billing/plans";

// The three Premium prices (by lookup key), for the subscription card, in
// the visitor's currency: dollars in the US, pounds in the UK, else euros
// (?currency=usd|gbp|eur to try another). Per visitor, so not cached
// publicly.
export async function GET(req: Request) {
  try {
    const currency = currencyFor(req.headers.get("x-vercel-ip-country"), new URL(req.url).searchParams.get("currency"));
    const list = await prices(currency);
    // Test mode while the key is a test key.
    const test = !/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
    return Response.json({ test, prices: list.map(({ key, amount, currency, months }) => ({ key, amount, currency, months })) }, { headers: { "Cache-Control": "private, max-age=300", Vary: "x-vercel-ip-country" } });
  } catch (err) {
    return fail(err);
  }
}
