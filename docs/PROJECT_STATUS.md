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
| Backend | Supabase project `cjdmrrwsyzpoiemiyyyu` (eu-west-1); schema in `supabase/migrations` 0001–0006 all applied (0005 + 0006 on 2026-10-23) | — |

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
- Month names ALWAYS start with a capital, in every language and also mid-sentence (Bart, 2026-10-23): web `monthName/monthYear/shortMonth` in lib/finance/format.ts, iOS `Date.monthName/monthShort/monthYearDisplay`, Android `monthName()`.

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
- Real-estate module (web, 2026-10-23): `/app/real-estate`. Migration
  `0004_real_estate.sql` (properties, mortgage_parts; applied on Supabase
  2026-10-23). Pure maths in `lib/finance/mortgage.ts` (annuity /
  linear / interest-only, schedule, totals, extra repayments from a month,
  rate change, ownership, LTV, NL tax: renteaftrek − eigenwoningforfait at
  2025 rates) with tests `npm run test:calc`. Page: house filling with the
  ownership share + look-ahead slider, payment split, totals over the term,
  interest/repayment per year chart with remaining-debt line, loan parts
  with editors, extra-repayment simulator (to the highest-rate part),
  fixed-rate period (+1% impact), Dutch tax card, penalty-free 10% room.
  Properties and parts feed the balance sheet automatically (demo: manual
  Home/Mortgage posts removed). Translated in 17 languages. Still to port to
  iOS and Android.
- Android blueprint: `docs/android-blueprint.md`. Android app started
  (2026-10-23): theme, liquid BrandToggle, live amounts, spill-out budget
  bars, FinanceFigures + demo data identical to web/iOS, dashboard (net
  worth, Income/Spent/Balance tiles, budgets), phone bottom bar / tablet
  rail, 17 languages from the web's files, unit tests. Not yet run on a
  device/emulator. Next: charts (sparklines, donut, Income vs Spent),
  Income/Expenses/Net worth/Balance/Budgets screens, Supabase sign-in + sync.

## Done 2026-10-24 (running log — test list artifact has a matching section)
- Dashboard order (updated): [net worth (2/3) | progress block (1/3)] → live tiles + income-vs-spent/donut → balance card → categories → savings → budgets. Balance card compact = two UPRIGHT stacks (Assets | Debt + equity) with the 4 largest posts per side + "+N more". Progress block smaller (rings, level, streak, small "Close <month>" button).
- Animations: Settings › Animations — Motion Full / Light / Off and Moving background On / Off (per browser, lib/motion.ts). Light = tickers 1×/s, background 12 fps / 1× pixels / fewer strokes, looping glows play once, no backdrop blur. Sidebar (now always, not only in development): "Pause animations" + "Background still". Full mode also optimised: background capped at 30 fps.
- Dashboard: the Expenses page chart (per day/month by category, Month | Year switch, title links to /app/expenses) sits above "Spending by category". Balance card says "No debts entered" + link when there are none.
- Bart's own account: example home "Huis (voorbeeld)" (€450k, bought €385k 2021-03, NL) with one annuity part €340k at 3.9%, 30 yrs, fixed until 2031-03 — dummy data at his request, delete when real data goes in.
- Translations: all new texts in 17 languages (764 keys).
- Balance card compact: right side is now a T-account — Assets | Liabilities + Equity side by side, matching totals at the bottom (stacks below ~460px card width).
- Charts: y-axis top rounds to 1/1.2/1.5/2/3/4/5/6/8 × 10^n (was 1/2/5) in CategoryBars/CategoryAreas and YearLines, so a €270 peak gets a €300 axis instead of €500.
- Balance tile sparkline: area AND line split at zero — tile blue above, red gradient below (stronger deeper down); now-dot red when below zero.
- Tile sparklines (Income/Spent/Balance/Net worth): x-axis dates — Month: 1·8·15·22·29 + today lit in the tile colour; Year: short month names, current lit; cross-fade with the zoom, tiny tick marks. Balance's Month-view zero = start of the month (red area below it).
- Settings › Animations › Live decimals 2 / 3 / 4 / 5 (per browser, lib/motion.ts useLiveDecimals/useTickerNow/tickerMs): 2 = cents at 1 s, 3 = cents + 1 small digit at 500 ms (DEFAULT), 4 = + 2 digits at 200 ms, 5 = + 3 digits at 80 ms. Measured on the demo dashboard: 191 → 3 DOM changes per 3 s.
- Live amounts roll like an odometer (LiveAmount + .pf-roll in finance.css): each changed digit slides in over one tick (--roll = tick ms, max 400), up when rising / down when falling; off in Light/Off motion. Same tick rate, so no extra CPU.
- Net worth page: "Asset mix over time" (components/finance/AssetMixChart.tsx) — stacked areas of each month-end's assets this year (from balanceSheet per month; accounts incl. prepaid/receivable, investments split crypto/stocks/precious metals at cost, homes, own asset posts), Share (100%) | Amount toggle that morphs, hover tooltip with % and €, legend hover dims the others. Only this year until multiple years exists.
- Progress rings past 100%: second lap in a lighter tint (LAP_COLORS), its head a dot with a dark shadow lying on the first lap (fitness-watch overlap), legend chip "2nd lap".
- SUBCATEGORIES (categories.parent_id, no migration): Categories page opens each category (accordion) to add/edit/delete subs (suggestions per parent icon, e.g. Utilities → Water/Electricity/Gas/Internet/Phone/TV), edit/delete the category itself, add new categories (shared components/finance/CategoryEditor.tsx). Store: addCategory(parent_id), updateCategory, deleteCategory (subs' transactions move to parent, their budgets soft-deleted). Quick Add: sub chips under a picked category (optional). Category sheet: "Per day" bars stacked by sub, "Per subcategory" list (drills into the sub's own sheet), inline "Monthly budget" editor (from this month on) — works for subs too. Budgets page: subs indented under their category (shown with a budget or spend). Fixed/Variable: sub inherits parent's at creation, editable. Demo: Utilities → Electricity/Gas/Water, Groceries → Supermarket/Market, Transport → Public transport/Fuel/Parking (totals unchanged; tests 30/30).
- Balance page: equity line has a dotted forecast to December (month-end sheet + forecast cash from netWorthFigures; forecast dots hover-only), balance bars keep their segments across months so widths glide (removed the per-month key).
- Balance page 2D view: tile "Balance over time" (StackedMix from AssetMixChart.tsx, now shared): each post per month this year, side switch Assets | Debt + equity, Share | Amount; BalanceBars segments are clickable (picked/onPick) → switches side and lights that post in the chart with a read-out (value, % today, change this year; debts going down = green). Colours shared via balanceColors(sheet).
- Equity ticks live on the Balance hero and the dashboard balance card (liveDelta = nw.liveChange since load; LiveAmount with roll, roll off while tweening). Month labels: full names in the equity waterfall; slider/line labels use shortMonth() (Mrt) instead of name.slice(0,3) (Maa). "Balance over time" moved to the bottom of the Balance page (Bart not fully happy with it yet — revisit).
- Dashboard 'Last updated' pill (components/finance/LastUpdated.tsx): newest updated_at over the user's rows (demo: latest transaction date), green 'Updated today at 21:14' or amber 'Last updated Za 24 Okt · catch up Zo 25 Okt – Ma 27 Okt'; click opens Quick Add (window event 'pf-quick-add').
- Expenses page: category tiles (components/finance/CategoryTiles.tsx) — All + one per category (amount this month/year, share bar, sub count); picking one scopes the page via lib/finance/scope.ts scopeToCategory (subs become groups with shades, '<name> (general)' for direct spend), so the live tile, stats, CategoryBars (title '<name> per day by subcategory') and transactions follow; .pf-scope-in glide.
- INCOME GROSS / NET: migration 0007_income_gross.sql (transactions.gross_amount, nullable; NOT YET APPLIED on Supabase — needs Bart's OK). Quick Add income: net received + optional gross (placeholder = net × profile gross/net, Tab takes it) + live deductions; Income page GrossNetChart (gross + net lines per month this year, deductions band; hint card when no gross entered) + 'Gross this month/year' stats. Provider only sends gross_amount when set, so saving works before the migration as long as no gross is entered. Demo salaries carry gross (5200/3850), holiday allowance/bonus at 45%.
- SPREAD EXPENSES: migration 0008_spread_expenses.sql (transactions.spread_months 2–120, nullable; NOT YET APPLIED on Supabase — needs Bart's OK). lib/finance/spread.ts: spreadParts (N monthly parts, ids `${id}~k`, last part takes rounding remainder, counted as fixed), withSpread (FinanceProvider shows parts instead of the purchase everywhere), spreadBookValue (paid, not yet used up). Quick Add expense: 'Spread out' toggle, chips 6 mo/1/2/3/4/5 yrs + own months, readout '€41,67 per month, Okt 2026 – Sep 2030'. Month/category lists show '· 6/48'; editing a part opens the purchase; Transactions ledger shows the purchase once ('spread over 48 mo'). Balance: Accounts minus book value, asset 'Spread purchases'. Demo: €2,000 laptop over 48 months. Tests: test:calc spread.test.mjs, test:db.
- TRANSLATIONS PENDING (Bart: do at session end): Spread out, — count it monthly over the time you use it, {n} mo, 1 yr, {n} yrs, Months, mo, {amount} per month, {from} – {to}, spread over {n} mo, Spread purchases, Paid, not yet used up (book value); Net received, Gross (optional), Deductions {amount} ({pct}%), Gross is lower than net, Gross and net per month — {year}, gross, net, Gross, Net, deductions {amount} ({pct}%), Deductions (tax, premiums), Gross this month, Gross this year, Add the gross amount when you enter income…, Add income; All, {name} per day by subcategory, {name} per month by subcategory; Last updated {date}, Updated today at {time}, catch up today, catch up {from} – {to}, Add what happened since then, Chart style; Balance over time, Side, Click a bar above or a band here to follow one post through the year., Show all, this year; texts added after the subcategory page — category sheet (Per day, Per subcategory, {name} (general), Monthly budget, From {month} on, Set a budget, Enter an amount, {amount} this month so far), balance (End of {n} · forecast).
- To port: iOS (dashboard order + expenses chart on dashboard + upright balance stacks + motion settings: iOS has NeonLinesBackground 24 fps → add Light/Off + background switch), Android (motion setting when more screens exist).

## Next / open

To do (Bart's list):
1. Review the onboarding draft (`/app/welcome`), then auto-open it for new
   accounts and port it to iOS.
2. Real-estate module: BUILT on web (see above). Migration 0004 applied. Next:
   port to iOS and Android; later per-country rules (DE, BE, UK, US…),
   home value history, rental properties.
3. Multiple years: add/view earlier years (monthly or year totals), year
   switcher; net worth starting before 1 January.
4+6. Month close + achievements: BUILT on web (commit aab3244). Migration
   0005_progress.sql (month_closes, goals, achievements, activity_days)
   written + tested, applied on Supabase 2026-10-23.
   Rules in lib/finance/progress.ts (pure, tested), model in
   progressModel.ts; pages /app/progress and /app/close; dashboard close
   banner + rings/streak strip. Open question: auto-prompt on the 1st or
   only the banner (now: banner). PORTED to iOS (Progress tab, close
   wizard, dashboard strip; SwiftData models; 14 unit tests). Android: rules
   ported + tested; screens wait for Android data/sync (phase 3). Sharing
   achievements later.
5. Android: continue phase 1–3 (screens, Supabase sync); see blueprint §9.
7. Real-estate module (expanded 2026-10-23): home + mortgage parts
   (annuity / linear / interest-only, rate, fixed-rate period, term, start),
   full amortisation schedule (interest vs repayment per month, total
   interest over the term, total paid), % ownership shown as a house that
   fills up, extra repayment scenarios ("pay €X extra → save €Y interest,
   N months sooner"), rate-period end reminder, LTV, home value over time,
   NL specifics (hypotheekrenteaftrek, eigenwoningforfait, NHG,
   aflossingsvrij deel). Feeds the balance sheet automatically.

Decisions (Bart, 2026-10-23): build order = real-estate module → month
close + achievements → onboarding. Achievements: personal first, sharing
later. Real estate: international by default + Netherlands rules now;
other countries' rules later (to do: DE, BE, UK, US, …).

9. Insurance: STARTED on web (/app/insurance, lib/finance/insurance.ts +
   tests, migration 0006_insurance.sql applied 2026-10-23). Premiums per month/year split by kind, deductibles,
   coverage check for your situation (home, mortgage, car, NL), renewals
   timeline with cancel-by dates, policy cards + editor; demo has 7 policies.
   Next: premiums → fixed costs link, policy documents (upload), renewal
   reminders, port to iOS/Android.
8. Rent vs buy: BUILT on web (/app/rent-vs-buy, lib/finance/rentVsBuy.ts +
   tests). Both sides spend the same per month, the cheaper side invests
   the difference; renter starts with own money + buying costs invested.
   Hero verdict at a year slider (1–40), break-even year, Difference/Both
   chart, first-month cost split (interest, repayment, upkeep, owner costs,
   NL tax back), totals, all assumptions as sliders (saved per device,
   prefilled from your home value and rent). PORTED to iOS (tab) and
   Android (screen), same numbers on all three (tests);
   later: investment tax per country (box 3), rent-to-buy later scenario.

9. Insurance module (Bart, 2026-10-23): overview of all policies (health,
   home/contents, liability, car, travel, life, disability, legal aid…):
   insurer, premium per month/year, deductible (eigen risico), coverage,
   renewal/cancel date, policy documents; premiums feed fixed costs; a
   coverage check ("what's missing for your situation"), yearly premium
   total and a renewal reminder.
8. Rent vs buy module (Bart, 2026-10-23): visualise the difference between
   renting and buying over the long term — rent (with yearly increases) +
   investing the difference vs. mortgage costs, maintenance, taxes, value
   growth and equity built; break-even year and wealth after N years.

10. FINANCE WRAPPED (Bart, 2026-10-24): a "Spotify Wrapped" for money, per month, shown after a month close. Several highlight cards to swipe through: biggest income, biggest expenses / top categories, savings rate, net worth change, balance-sheet summary (financial position), streaks/badges earned, comparisons with last month. Fluid, premium, shareable later.

11. MAC APP (Bart, 2026-10-24): native, from the iOS app — Mac Catalyst "optimised for Mac", branch `mac-app` in the iOS repo. Done: Catalyst enabled (same bundle id; Catalyst minimum macOS 15 via IPHONEOS_DEPLOYMENT_TARGET[sdk=macosx*]=18.0 because Bart's 2018 MacBook Pro can't run macOS 26; iOS stays 26.2), receipt scanner gated to iOS/macOS 26 (ReceiptScanning), sidebar navigation via Tab API + .sidebarAdaptable (also iPad), Go menu ⌘1…⌘9, window min size 980×680, hidden title. Builds for Mac + iOS; runs locally ad-hoc signed (no iCloud) with `open -n …/Debug-maccatalyst/Personal Finance.app --args -skipPaywall`. Next: signing with iCloud (Xcode must register the Mac + make a Mac Catalyst profile — Bart's OK needed), Mac polish (hover, menus: New transaction ⌘N, Settings ⌘,).
   PARITY PORT (Bart 2026-10-24: Mac/iOS must copy ALL website functionality incl. today's; features first, then Supabase). DONE in code on `mac-app` (all builds Mac + iOS, 21 unit tests pass): Real estate (Property/MortgagePartRecord, Mortgage.swift = website numbers, screen, feeds balance, demo), Insurance (InsurancePolicy, InsuranceRules, screen, demo), Subcategories (accordion page + suggestions, sheet per day / per sub / budget editor, budgets sub rows, demo subs), Dashboard order + compact progress + Expenses chart + T-account balance card, Animations (Motion Full/Light/Off, Live decimals 2–5 default 3, background on/off, odometer), charts (tight y-axis, red saldo below zero, sparkline dates, rings 2nd lap), Net worth asset mix, Balance forecast + live equity + gliding bars + Balance over time + full month names. NOT YET: visual check of Insurance/Categories/sheet/Budgets/Dashboard/Balance on the Mac (screen was asleep), iOS translations of the new strings (String catalog, at session end), then Supabase sync (sign-in, replace CloudKit). Tests on the Mac: `xcodebuild test … -destination 'platform=macOS,variant=Mac Catalyst' MACOSX_DEPLOYMENT_TARGET=15.0 IPHONEOS_DEPLOYMENT_TARGET=18.0` + ad-hoc signing flags. Open a section directly: `--args -skipPaywall -section realEstate`.

Open questions for Bart:
- Dashboard balance card default: Compact or Full?
- Earlier years: monthly totals enough, or import transactions?
- Month close: start automatically on the 1st, or only on demand?
- Android: PWA first? minimum Android version? on-device receipt scanning?

Before going live with the web app: hide the Apple sign-in button until it's
configured, set the Supabase Site URL, merge `web-app` into `main` (with
Bart's OK). Still to do on iOS: replace CloudKit with Supabase sync, align
the dashboard net worth ticker with the net worth model, app icon.
