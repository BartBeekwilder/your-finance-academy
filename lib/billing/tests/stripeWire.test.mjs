// Stripe's form encoding and webhook signatures. Run: node --test lib/billing/tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { form, verifyStripeSignature } from "../stripeWire.ts";

test("nested objects and arrays the way Stripe reads them", () => {
  const f = form({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }], subscription_data: { trial_period_days: 7, metadata: { app_user_id: "u1" } }, skip: undefined, lookup_keys: ["a", "b"] });
  assert.equal(
    decodeURIComponent(f.toString()),
    "mode=subscription&line_items[0][price]=price_1&line_items[0][quantity]=1&subscription_data[trial_period_days]=7&subscription_data[metadata][app_user_id]=u1&lookup_keys[0]=a&lookup_keys[1]=b",
  );
});

test("the checkout placeholder survives encoding", () => {
  const f = form({ success_url: "https://x.test/s?session_id={CHECKOUT_SESSION_ID}" });
  assert.equal(new URLSearchParams(f.toString()).get("success_url"), "https://x.test/s?session_id={CHECKOUT_SESSION_ID}");
});

test("webhook signatures: right, wrong, old", () => {
  const secret = "whsec_test", body = '{"id":"evt_1"}';
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret), true);
  assert.equal(verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret), false);
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, "whsec_other"), false);
  const old = t - 3600, oldSig = createHmac("sha256", secret).update(`${old}.${body}`).digest("hex");
  assert.equal(verifyStripeSignature(body, `t=${old},v1=${oldSig}`, secret), false);
  assert.equal(verifyStripeSignature(body, null, secret), false);
});
