# Personal Finance — project status and hand-over

Read this first on any computer. It says where the project stands, how to
run it, and what's next. Keep it up to date at the end of every session
(Claude: update this file and commit it before finishing).

Last updated: 2026-10-23.

## The product

"Personal Finance" — run your money like a business. Three clients on one
backend:

| Part | Where | Branch |
|---|---|---|
| Website + web app (`/app`) | this repo (`your-finance-academy`), Next.js 16 | `web-app` (not merged to `main`; `main` = live site) |
| iOS / iPadOS app | repo `Personal Finance` (SwiftUI) | `ios-web-parity-oct21` |
| Android app | repo `personal-finance-android` (Kotlin + Compose), plan in `docs/android-blueprint.md` | `main` |
| Backend | Supabase project `cjdmrrwsyzpoiemiyyyu` (eu-west-1); schema in `supabase/migrations` 0001–0003 | — |

Decisions:
- Supabase is the ONLY sync (iOS moves off CloudKit, keeps SwiftData as an
  offline cache). RevenueCat for one subscription across App Store, Play
  Store and Stripe.
- Sign-in: Sign in with Apple + email & password + email 6-digit code. NO
  magic links. Demo mode to look around.
- Never push, deploy, or change accounts without asking Bart. Pushing to
  `main` deploys the live site (Vercel). Bart signs in to services himself.

## Code on GitHub (works from any computer)

- Website: github.com/BartBeekwilder/your-finance-academy (public) — work
  on branch `web-app`; `main` is the live site (push to `main` = deploy).
- iOS: github.com/BartBeekwilder/personal-finance-ios (private) — branch
  `ios-web-parity-oct21`.
- Android: github.com/BartBeekwilder/personal-finance-android (private) —
  branch `main`. Open in Android Studio; `./gradlew testDebugUnitTest
  assembleDebug`. Translations come from this repo's `lib/i18n/messages`
  (`tools/sync-i18n.sh ../your-finance-academy`).
- Clone both side by side in one folder (the iOS CLAUDE.md refers to
  `../your-finance-academy`).
- Start of a session: `git pull`. End of a session: commit, update this
  file, `git push` (the `web-app` branch and iOS branches may be pushed;
  `main` only with Bart's OK).

### Setting up the Windows work computer (once)

1. Install Git for Windows, Node.js LTS (20+), and Claude Code.
2. Sign in to GitHub (`gh auth login`, or Git Credential Manager on first push).
3. `git clone https://github.com/BartBeekwilder/your-finance-academy.git`
   then `cd your-finance-academy && git checkout web-app && npm install`.
4. `git clone https://github.com/BartBeekwilder/personal-finance-ios.git`
   (can be read and edited on Windows, but only built/run on a Mac).
   `git clone https://github.com/BartBeekwilder/personal-finance-android.git`
   and install Android Studio (builds and runs fine on Windows).
5. Create `.env.local` with the two Supabase values (from the Supabase
   dashboard → Project Settings → API) — or skip it to use demo data.
6. `npx next dev -p 3000` → http://localhost:3000/app

## Running it

Website:
```
npm install
npx next dev -p 3000        # http://localhost:3000/app
npm run test:db             # schema tests (PGlite)
```
`.env.local` (not in git) needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Bart copies them from the Supabase
dashboard. Without them the app runs on demo data. Demo in one tab:
`sessionStorage.setItem('pf-demo','1')`.

iOS (Mac with Xcode only): open `Personal Finance.xcodeproj`. Command-line
build: `xcodebuild -project "Personal Finance.xcodeproj" -scheme "Personal
Finance" -destination generic/platform=iOS -configuration Debug
SWIFT_OPTIMIZATION_LEVEL=-O build`. DEBUG builds seed demo data
(`-seedDemo` / `-removeDemo` launch arguments, ids start with DDDDDDDD).

## Languages (both platforms, 17 languages)

en + nl, de, fr, es, it, pt-BR, pl, tr, ru, ar (RTL), hi, id, ja, ko, vi,
zh-Hans. Every new UI text must be translatable and translated:
- Web: `t("English text", { vars })` from `lib/i18n` (English is the key;
  `tr` alias where `t` is a local variable). Then `node scripts/i18n.mjs
  extract`, add translations to `lib/i18n/messages/<lang>.json`, check with
  `node scripts/i18n.mjs report`.
- iOS: `String(localized:)` / SwiftUI literals → `Localizable.xcstrings`.
  Refresh keys with `xcodebuild -exportLocalizations -project … -localizationPath
  /tmp/pf-loc -exportLanguage nl`, then fill all 16 languages.

## Design rules (Bart's taste)

- Premium, alive UI: everything animates fluidly and physically (springs,
  morphs, zooms), never pops. Live numbers tick for real.
- Brand toggle (`Segmented` / `BrandToggle`) and brand slider for all
  controls; never browser defaults. Dark neon look.
- Loved so far: range zoom on Income vs Spent; budget bars where overspend
  spills out of the bar; the balance sheet ("completely in awe").
- Web and iOS stay at parity: what's built on the web gets ported to iOS.

## Done recently (2026-10-22/23)

- Balance sheet (web + iOS): own posts with month-end values, calculated
  accounts/prepaid/receivable, equity hero, waterfall, draggable tiles,
  dashboard card Compact/Full. Migration 0003 is applied on Supabase.
- Budgets: spill-out bars, Compare/Own budget, Largest first, heat total
  bar, month slider with forecast months, budget pie.
- Edit/delete any transaction; Month/Year switch in page headers; ∑/▮ chart
  switch; stacked-areas option for category charts; savings This year.
- All web changes of 22–23 Oct ported to iOS (builds; not yet run on the
  iPad — it was unavailable).
- Onboarding draft at `/app/welcome` (preview, saves nothing) — waiting for
  Bart's review.
- Website and iOS fully translated into 17 languages.
- Android blueprint: `docs/android-blueprint.md`. Android app started
  (2026-10-23): theme, liquid BrandToggle, live amounts, spill-out budget
  bars, FinanceFigures + demo data identical to web/iOS, dashboard (net
  worth, Income/Spent/Balance tiles, budgets), phone bottom bar / tablet
  rail, 17 languages from the web's files, unit tests. Not yet run on a
  device/emulator. Next: charts (sparklines, donut, Income vs Spent),
  Income/Expenses/Net worth/Balance/Budgets screens, Supabase sign-in + sync.

## Next / open

To do (Bart's list):
1. Review the onboarding draft (`/app/welcome`), then auto-open it for new
   accounts and port it to iOS.
2. Real-estate module: home value/WOZ, mortgage parts (annuity/linear, rate,
   term, payment, remaining debt) feeding the balance sheet automatically.
3. Multiple years: add/view earlier years (monthly or year totals), year
   switcher; net worth starting before 1 January.
4. Monthly review / month close: confirm income, check fixed costs, review
   budgets, enter month-end balances, summary, lock the month.
5. Android: continue phase 1–3 (screens, Supabase sync); see blueprint §9.

Open questions for Bart:
- Dashboard balance card default: Compact or Full?
- Earlier years: monthly totals enough, or import transactions?
- Month close: start automatically on the 1st, or only on demand?
- Android: PWA first? minimum Android version? on-device receipt scanning?

Before going live with the web app: hide the Apple sign-in button until it's
configured, set the Supabase Site URL, merge `web-app` into `main` (with
Bart's OK). Still to do on iOS: replace CloudKit with Supabase sync, align
the dashboard net worth ticker with the net worth model, app icon.
