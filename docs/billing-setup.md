# Web billing — setup (Stripe sandbox → RevenueCat → Vercel)

The code is done (branch `web-app`). The subscription card in Settings stays
hidden until the keys below are in Vercel. Everything here is TEST MODE: no
KvK yet, so no live Stripe keys.

## How it works

1. Settings › Personal Finance Premium → pick a plan → **Start 7-day free
   trial** → `POST /api/billing/checkout` makes a Stripe-hosted Checkout
   (card on file, trial only the first time, `app_user_id` = Supabase user id
   on the subscription).
2. Back on `/app/settings?billing=success` → `POST /api/billing/sync` hands
   the `sub_…` to RevenueCat (`POST /v1/receipts`, `X-Platform: stripe`).
   The Stripe webhook (`/api/billing/stripe-webhook`,
   `customer.subscription.created/updated`) does the same in case the browser
   never comes back.
3. Premium = RevenueCat entitlement `personal_finance_premium`
   (`GET /api/billing/status`, all stores together).
4. **Manage subscription** → Stripe customer portal (`bpc_1UaD4uQlQbxXjawroi9187oo`).
5. The apps must log in to RevenueCat with the **same App User ID: the
   Supabase user id** (`Purchases.logIn(userId)`), so one Premium works on
   web, iPhone, Mac and Android.

## What Bart sets up (Claude never sees the keys)

### Stripe (sandbox "Your Finance Academy sandbox")
- [ ] Developers → API keys → **restricted key** (`rk_test_…`) with:
  Customers *write*, Checkout Sessions *write*, Prices *read*,
  Subscriptions *read*, Customer portal *write*.
  → Vercel `STRIPE_SECRET_KEY`
- [ ] Developers → Webhooks → add endpoint
  `https://www.yourfinanceacademy.com/api/billing/stripe-webhook`,
  events `customer.subscription.created` and `customer.subscription.updated`
  → signing secret (`whsec_…`) → Vercel `STRIPE_WEBHOOK_SECRET`

### RevenueCat (project "Personal Finance")
- [ ] Apps & providers → add **Stripe** → connect the Stripe sandbox
  → copy the Stripe app's **public API key** → Vercel `REVENUECAT_STRIPE_PUBLIC_KEY`
- [ ] Products → import Stripe product `prod_VbPuHHHnlFR3ag` (Personal
  Finance Premium) → attach to entitlement `personal_finance_premium`
- [ ] API keys → **secret key (v1)** → Vercel `REVENUECAT_SECRET_KEY`
- [ ] (optional) Stripe app → Purchase tracking → "Track new purchases from
  server-to-server notifications" (belt and braces next to the webhook)

### Vercel (project your-finance-academy)
- [ ] The four variables above for **Production** and **Preview**; redeploy.

## Test (once the keys are in)
1. Sign in on the site → Settings → choose Yearly → Start trial.
2. Card `4242 4242 4242 4242`, any future date, any CVC.
3. Back in Settings: "Free trial · Yearly, free until …".
4. Manage subscription → portal → cancel → Settings shows "Cancelled —
   Premium stays until …".
5. In RevenueCat → Customers → the Supabase user id has the entitlement.

Prices (lookup keys, EUR incl. VAT): `pf_premium_monthly` €14.99,
`pf_premium_yearly` €119.99, `pf_premium_2year` €199.99 (web only).
A new amount = a new price with the same lookup key (transfer it); no code change.
