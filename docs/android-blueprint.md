# Personal Finance for Android — blueprint

Status: draft for review (2026-10-23). Nothing is built yet; this is the plan
for adding Android next to the website and the iOS app.

## 1. Starting point

| | Website | iOS | Android (planned) |
|---|---|---|---|
| UI | Next.js 16 / React | SwiftUI | **Kotlin + Jetpack Compose** |
| Data | Supabase (Postgres, RLS) | SwiftData + CloudKit (moving to Supabase) | **Supabase** + local Room cache |
| Sign-in | Supabase Auth (password, 6-digit code, Apple) | same (planned) | same + **Google** |
| Subscriptions | Stripe via RevenueCat (planned) | App Store via RevenueCat | **Play Billing via RevenueCat** |
| Languages | 17 (lib/i18n) | 17 (Localizable.xcstrings) | 17 (strings.xml, generated) |

The decision of 2026-10-13 already points the way: **Supabase is the one
source of truth, RevenueCat the one subscription status**. Android plugs
into exactly that — no Android-specific backend.

## 2. Choice of technology

**Recommended: native Kotlin + Jetpack Compose.**

- Compose is the Android twin of SwiftUI: same declarative style, same
  animation ideas (springs, `animate*AsState`, `Canvas` for the charts), so
  every iOS screen has a near one-to-one counterpart. The premium,
  physical animations Bart wants are easiest to get right natively.
- Official, maintained libraries for everything we need: `supabase-kt`
  (Auth, Postgrest, Realtime), RevenueCat `purchases-android`, Credential
  Manager for Google sign-in, Room for offline storage.

Alternatives considered:

- **React Native / Expo** — could reuse some web logic (TypeScript), but the
  web UI is DOM/CSS and doesn't carry over; the charts and animations would
  be rewritten anyway, with more effort to make them feel native.
- **Kotlin Multiplatform shared with iOS** — attractive later for the
  calculation layer, but iOS is already written in Swift; not worth the
  migration now.
- **PWA (the website installed on Android)** — cheapest first step (see
  phase 0), but no Play Store subscriptions and weaker offline/notifications.

## 3. Architecture

```
app/                      single-activity Compose app
  ui/theme/               colours, typography, brand gradient (FinanceAIBrand)
  ui/components/          BrandToggle, StepSlider, BudgetBar, LiveTile,
                          TileSparkline, Donut, Waterfall, BalanceBars …
  feature/dashboard/      one package per tab, each: Screen + ViewModel
  feature/income/ expenses/ networth/ balance/ investments/
  feature/transactions/ categories/ budgets/ settings/ onboarding/ paywall/
domain/                   pure Kotlin, no Android imports
  FinanceFigures.kt       port of lib/finance/calc.ts + FinanceFigures.swift
  BalanceSheet.kt         port of balanceSheet()
  BudgetCalculator.kt     carried budgets, forecast, heat colours
data/
  remote/                 supabase-kt: tables 1:1 with supabase/migrations
  local/                  Room entities (offline cache) + sync queue
  repository/             Flow-based repositories the ViewModels observe
  sync/                   pull by updated_at, push queued changes, soft deletes
billing/                  RevenueCat: entitlement "premium"
```

- **MVVM + Kotlin Flows**: each screen observes a `StateFlow<UiState>`; the
  live tiles tick with a `LaunchedEffect` clock (80 ms number, 1 s chart),
  the same split clocks iOS uses for smoothness.
- **Offline first**: Room holds everything; writes go to Room and a sync
  queue, then to Supabase. Same rules as the schema: client UUIDs,
  `updated_at` by trigger, soft deletes via `deleted_at`, RLS "own rows".
- **Realtime**: Supabase Realtime keeps phone, iPad and web in step.

## 4. Data model

No new tables. Android uses the existing migrations as-is:
`profiles, accounts, categories, budgets, transactions, income_records,
holdings, balance_items, balance_values` (0001–0003). Money is
`numeric(19,4)` on the server → `BigDecimal` in Kotlin (never `Double` for
stored amounts; `Double` only for drawing).

## 5. One set of numbers on every platform

The calculations already exist twice (calc.ts and FinanceFigures.swift). A
third copy needs a guard against drifting apart:

- Port `domain/` from calc.ts function by function (live tiles, forecast,
  net worth, balance sheet, carried budgets, heat colours).
- **Shared test vectors**: a JSON file in this repo
  (`supabase/tests/vectors/*.json`: input data + expected figures) that the
  web tests, an iOS unit test and an Android unit test all run. A change in
  one platform that changes a number fails the other two.

## 6. Screens (parity list)

Dashboard (live tiles with ∑/▮, net worth ticker, balance card Compact/Full,
Income vs Spent with range zoom, savings 12 months/This year, spending
donut, category cards, budgets with spill-out bars), Income, Expenses,
Net worth (waterfall), Balance sheet (equity hero, bars, table, waterfall,
draggable tiles), Investments, Transactions (tap to edit, delete twice),
Categories, Budgets (month slider, forecast months, budget pie), Settings
(currency, language, charts), Onboarding, Paywall, Quick Add, Finance AI
(receipt scan — on Android via ML Kit text recognition + on-device or server
model; to be decided).

Navigation: bottom bar with 5 items on phones (Dashboard, Income, Expenses,
Budgets, More), navigation rail on tablets/foldables with all tabs — Android
large screens are common, so tablet layouts are part of version 1.

## 7. Languages

All 17 languages from day one. A small script converts the existing
catalogs into `res/values-xx/strings.xml` (iOS `%@` → Android `%1$s`,
plurals → `<plurals>`), so a text translated once serves all three apps.
Arabic gets RTL automatically with Compose.

## 8. Sign-in and subscriptions

- Supabase Auth: email + password, 6-digit email code (no magic links), and
  **Sign in with Google** (Credential Manager). Apple sign-in on Android via
  Supabase's web flow, so iPhone users can log in on an Android tablet too.
- RevenueCat with the Play Store: one entitlement `premium`, same product
  idea as iOS (7-day trial, monthly). Buying on any platform unlocks all.
- Needed from Bart: Google Play developer account ($25 once), the Play app
  listing, products in Play Console, linking Play to RevenueCat.

## 9. Phased plan

| Phase | What | Result |
|---|---|---|
| 0 | Make the website an installable PWA (manifest, icon, offline shell) | Android users can use it today |
| 1 | Project setup, theme, components (BrandToggle, StepSlider, BudgetBar, charts), sign-in, sync, demo mode | App opens, logs in, shows data |
| 2 | Dashboard, Income, Expenses, Net worth, Transactions + Quick Add/edit | Daily use possible |
| 3 | Budgets, Balance sheet, Investments, Categories, Settings, Onboarding | Feature parity with web |
| 4 | Paywall + RevenueCat, 17 languages, accessibility, tablet layouts | Store-ready |
| 5 | Internal test track → closed test → production on Google Play | Live |

The order follows how the iOS app grew, so the most-used screens come first.

## 10. Prerequisites before phase 1

1. iOS moves from CloudKit to Supabase first (already planned) — otherwise
   iPhone data never reaches Android.
2. RevenueCat account + Stripe for the web (planned).
3. Google Play developer account (Bart).
4. Android Studio installed on the Mac (free); an Android phone or the
   emulator for testing (the emulator is heavy on this Mac — a real device
   is preferable).

## 11. Open decisions for Bart

- Start with the PWA (phase 0) as a quick win, or go straight to native?
- Minimum Android version (proposal: Android 9 / API 28 — covers ~95% of
  devices).
- Finance AI receipt scanning on Android: on-device only, or allowed via a
  server?
- Phone-first or tablet-first design (iOS was developed on the iPad)?
