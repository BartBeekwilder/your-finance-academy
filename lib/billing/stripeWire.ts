import { createHmac, timingSafeEqual } from "node:crypto";

// The two bits of Stripe's wire format the billing routes need without the
// SDK. Pure, so they're tested (tests/stripeWire.test.mjs).

/** Stripe's form encoding, nested: { a: { b: 1 }, c: [{ d: 2 }] } → a[b]=1&c[0][d]=2. */
export function form(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

/** Stripe's webhook signature check (t=…,v1=…, HMAC-SHA256 of "t.body"). */
export function verifyStripeSignature(body: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]).map(([k, v]) => [k, v]));
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const ts = Number(parts.t);
  if (!ts || !sigs.length || Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

