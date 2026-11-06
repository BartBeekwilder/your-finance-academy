# Personal Finance — project status and hand-over

Read this first on any computer. It says where the project stands, how to
run it, and what's next. Keep it up to date at the end of every session
(Claude: update this file and commit it before finishing).

Last updated: 2026-11-05 (late evening).

TRANSLATIONS: all 16 languages complete again (5 Nov evening, on the Mac:
1593/1593). Keep it that way — translate new t() texts in the same commit
(`node scripts/i18n.mjs extract` then `report`). Labels that come from data
(e.g. lib/finance/metrics.ts, onboarding lists) go in EXTRA in scripts/i18n.mjs.

## The product

"Personal Finance" — run your money like a business. Three clients on one
backend:

| Part | Where | Branch |
|---|---|---|
| Website + web app (`/app`) | this repo (`your-finance-academy`), Next.js 16 | `web-app` (`main` = live site; last pushed to `main` 2026-11-05 at 2782f36) |
| iOS / iPadOS / Mac app | repo `Personal Finance` (SwiftUI) | `ios-port-nov04` (latest; from `ios-port-nov03`) |
| Android app | repo `personal-finance-android` (Kotlin + Compose), plan in `docs/android-blueprint.md` | `main` |
| Backend | Supabase project `cjdmrrwsyzpoiemiyyyu` (eu-west-1); schema in `supabase/migrations` 0001–0006 all applied (0005 + 0006 on 2026-10-23) | — |

Decisions:
- Supabase is the ONLY sync (iOS moves off CloudKit, keeps SwiftData as an
  offline cache). RevenueCat for one subscription across App Store, Play
  Store and Stripe.
- Sign-in: Sign in with Apple + email & password + email 8-digit code
  (Supabase sends 8). NO magic links. Demo mode to look around.
- Never push, deploy, or change accounts without asking Bart. Pushing to
  `main` deploys the live site (Vercel). Bart signs in to services himself.

## Code on GitHub (works from any computer)

- Website: github.com/BartBeekwilder/your-finance-academy (public) — work
  on branch `web-app`; `main` is the live site (push to `main` = deploy).
- iOS: github.com/BartBeekwilder/personal-finance-ios (private) — branch
  `ios-port-nov03` (latest).
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
   Needed for step 7 (signing in to fetch the encrypted copy).
6. `npx next dev -p 3000 -H localhost` → http://localhost:3000/app
7. Bart's real data (see "Bart's private data" below): on the sign-in page
   click "Start local data on this computer" (appears only in dev when
   `.private/finance.json` doesn't exist yet) → it creates an empty private
   file and opens Settings › Encrypted copy → sign in → Restore → Bart types
   his passphrase. Claude never types the passphrase or the password.

## Bart's private data (CONFIDENTIAL — read before touching it)

- Bart's real finances live ONLY in `.private/finance.json` (git-ignored,
  owner-only) on each computer, plus payslip files in `.private/docs`.
  This repo is PUBLIC: never commit, paste into docs, demo data, tests or
  commit messages any of his amounts, account numbers or documents.
- Open: dev server, then http://localhost:3000/app?local=1 (or the
  "Open my local data" link on sign-in). Routes `/api/local-data` and
  `/api/local-docs` only answer in dev on localhost.
- Saving writes the whole file and keeps `finance.prev.json` as backup.
  Before editing the file directly: make a copy
  (`finance.before-<what>.json`) and close other app tabs (a stale tab
  overwrites on its next save).
- Between computers: Settings › Encrypted copy — upload on one, restore on
  the other (Supabase table `encrypted_vaults`, ciphertext only, one copy
  per account, a new upload replaces it). There is no automatic sync, so
  restoring replaces that computer's local data with the uploaded copy.
- VAULT MODE (since 2026-11-04): signed in (no `?local=1`), the data lives
  in the account's copy (encrypted_vaults) — every change saved, other
  devices' saves merged. So signed in, the same data on every computer and
  on the live site; the local file above stays for dev on one computer.
  Since 2026-11-05 (Bart's decision): NO passphrase by default — sign in and
  the app opens; the passphrase (end-to-end encryption) is an optional extra
  under Settings › Extra protection (see "Done 2026-11-05").
- Supabase sync of real data waits for tables for the history fields
  (yearSnapshots, yearCategoryTotals, yearIncomeTotals), documents and
  property.comparable_rent.

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

## Done 2026-10-28 — smoother motion (web + iOS)

- Web: no backdrop blur on cards, neon canvas drawn at low resolution
  instead of a full-screen CSS blur, every looping animation (dot pulses,
  stripes, heat sheen, equity glow) now transform/opacity only.
- iOS (branch `motion-perf-oct28`, from `ios-port-oct26`): looping
  animations played by Core Animation (Extensions/LoopLayer.swift), neon
  background as keyframed CAShapeLayers instead of a 24 fps Canvas per
  screen. Android not done yet.
- Advances ("Voorgeschoten — krijg ik terug"): Quick Add expense toggle
  with a required label; not spending (lib/finance/advances.ts takes them
  out of data.transactions into data.advances); the balance sheet moves
  open ones from Accounts to Amounts to receive (group "Voorgeschoten") with
  a "Paid back" button; paid with the current account or a credit card
  (current account preselected). Migration `0011_advances.sql` applied on
  Supabase (1 Nov, by Bart). iOS + Android: on the port list.

## Done 2026-11-01

- Category chart (Uitgaven/Inkomen per dag/maand): pointing at a category
  moves it to the bottom of the summary bar with a dashed budget tick (month:
  that month's budget; year: January up to now) and "x of y budget" above.
  A lift-to-zero + dotted line in the main chart was tried and removed
  (Bart didn't like it). Readout '% of the day/month' now translated.
- Uitgaven and Inkomen: month picker (components/finance/MonthPicker.tsx)
  in Month view; tiles, figures, live tile (LiveTiles/TileSparkline `at`),
  per-day chart (CategoryBars `past`) and transactions follow the picked
  month; a finished month shows no forecast or payday countdown.

## Done 2026-11-03

- Windows work computer set up (repos side by side in
  `C:\Users\nlbbeek\PycharmProjects`, signed in to GitHub via Git Credential
  Manager in the browser — no admin rights there, so no `gh`). PowerShell
  blocks `npx.ps1`: start the dev server with `npx.cmd next dev -p 3000 -H localhost`.
- Category chart summary bar: pointing at a segment in the bar itself only
  lights it (no move to the bottom) — moving it put another segment under
  the pointer and the bar flickered. Pointing at the legend or the day/month
  bars still moves the category to the bottom with its budget tick. The
  budget tick is measured from the lit segment's base, wherever it sits.
- FIXED COSTS BOOK THEMSELVES (Bart: wants the mortgage in Spent from the
  1st, ticking): lib/finance/recurring.ts `dueFixedCosts` (+tests) — last
  month's fixed cost is copied into this month on the same day once that
  day has come, if it's monthly (has a recurrence_id, or the same category
  + description was there the month before too) and not already there (same
  recurrence_id, or same category + description entered by hand). Copy id =
  stableId(recurrence, month), so a deleted copy never comes back (local
  deletions / Supabase duplicate key). Only the current month — earlier
  months are history. FinanceProvider runs it on every change and hourly.
  No new column (uses recurrence_id). Live tiles already count fixed costs ×
  fraction of the month, so they tick from the 1st. To port: iOS + Android.
- Quick Add starts in the month being viewed: with an earlier month picked
  on Expenses / Income (lib/finance/viewedMonth.ts, set by those pages),
  a new transaction's date starts on the same day in that month (last day
  if shorter), so the date picker opens there; salary's payday too.
  The category sheet (CategoryDetail) opened there shows that month too
  (seen from its last moment: total, budget, per day, transactions).
- Income › Gross and net per month: the current month, until its income is
  in, is drawn at the expected net (projectedNetIncome, gross at this year's
  ratio) as a dotted forecast instead of dipping to €0 (grossNetByMonth
  `expectCurrent`, chart only; the stats still use what came in). A finished
  month picked keeps its real figures.
- Live tile alone on a page (Expenses' Spent, Income's Income — LiveTiles
  `only`): wide layout (Tile `wide`, .pf-tile-wide) — figures left, chart
  right at 118 px tall (TileSparkline `height`, default 54); stacks below
  760 px. Liquidity page's tile (NetWorthTile) too. Dashboard's three
  stacked tiles unchanged: they set that row's height (the card beside
  stretches to them), so a taller chart grows the dashboard — Bart: leave
  the dashboard as it is.
  Scan of all pages at 1400 px: every other chart is already 180–220 px.
- Tile charts (Income / Spent / Balance / Liquidity, dashboard and pages):
  in Month view every day still to come can be pointed at — a point on the
  dotted forecast line from now to the month's forecast end, labelled
  "<date> · forecast" (TileSparkline `ahead`). The bar view's forecast
  labels now use the translated "· forecast" too.
- Income per day, Spread: only the main income (largest this year) is
  spread over the days; other income (e.g. a side income) stays on its own
  day. A finished month spreads what came in, not the expected net
  (CategoryBars dayBuckets `past`).
- Income tile, Per day bars: same rule — the salary accrues evenly, other
  income (not salary-like) shows on its own day (TileSparkline `salaryTest`).
- Live income counts other income too: salary × fraction of the month plus
  other income entered so far (calc `otherIncome` / `salaryTest`) — in the
  Income tile, Balance/Liquidity, monthToDate, netWorthFigures.liveChange
  and this month's yearForecast. To port to iOS/Android.
- Liquidity card This Month / This Year: on the live model (netWorthFigures
  liveChange), not the raw entries — fixed costs booked on the 1st made
  Work read −€1.4K before payday. Close-month nudge: only the last finished
  month (progressModel `closable`), older open months don't nag. To port.
- Liquidity › Years and Balance sheet › Years (YearsCompare): bars per
  year with the headline as a line (Saved / Equity), two years compared
  metric by metric (€ and %), table with change vs the year before.
  Liquidity: income, spent, saved, savings rate (yearTotals, this year as
  expected). Balance: yearSnapshots (last year from the books if missing)
  + today. Dashboard Progress tile: a bar per ring + way to next level,
  and "<month> closed" once last month is closed. To port.
- Check-in ("Bring your books up to date"): checklist — all expenses, all
  income, account balances match the bank — each with Add / Check. Once
  per period (Settings › Check-in: daily / twice a week Mon–Wed + Thu–Sun /
  weekly; profile.checkin_interval, migration 0012 — run it on Supabase).
  Confirming stores an achievement `checkin:YYYY-MM-DD` worth 15 points (on
  top of the 5 for opening the app). Logic: lib/finance/checkin.ts (+tests).
  Progress page card on top; dashboard Progress tile nudge opens it in a
  sheet. A check-in also counts the days it covers as kept up (back to the
  previous check-in, the first time to the 1st; max 31 days): Tracking ring,
  streaks, calendar and day points (checkin.ts coveredDays / progressModel
  activeDays). Saving ring now the month-end forecast (yearForecast); Budget
  ring too: per budget spent + usual rest of month (avg of 3 months before,
  else the budget pace) ≤ budget. Calendar day rings keep the pace view;
  saving there spreads salary + fixed costs (dayRings `accrue`). Glossary:
  rings, ring-tracking/budget/saving, checkin (ⓘ on Progress). To port.
- Budgets total (Month and Year): compares like with like — categories
  with a budget, plus fixed costs without one (Bart's Hypotheek) at their
  own amount as budget (months ahead at the latest month's amount); in the
  running month fixed costs count as used up to today (live), as in their
  bars. Before, all spending was added against only the set budgets, so
  the mortgage made the total look over budget on the 1st. In the Monthly
  limits list such a fixed cost now gets a bar too ("Fixed · €…", its own
  amount as budget, the BudgetBar fixed mode: used up to today live + paid,
  not yet used); Compare / Largest first count that amount. Still English-
  only on that page: "Budget up to today", "over", "under" (to translate).

## iOS port 2026-11-03 (branch `ios-port-nov03`, pushed; builds, rule tests pass; not yet seen on a device)
Ported: side income in live income; ring forecasts (budget + saving), check-in
(card, sheet, Settings, pill, covered days, synced `checkin_interval`),
calendar saving spread, last-month-only close; Progress block bars, forecast
legend, ring colours on closed months, glossary terms; Liquidity card on the
live model with Work · Investments; tile bars fixed/variable + side income;
Years view on Liquidity and Balance; advances (model + sync + Quick Add +
balance sheet; kept out of spending); Income per day keeps side income on its
day; "Share %"; translations (16 languages).
Still open on iOS: month picker on Expenses/Income (+ Quick Add / category
sheet in the viewed month), category-chart budget tick on the summary bar,
budgets: fixed costs without a budget get a live bar + total like with like,
gross/net chart this month at expected, Quick Add new-subcategory label,
wide Liquidity tile / tile-alone layout, pointing at forecast days, donut
growing into its tile. Android: everything since 27 Oct.
Also on web 4 Nov, to port: Budget ring = ONE month goal for all budgets together
(progressModel `budgetTotals`, progress `budgetTotalRing`: full while the month-end
forecast fits the total budget, else budget ÷ forecast — × the month's fraction so it
fills day by day (closes on the last day); calendar day ring = that
day's forecast vs the total, dayRings `budgetPlan`); Progress tile bar shows
'€ forecast / € budget' with a tick at the budget, red when over; Progress page:
level + rings on top, check-in card below.
ONE 'expected' rule (calc `expectedByCategory`): this month = variable spent so far +
usual variable × rest of month + fixed costs for the whole month (≥ usual); usual =
average of this year's finished months (January: the 3 months before). Used by
yearForecast (this month), the Budgets page and the budget ring; Expenses' hint
shows the budgeted part.
Balance: income without an account dated later THIS month counts under Amounts to
receive now (pendingIncome laterThisMonth; Liquidity's 'Where it sits' keeps only
up to now); Receivable = salary earned − salary entered (other income excluded).
Amounts to receive: every line has a round tick — income: tap → check + 'Received on'
Lopende rekening / Creditcard / Other… sets account_id (date → today if later);
advance: tap → paid back (repaid_at, same account).
Balance over time = the Investments layout (PortfolioMix `MixChart`, shared): chart +
total/bar/list on the right, names switch posts on/off (per side, remembered).
Saving ring fills with the month too: (forecast ÷ 20% goal) × month fraction —
on course it closes on the last day, saving more = faster, up to a 2nd lap
(progress savedIsForecast); tile bar shows the ring, tooltip the expected rate.
Fixed costs still to come this month (recurring copies not yet due, recurring
`upcomingFixedCosts`) count in the live figures from the 1st (calc `liveFixed`:
tiles, monthToDate, liveChange, tile charts); 'Entered' stays booked only.
Tile readouts show fixed / variable with %.
Tracking ring: only days a check-in covers count (visits only before the first
check-in, for history); kept-up days ÷ days in the month, so it fills with the
month. Opening the app still earns 5 points a day.
Balance over time › Years (calc `balanceYears`): year-ends from yearSnapshots + today;
homes interpolated purchase→today's value (estimate), mortgage parts on schedule,
investments at market (within price history) or cost of what was held; the rest
of each imported total = Other assets / Other debts; equity = assets − debts.

## Done 2026-11-04 (evening, on the Mac; written up 5 Nov from the commits)

- VAULT MODE (FinanceProvider "Vault", components/finance/VaultUnlock.tsx,
  vault.ts): signed in, the data lives ONLY in the encrypted vault. Phase
  `locked` asks for the passphrase (or to choose one the first time); it's
  kept in the tab's memory only, the key derived once per salt. Every change
  is sealed and put back (debounced) only if the vault is still the copy the
  tab last saw (updated_at); otherwise the other device's copy is opened and
  merged (vaultMerge, same rule as the apps) and the merge is saved. A tab
  coming back into view pulls other devices' saves. Auto-lock after 15
  minutes without use; sidebar shows the status (saved / saving / error) and
  "Lock now". Sign-ups (NEXT_PUBLIC_PF_SIGNUPS=open, always open in dev) and
  Sign in with Apple (NEXT_PUBLIC_PF_APPLE=on) hidden unless enabled by env.
  Unlock card centred like the sign-in card.
- Sign-in code: 8 digits (Supabase sends 8), cursor starts at the left; all
  texts "an 8-digit code" in 17 languages.
- CHECK-IN as story cards in the Month Wrapped style (CheckinCard.tsx): one
  question per card (expenses, income, account balances) with Yes / fix, a
  summary card; the current account balance is its own question and can be
  corrected on the spot. A strip of the month's days shows which are kept
  up; pick through which day the check-in covers (open days earn their day
  points; checkin.ts + tests). The check-in tick can be taken back; the
  check-in bonus counts once per day.
- Account balances net of open advances everywhere (check-in, Liquidity =
  balance sheet; calc.ts).
- Liquidity card (NetWorthCard): pace caption dropped; day / month / year as
  an aligned table (total · work · investments).
- Progress tile (ProgressStrip): total points pill under the streak. Streak
  flame (ProgressParts) alive from day one: orange, uneven flicker, hotter
  from a week.
- Expenses tiles (CategoryTiles): two income rings side by side, ring above
  its text — share of the month's expected income spent, and share of the
  income earned so far that's spent (both spread over the month).
- Migration `0012_checkin_interval.sql` (profiles.checkin_interval): the
  3 Nov notes say "run it on Supabase" — not confirmed done; check.
- Pushed to `main` (live site) on 4 Nov: `main` = `web-app` at 5587095.
- iOS branch `ios-port-nov04`: port of 4 Nov (safe vault sync, fixed-cost
  rule, one expected rule, month-goal rings, check-in cards, Progress order,
  16 languages) + performance (expected rule 76 → 9 ms, figures cached per
  data/day, Progress 73 → 12 ms); dev builds remember -skipPaywall.

## Done 2026-11-05 — passphrase optional (Bart: "email log-in only, a passphrase as an option")

- Backup branch before the change: `backup/before-optional-passphrase-nov05`.
- vault.ts: a copy WITHOUT a passphrase = the same encrypted_vaults row with
  `kdf.name = "none"`, ciphertext = the plain JSON, iv/salt empty (no
  migration). `plain()` is the Unlocked for it (`protected: false`; opening a
  protected copy throws `NeedsPassphrase`); `unlock(passphrase)` and `open()`
  also read plain copies, so either kind of device reads either kind of copy.
  Tests in vault.test.mjs.
- FinanceProvider: after sign-in `openAccountCopy` — no row → starts a plain
  copy from the account (loadAll); plain row → the app opens straight away;
  protected row → the unlock card (VaultUnlock) as before. Only a protected
  copy auto-locks (15 min) or offers "Lock now"; if another device adds a
  passphrase, a tab without it goes to the unlock card on its next pull.
  `setPassphrase(next | null, current?)` re-saves the copy the new way
  (taking it off checks `current` against the copy first).
- Settings › Extra protection (components/finance/PassphraseSection.tsx,
  signed in only): Add a passphrase (twice, ≥ 12 chars, meter, "nobody can
  recover it") / Remove passphrase (current passphrase). Sidebar chip:
  "Saved to your account" without, "Encrypted and saved" + lock with.
  Account line in Settings says end-to-end only when protected. 11 new texts
  (+ the untranslated "{n} days") in 17 languages.
- Trade-off told to Bart: without a passphrase the data is readable by the
  account (row-level security) and by whoever has full access to the
  Supabase project (incl. the secret key that was pasted in chat on 3 Nov —
  he was asked to delete/roll it).
- To do on iOS + Android before Bart removes his passphrase there: their
  vault sync must read/write `kdf.name = "none"` copies (Vault.kt /
  VaultCrypto) — today they expect an encrypted copy.
- NOT YET TESTED signed in: needs Bart's login + passphrase (Claude never
  types either). Demo + sign-in page checked in the browser; 99 tests pass.

## Done 2026-11-05 — onboarding journey bar

- components/finance/OnboardingProgress.tsx (+ .pf-jb* in finance.css),
  replacing the 3 px line on top of the onboarding card: a node per question
  (Currency, Household, Income, Accounts, Fixed costs, Budgets, Balance
  sheet, Start date) with its icon, on a glass track. The brand-gradient
  fill springs (slight overshoot) to the step you're on, a glowing comet at
  its tip and a sheen running through it; the current node breathes, done
  nodes become a check (pop), ahead nodes wait dimmed. Done nodes can be
  tapped to go back (also from the last screen, which has no Back button).
  Caption "Step n of 8 · <name>" + %, "Start" on Welcome, "All set" at the
  end when the whole track lights up node by node. Transform/opacity only;
  off with Motion off / reduced motion. The old "3 of 8" in the footer is
  gone; "Back" is now translated. 3 new texts in 17 languages.
- Onboarding on a phone: steps no longer run off the right edge (the
  screen grid is one minmax(0, 1fr) column; account names width 0 + flex).
- Bart liked it straight away ("exactly what I had in mind").
- Logo coin (BrandMark): the currency symbol is centred on its INK, not
  its font box — measured once per symbol with a canvas
  (measureText actualBoundingBox) and placed by start point + alphabetic
  baseline; re-measured when web fonts load. Before, Windows' font put € 0.8
  units (of 64) too low; now every symbol (€ $ £ ¥ kr CHF) is within 0.1.
  Port note for iOS/Android: centre the coin's symbol on its glyph bounds.
- Language before the app (Bart): components/finance/LanguagePicker.tsx —
  a pill (globe + the language's own name) on the sign-in card (top right,
  next to the logo) and on the onboarding's Welcome screen; it opens a
  two-column panel with all 17 languages in their own script (spring-in,
  current one checked, Arabic right-to-left), closes on outside click /
  Escape (without closing the onboarding). The sign-in and unlock screens
  now sit in their own LanguageRoot (FinanceProvider), so they switch at
  once — the app's LanguageRoot is inside the provider. Journey bar runs
  right-to-left for Arabic (fill origin + comet on inset-inline-start).
  No new texts (uses "Language").

## Done 2026-11-05 — Loans (Bart: "other loans need a label, and later what we pay off a month at which rate")

- Backup branch: `backup/before-loans-nov05`.
- Model: `Loan` (types.ts; FinanceData.loans, optional) — name, kind
  (student / car / personal / credit / other), balance on `start_date`,
  annual rate %, monthly payment. Lives in the account's copy (vault) and
  the local file only — NO Supabase table (legacy "supabase" source keeps
  it in memory only).
- Maths lib/finance/loans.ts (+ loans.test.mjs): on the 1st after the
  stand and every 1st after that, interest (balance × rate / 12) is added
  and the payment comes off (the last one only what's left). loanAt,
  loanSchedule (≤ 50 yrs), payoff (null = never: no payment, or it doesn't
  cover the interest). Bart chose: the debt goes down by itself.
- Balance sheet (calc balanceSheet + balanceYears): each loan as a debt
  "From Loans" at its month-end balance; years before the stand → Other.
- Page /app/loans (menu "Loans", after Real estate; components/finance/
  loanKinds.ts has kinds/icons/colours): hero (still owed, per month,
  debt-free month, interest still to pay, bar per loan), "Debt over time"
  stacked chart (now → last payoff, hover), a card per loan (left now, %
  paid off, per month, rate, payoff/interest or a warning). Editor: kind
  chips, name, left now, rate, monthly, live preview ("Paid off in … · …
  interest to go"); saving re-stands at today. New loan: "Book the monthly
  payment as a fixed cost" (on) → a fixed expense on the 1st in category
  "Loans" (made once) with recurrence_id = loan id; recurring.ts copies it
  monthly and STOPS once the loan is paid off (test). Changing the payment
  updates this month's booking.
- Onboarding balance step: "Other loans" is a list — per loan a kind icon
  (tap to cycle), a name and the amount; saved as loans (rate/payment 0,
  to fill in under Loans). 27 new texts in 17 languages (loan kinds in
  scripts/i18n.mjs EXTRA).
- To port: iOS + Android (model, maths, page, onboarding).

## Done 2026-11-05 — premium onboarding: quick start or complete setup (Bart approved the design)

- Backup branch: `backup/before-premium-onboarding-nov05`. Still the
  PREVIEW at /app/welcome (saves nothing) until Bart approves; then open it
  for new accounts.
- Routes (components/finance/onboardingRoutes.ts): after Welcome a "How do
  you want to start?" screen with two cards — Quick start (~2 min: currency,
  household, income, accounts, fixed costs; budgets suggested from income)
  and Complete setup (~10 min, 8 chapters: Basics, Income, Money now
  [accounts + investments], Fixed costs and insurance, Home and debts [loans
  WITH rate + monthly], Budgets and goals [savings goal: target + 6/12/24/36
  months → "€ a month · % of income"], History, Security [check-in rhythm +
  optional passphrase via setPassphrase, vault only]).
- Journey bar (OnboardingProgress) takes `nodes`: a node per step (quick)
  or per chapter (complete) with "Chapter n of 8", dots for the questions
  inside a chapter, and a partial fill within a chapter.
- Finale (OnboardingReveal): story cards in the Month Wrapped style —
  left to save each month (count-up), in your accounts, equity (when it
  differs), debt-free month (loans with a payment), "Your books are open"
  + open the dashboard. When continuing, figures set up earlier come from
  the books (fixed costs this month, carried budgets, account balances).
- Remembered: the whole draft per device in localStorage
  (pf-onboarding-draft / pf-onboarding-preview-draft; never the
  passphrase); cleared on finish. Only answered steps are written.
  profile.onboarding = { route, steps, hidden? } (vault/local; stripped for
  the legacy Supabase profile table).
- Dashboard: FinishSetupCard after a quick start — ring "2/8", "n of 8
  chapters done", chips of the open chapters, Continue →
  /app/welcome?continue=1 (complete route at the first open question,
  answered ones skipped, no Back before it), X hides it. Preview: works per
  tab via sessionStorage (pf-onboarding-preview).
- New: provider addHolding (onboarding investments: name, kind, value as
  cost basis, no symbol → at cost until a ticker is added). Onboarding
  overlay no longer scrolls sideways (glow); route cards keep their content
  at the top. 46 new texts in 17 languages (chapter names in i18n EXTRA).
- Checked in the browser (demo, nl): quick route → finale → dashboard card
  → continue → all chapters → finale with equity + debt-free month.
- Open questions for Bart: are the 5 quick questions right, the chapter
  order right, and should "Finish your setup" be dismissable (now: yes, X)?
  Then: make /app/welcome real and open it for new accounts. To port.

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
- INCOME GROSS / NET: migration 0007_income_gross.sql (transactions.gross_amount, nullable; applied on Supabase 2026-10-25). Quick Add income: net received + optional gross (placeholder = net × profile gross/net, Tab takes it) + live deductions; Income page GrossNetChart (gross + net lines per month this year, deductions band; hint card when no gross entered) + 'Gross this month/year' stats. Provider only sends gross_amount when set, so saving works before the migration as long as no gross is entered. Demo salaries carry gross (5200/3850), holiday allowance/bonus at 45%.
- SPREAD EXPENSES: migration 0008_spread_expenses.sql (transactions.spread_months 2–120, nullable; applied on Supabase 2026-10-25). lib/finance/spread.ts: spreadParts (N monthly parts, ids `${id}~k`, last part takes rounding remainder, counted as fixed), withSpread (FinanceProvider shows parts instead of the purchase everywhere), spreadBookValue (paid, not yet used up). Quick Add expense: 'Spread out' toggle, chips 6 mo/1/2/3/4/5 yrs + own months, readout '€41,67 per month, Okt 2026 – Sep 2030'. Month/category lists show '· 6/48'; editing a part opens the purchase; Transactions ledger shows the purchase once ('spread over 48 mo'). Balance: Accounts minus book value, asset 'Spread purchases'. Demo: €2,000 laptop over 48 months. Tests: test:calc spread.test.mjs, test:db.
- INVESTMENTS LIVE (2026-10-25): /api/quotes (Yahoo Finance chart API, server side, symbols only, cached 30 s–1 h; ranges 1d/5d/1mo/1y/5y). lib/finance/quotes.ts (quoteSymbol: crypto → BTC-EUR, metals → GC=F/SI=F, FX EURUSD=X; holdingValue real vs nominal, day change; portfolioSeries; tests). Investments page: live hero (real value ticking, Live badge pulsing while a market is open, today + total chips, Nominal vs Real, chart per period with nominal dashed from 1M, period change = growth excl. money put in, 1D = last 24 h), rows clickable (sparkline, real value, result € and % green/red, nominal), detail sheet (chart, quantity, price, real, nominal, result, today, 52-week range, since). Balance sheet counts investments at market value (Bart: 'balans moet reëel'): lib/finance/useMarket.ts in FinanceProvider puts data.market (runtime only: per holding a year of daily values + today's live value) and quotes.investmentsValue values each month-end at its price (at cost while quotes load or without a quote). netWorthFigures (live net worth tile, cash model) still uses cost. Net worth 'Where it sits': investments grouped per kind (Stocks / Crypto / Metals) at market value. Stock logos: Financial Modeling Prep public logo images by ticker (fallback: type icon) — iOS port: same URL. Dev server now `-H localhost` (IPv6 ::1 only; 127.0.0.1 broke HMR → reload loop).
- TRANSLATIONS (web): all 16 languages complete as of 2026-10-25 (924/924, `node scripts/i18n.mjs report`). iOS String catalog still needs today's texts when features are ported.
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

12. DOCUMENT VAULT (Bart, 2026-10-25): a repository in the app to keep financial documents — payslips, bills/invoices, bank statements, mortgage and insurance papers, tax returns, receipts. Ideas: upload/scan (iPhone camera), folders per kind + year, search, link a document to a transaction / income month / insurance policy / property, reminders for expiry/renewal, payslip read-out to fill gross/net. Must be private: end-to-end encrypted (same passphrase approach as the encrypted upload), local-only option like the private data mode. Web first, then iOS/Mac/Android.

13. ENCRYPTED UPLOAD (Bart, 2026-10-25): private data stays local for now (.private/finance.json, dev-only /api/local-data). Option to upload encrypted: browser encrypts with a passphrase only Bart knows (WebCrypto AES-GCM, PBKDF2/Argon2 key), Supabase stores ciphertext only. BUILT 2026-10-25: migration 0009_encrypted_vault.sql (one row per user: ciphertext, iv, salt, kdf; RLS own row; DB tests) — applied on Supabase 2026-10-26. lib/finance/vault.ts (PBKDF2-SHA256 600k → AES-256-GCM, Web Crypto; tests). Settings › 'Encrypted copy in your account' (local mode): sign in (SignIn in a sheet, no demo link), upload (passphrase twice, ≥12 chars, meter) / restore (decrypt, confirm, replaces local data). Passphrase never stored or sent. Next: restore on iPhone/Mac app; document vault reuses this.

14. COMPARE (Bart, 2026-10-25): Expenses › Vergelijken. lib/finance/compare.ts (+tests): spend per top-level category per month per year; earlier years without data get a SAMPLE (this year × 0.8 / 1.2 / 0.9 with wobble, flagged 'voorbeeld', never stored; a month with real spending uses real numbers). YearCompare: one smooth line per year (this year bold red, rest dashed at the earlier years' average), min–max band + average, year chips, category select, Per month / Added up, YTD vs last year. MonthCompare: a month vs last year / average per category, bars + € / % difference. Next: import real history (Bart's Numbers sheets 2019–2025 as CSV), category vs category chart, compare in the category sheet.

15. DASHBOARD YEARS VIEW (Bart, 2026-10-26): top-right Month · Year · Years switch on the dashboard. Month / Year drive the live tiles (controlled) and the expenses chart; Years swaps the tiles for YearsOverview (income / spent / balance per year 2022–2026: this year solid + dashed forecast cap, expected this year, % vs last year, average per year, total; samples for years without data) and the expenses chart for YearCompare. compare.yearTotals (+test).

16. HISTORY IMPORT (Bart, 2026-10-26): FinanceData.yearSnapshots (assets/liabilities per year → equity backdrop on the dashboard net worth card), yearCategoryTotals (spending per category per year 2017–2025) and yearIncomeTotals (income per year + gross; 2018 gross estimated from 2019's ratio). Local data only — needs Supabase tables before sync. compare.ts: real transactions first, then the year total's remainder spread evenly over months without transactions ('jaartotaal'), samples only for years with nothing imported, income never invented for imported years. historyBack() → Years view and Compare show all years (older ones hidden behind chips in Compare).

17. PAYSLIPS (Bart, 2026-10-26): Income › paperclip per month (Year view) uploads a PDF/image to .private/docs via /api/local-docs (dev-only, localhost, owner-only files); PDFs are read server-side with pdfjs-dist 6.4.299 (serverExternalPackages) and lib/finance/payslip.ts (gross / net / wage tax / period, Dutch + English; tests); sheet shows read vs entered and 'Use these figures' updates (or adds) the month's salary; archive 'Payslips' by year. FinanceData.documents. Local mode only — encrypted account storage still to do (document vault).
18. HOUSEHOLD (Bart, 2026-10-26: 'inkomen + wie betaalde', stacked per person): Profile.household (members id/name/colour; 2+ = together), Transaction.person_id (income: whose; expense: who paid, null = shared). Migration 0010_household.sql (profiles.household jsonb, transactions.person_id) + DB tests — applied on Supabase 2026-10-26. lib/finance/household.ts (+tests). Settings › Household, onboarding step 'Who are these books for?', Quick Add 'From' / 'Paid by', Income 'Together / Per person' and Expenses 'Together / Who paid' (PeopleSplit: stacked bars per month + totals/shares), person tags on transaction rows.

19. ACCOUNTS LIKE THE BANK (Bart, 2026-10-26): spending without an account counts on the default account (calc.accountFlows); income without an account is 'Amounts to receive' (calc.pendingIncome) — its own balance line, unfoldable per transaction; Quick Add income has 'Still to receive'. Accounts fold grouped by kind (current / savings / credit / cash) in the order added, empty accounts hidden; leftover shows as 'Correction'. Bart's local data: savings accounts as in his bank (Spaarrekening I, II, De 10 van Gent, Autoverzekering, Gemeentelijke Belasting — the last two moved from balance posts), 2026 history booked on Lopende rekening, the old correction account removed. Balance equity waterfall: Per year.

20. LIQUIDITY + GLOSSARY (Bart, 2026-10-26): 'Net worth' renamed 'Liquidity' (nav, page, dashboard card, tile; route stays /app/net-worth) — accounts + investments at market value (netWorthFigures uses investmentsValue when quotes are in); asset mix per kind at market value. Glossary: lib/finance/glossary.ts (18 terms, keys extracted by scripts/i18n.mjs), page /app/glossary (nav foot, above Settings), InfoTip ⓘ on Liquidity, balance Assets / Liabilities / Equity and auto lines, investments Nominal / Real. Bart wants to see the ⓘ first before adding more.

21. NEW COMPUTER (2026-10-26): sign-in shows "Start local data on this computer" in dev when there's no private file; it PUTs an empty file and opens /app/settings#vault to restore the encrypted copy.

22. QUICK ADD (2026-10-26): the subcategory row always opens under a picked category, with an inline "+ Subcategory" chip (takes the parent's icon/colour, Enter saves and selects). It also remembers descriptions: typing a note used before (datalist suggestions) fills in that transaction's category/subcategory and account, never overriding what was picked by hand in the form; hint "Filled in like last time". New transactions only.

23. BART'S DATA FILLED IN (2026-10-25/26, local only): accounts in his bank's order, investments (live quotes, logos), 2017–2025 history, mortgage from the bank offer (two annuity parts), home, rent vs buy prefilled from the home (purchase price, loan parts, weighted rate) and property.comparable_rent.

Next (web): see whether Bart likes the ⓘ tips before adding more; category vs category compare; compare inside the category sheet; payslips into the encrypted vault (document vault, 12); Supabase tables for the local-only fields above; onboarding review; Finance Wrapped (10). Then port everything to iOS/Mac/Android when Bart says the web is done — the port list is Bart's Apple Note "port list" (Mac only; on Windows ask him or read this file).

24. MONTH WRAPPED (2026-10-26): the month close is now 6 steps — Income, Fixed costs, Your month, Budgets, Month-end balances, Summary. "Your month" = story cards (components/finance/MonthWrapped.tsx, data lib/finance/wrapped.ts): saved/in/out/savings rate vs last month; where it went (top variable categories + biggest single expense); a watch-style ring per variable category against its budget (or, without one, the 3-month average) with a red second lap when over; investments' month (start/end, best/weakest, from data.market); equity change; facts (expenses entered, days without spending, most expensive day, fixed costs). Tap right/left or arrows, segments on top. "Budgets" = next month's plan (lib/finance/budgetPlan.ts: budgets carry on until changed via budgetIn; proposal = 3-month average; goals = / −5 / −10 / −20% per category or for all; saved on closing). Item 10 (Finance Wrapped) is thereby started inside the close.

25. PORT TO iOS/MAC (2026-10-27), iOS repo branch `ios-port-oct26` (pushed; backup zip `Personal Finance_backup_pre_port_20261026.zip`): new ring colours; Progress › Streaks and calendar (DayRings); month close in 6 steps with Month Wrapped (story cards, category rings), next month's budget plan (BudgetPlan; budgets carry on everywhere via BudgetPlan.budgetIn), ring legend notes, tappable lines, expandable celebration; Quick Add — sums (AmountExpression), subcategory chips + inline add, remembered descriptions, Paid with / Received on, payday date + 'This is my payday', gross on income, spread out (Transaction.grossAmount / spreadMonths / personID; spread parts counted in FinanceFigures + BudgetCalculator via Spread); income tile salary tick; Settings › Payday; Investments live (QuoteService = /api/quotes, Quotes = quotes.ts; hero, drag-select return + zoom, nominal pinned, rows with logos + own period, detail, Value per holding); balance sheet at month-end market prices; 'Liquidity' rename + Glossary + ⓘ; payslips (FinanceDocument model with external storage; Payslip reader verified on real payslips = same numbers as the web; detail → IncomeRecord); payslip badges; 'Last updated' pill; ≈ per day left over. All strings in 16 languages (script /tmp/x/ios_i18n.py idea: reuse web translations; keep Xcode xcstrings format). Builds for iPhone simulator and Mac Catalyst; checked in the simulator (Progress, Investments, Month close, Dashboard). DEBUG flags: -section <tab>, -scrollTo calendar|holdings|mix, -openClose <step>.
    DONE 2026-10-27 (later): dashboard Month · Year · Years (YearsOverviewCard; Years swaps the tiles and the chart for YearCompare), Expenses › Compare (YearCompareCard per category, MonthCompareCard; Compare.swift = compare.ts, samples for empty months, no imported history yet); household (HouseholdMember model synced, Household.swift = household.ts, Settings › Household, From/Paid by chips in Quick Add, PeopleSplitCard on Income 'Per person' / Expenses 'Who paid', PersonTag in rows); spread purchases as k/N parts in month lists + 'spread over N mo' in the ledger; pinned category scope bar on Expenses; equity value axis on the balance line; BrandToggle segments equal width; Month Wrapped investments card (year quotes). Mac Catalyst builds. Extra DEBUG flags: -dashboard.years YES, -openSettings, -perPerson, -scopeFirst, -wrappedCard <n>.
    Left for later on iOS: onboarding wizard (web version is still a draft preview at /app/welcome — port once Bart has reviewed it); imported history (yearSnapshots / yearCategoryTotals / yearIncomeTotals) + equity backdrop — arrive with Supabase sync, Compare already takes them in shape.
26. ANDROID PORT (2026-10-27), repo ~/Developer/personal-finance-android, branch main (pushed). Storage: one JSON file in the app's private files in the web's FinanceData shape (FinanceStore + Doc: collections camelCase, Supabase column names, money as strings, soft deletes with deleted_at + updated_at for later sync, collections Android doesn't know are kept and written back); read in the background; demo year on first launch (same generator as web/iOS, incl. holdings, home + two-part mortgage, balance posts, insurance). Screens: Dashboard (Last updated pill, Liquidity live, close banner, compact progress, Month · Year · Years, balance card, expenses chart / year on year, carry-on budgets), Income (tile, stats, per category or per person, months, payslips via pdfbox-android, this month), Expenses (tile, category tiles + pinned scope bar, stats, category bars or who paid, Compare year on year + month against month, this month with spread parts k/N), Liquidity, Balance sheet (equity line + forecast + value axis, bars, lines, own posts per month; homes and mortgages from Real estate; investments at month-end market prices), Investments (Yahoo, Live badge, period chart with nominal, holdings with logos/sparklines, detail, add/delete), Transactions (ledger, spread once), Budgets (carry on, edit from a month), Categories (subs with suggestions, editor), Progress (level, rings with second lap, streaks + calendar, badges incl. payslips) + month close (6 steps with Month Wrapped and budget plan), Real estate (Mortgage 1:1, same test numbers), Insurance (rules 1:1, same tests), Glossary + ⓘ, Settings (currency, income + payday, household, accounts, start over), Rent or buy, Quick Add (sums, subcategories, remembered descriptions, accounts, household, fixed, spread, gross, payday). 17 languages: the web's files + app-only overlay assets/i18n/app/<lang>.json; tools/check-i18n.py lists untranslated t("…"). 34 unit tests (web numbers). Checked on the Pixel 9 emulator (slow on the 2018 Intel Mac: ~10× a phone; use a release build signed with the debug key for realistic speed). Debug extras: --es section <name>, --es close 1 --ei closeStep n, --es importPayslip <file in files/>. Not yet on Android: onboarding (web draft), Value per holding chart, motion settings, receipt scan.
27. ENCRYPTED SYNC between web, iPhone/Mac and Android (Bart's choice 2026-10-27: end-to-end encrypted, not plain tables). One vault per account (encrypted_vaults, migration 0009): the whole FinanceData sealed with the passphrase (PBKDF2-SHA256 600k → AES-256-GCM, byte-compatible on all three: web vault.ts, Android data/Vault.kt, iOS VaultCrypto — each opens a copy sealed by the web, tested). Sync = fetch → open → merge (lib/finance/vaultMerge.ts; Android data/VaultMerge.kt, iOS VaultMerge — same tests: newest updated_at per row wins, deletions remembered as {collection,id,deleted_at} or rows with deleted_at, newest profile.updated_at wins, other keys from local) → keep → seal → put back; the apps' put is conditional on the vault's updated_at (another device uploaded meanwhile → merge again). Web: local mode now records deletions + profile.updated_at in update() (trackChanges); uploading the encrypted copy merges with the copy that's there first (needs the same passphrase). Android: rows soft-deleted in its own file; Settings › Encrypted sync (password or email code; passphrase optionally remembered in the Android Keystore); syncs at start. iOS: SwiftData ⇄ FinanceData JSON (VaultExport, round-trip tested), changes found against the last synced snapshot (Application Support/vault-snapshot.json) so no edit code changed; Settings › Encrypted sync; tokens + remembered passphrase in the Keychain; syncs at launch; CloudKit stays for Apple devices. Config: Android local.properties supabase.url/supabase.key, iOS Personal Finance/Supabase.json — both git-ignored, copy from .env.local on a new computer. Documents: only the figures travel (files stay on the device they were added on). NOT YET TESTED end to end: needs Bart signed in on a device with his passphrase (Claude never types either).
    Android (2026-10-27): domain ports AmountExpression, BudgetPlan, DayRings, Salary, Payslip + tests (17/17). The app itself is still the skeleton (dashboard + rent vs buy, demo data, no storage): screens wait for the decision how Android stores data (blueprint phase 1: Supabase sign-in + sync).

Open questions for Bart:
- Dashboard balance card default: Compact or Full?
- Earlier years: monthly totals enough, or import transactions?
- Month close: start automatically on the 1st, or only on demand?
- Android: PWA first? minimum Android version? on-device receipt scanning?

Before going live with the web app: hide the Apple sign-in button until it's
configured, set the Supabase Site URL, merge `web-app` into `main` (with
Bart's OK). Still to do on iOS: replace CloudKit with Supabase sync, align
the dashboard net worth ticker with the net worth model, app icon.

## Done 2026-11-05 (later) — Bart's iPad / investments feedback

- Investments page: switching the period of the bottom chart (Value per
  holding) no longer jumps the page to the top — the chart keeps the last
  loaded period while the new prices load instead of disappearing (page
  `shown`, PortfolioMix `picked`).
- Background lines (NeonLines): slower (clock 0.4×) and the speeds close
  together (0.04–0.058) — one line raced ahead of the others and stuttered.
- Passphrase on the iPad (live site asked for it after every tab switch:
  Safari drops background tabs, and the key lived in the tab's memory):
  "Remember on this device" on the unlock card (on by default) keeps the
  derived keys in IndexedDB as NON-extractable CryptoKeys
  (lib/finance/vaultKeys.ts; never the passphrase) for 30 days; forgotten on
  Lock now, sign-out, removing the passphrase, or a changed passphrase.
  vault.ts: `unlock()` now seals under the salt of the copy it opened (all
  web devices converge on one salt, so a remembered key keeps opening other
  devices' saves), `keys()`, `fromKeys()` (+ tests). A remembered copy
  doesn't auto-lock. NOT LIVE until `main` is updated (Bart's OK) and NOT
  tested signed in (needs Bart's passphrase). Note: the web-app build also
  lets Bart drop the passphrase entirely (Settings › Extra protection) —
  but iOS/Android can't read plain copies yet.
- Onboarding investments are LIVE now: search a share, fund or coin by name
  or ticker (new /api/search — Yahoo search, server side, only the typed
  text goes out; crypto as the coin, metals as XAU/XAG/XPT/XPD), pick it,
  enter how many → value = live price × quantity (ticking, day change,
  "Live"), optional "Paid in total" (else cost = value now). Not listed →
  "Add … by hand" (old way, at cost). Saved as real holdings with symbol +
  quantity. components/finance/InvestmentSearch.tsx. Enter/Escape in the
  search no longer move/close the onboarding. 16 new texts in 17 languages.
  Still no "add holding" on the Investments page itself — could reuse this.

## Done 2026-11-05 (evening) — onboarding round 2 (Bart's review)

- Fixed costs, insurance and budgets: "+ Add …" adds an own line (name +
  amount); saved as a category / policy (kind other) / budget by that name.
- Loans: no more tap-to-cycle (it jumped to "Car"); a new loan starts as
  Other loan with kind chips (student, car, personal, credit card, other)
  under it, and Other gets its own name.
- Savings goal: the four squares (misaligned) are now a brand slider —
  3, 6, 9 months … 5 years — with "within 1 year · by November 2027".
- Check-in: twice a week / weekly ask WHICH days (components/finance/
  WeekdayPicker.tsx; also in Settings › Check-in). Profile.checkin_days
  (0 = Sunday; account copy / local only, stripped for the legacy Supabase
  profile). checkin.ts `periodOf(d, interval, days)` / `startDays`: a period
  starts on a chosen weekday and runs to the day before the next one
  (defaults Mon + Thu / Mon, as before) + test.
- Background trail (OnboardingTrail.tsx): a still winding line behind the
  onboarding with a dot per chapter (per step on the quick route); finished
  ones glow green, the part of the line up to them lights up, and a chapter
  finished now flashes once. Cards are near-opaque so it stays behind them.
- Onboarding investments: "Paid (optional)" as Total or Per share / Per
  coin / Per ounce (× how many = cost basis, in the profile currency), and
  the result vs paid (€ and %) under "Worth now" (InvestmentSearch
  `paidEach`, `paidTotal`).
- NOT translated (see the to-do at the top).

## Done 2026-11-05 (night) — the finale tour + a live month while you set up

- Onboarding preview panel ("Your month"): the day + time (ticking), "Day n
  of N" with a month bar, and — once the income is in — Earned / Spent /
  Saved so far this month counting live (income and fixed costs + budgets
  spread over every second of the month); Equity ticks on at what's left
  to save per second from the moment the setup opened.
- Finale (OnboardingReveal) is now a guided tour of up to 13 story cards,
  each building itself up: intro (what's live) → balance sheet post by post
  with equity → live income (earned so far, € per second, month bar) →
  fixed costs booking themselves (used up so far, live) → budget bars
  filling, one spilling over → left to save + the goal's share → investments
  live (Live badge, today's change, holdings) → adding a transaction (paid
  with current account / credit card, spread out, advance) → check-in
  (three ticks, +15 points, streak flame, rings; the chosen rhythm) → how a
  month goes (1st, every day, payday, close + Wrapped) → my idea: RUNWAY
  (months the accounts would cover fixed costs + budgets) → debt-free month
  → open the dashboard. Back / n of N / Skip the tour under the card.
- Ideas for later: a "money per second" tile on the dashboard (net saving
  rate ticking), runway on the Liquidity page, the tour reachable from
  Settings ("Show me around again").

## Done 2026-11-05 (night) — Add investment panel

- On /app/investments the + (QuickAdd FAB) no longer opens Quick Add: it
  sends "pf-add-holding" and opens AddHolding (components/finance/
  AddHolding.tsx) in a large panel (Sheet `wide`, .pf-ah*). Left: search
  (/api/search) or tap a popular one (BTC, ETH, gold, silver, VWRL, IWDA,
  ASML, Apple, Nvidia, Microsoft); after picking: logo, live price + today,
  a chart with period switch; "How much do you have?" as Shares/Coins/Ounces
  or an Amount in € (→ quantity at today's price); "What did you pay?" as
  Total or Per share/coin/ounce (empty = today's value); "Bought on" (date
  → date_added). Not listed → by hand (name, kind, worth today, since).
  Right, live: worth now (ticking), paid, result € and %, how many, share of
  the portfolio with a bar; "Add to my investments".
- Holding actions (components/finance/HoldingTrade.tsx, same large panel;
  opened from the holding's detail sheet — Buy more · Sell · Edit · Delete
  — via "pf-holding-action"): BUY MORE adds shares (or an amount → shares at
  today's price) and what was paid (total or per share; empty = today's
  price) → average price follows; an earlier purchase date moves the start.
  SELL takes shares off ("All of it"), removes the matching part of what was
  put in, shows the result on this sale; selling everything deletes it.
  EDIT: name, shares, paid in total (with average), since. DELETE asks
  "Sure?" first. Side panel: before → after (shares, put in, average price,
  worth now). Provider: updateHolding / deleteHolding (soft delete).
  A cost kept in another currency (e.g. dollars) is converted at today's
  rate and saved in the profile currency on any change.
- Not yet: the sale's money booked onto an account; a list of past trades.
  Texts not translated (to do).

## Done 2026-11-05 (late) — more metrics in the tour

- Budget card: the over-budget spill no longer runs out of the card (rows
  at 84% so 20% over fits).
- New tour cards (OnboardingReveal `keyFigures`, `freedom`): YOUR NUMBERS —
  savings rate (20%+ strong), fixed costs of income (under 50%), what an hour
  of work brings in (net ÷ 173 h; "a €40 dinner costs 1 h 48 min of work"),
  free to spend per day (budgets ÷ 30.4), equity in months of living,
  mortgage of home value (LTV) — each with a rule of thumb and a colour.
  FINANCIAL FREEDOM — the freedom number (25 × a year's fixed costs +
  budgets, the 4% rule), % already there (accounts + investments), years to
  get there saving what's left at 5% a year.
- Bart loves these metrics: put them on the dashboard / Liquidity page too
  (runway, savings rate, freedom number, hours of work) — next.

## Done 2026-11-05 (late) — ready for testers

- Onboarding is REAL now when signed in (/app/welcome saves; the demo stays
  a preview). OnboardingGate (in the app layout) sends a brand-new account
  there by itself: vault/supabase source, no profile.onboarding, no
  transactions, no account balances. Closing it halfway leaves this tab on
  the app (sessionStorage pf-onboarding-skipped); it asks again next visit.
- Invite codes: NEXT_PUBLIC_PF_SIGNUPS=invite shows "Create account" with
  an Invite code field (sent as user metadata `invite`); a link
  …/app?invite=CODE opens on Create account with the code filled in.
  Migration 0013_testers.sql: table invite_codes (code, note, max_uses,
  uses; no policies = invisible to users) + function
  public.hook_check_invite (Supabase Auth hook "Before user created":
  refuses unknown / used-up codes with 403, counts uses). "open" still
  works without a code.
- Feedback: a "Feedback" pill beside the + (signed in only) → sheet: kind
  (broken / idea / love / other), message → table feedback (0013; RLS:
  insert/read own; page, screen size, browser, language saved with it).
- Privacy page for testers: /privacy/web-app (what's stored, Supabase EU,
  who can read it with / without passphrase, prices via Yahoo, no tracking,
  removal on request), linked from the sign-in card. NOTE: the main
  /privacy page still says "no accounts, nothing leaves your device" —
  out of date now that the apps sync; rewrite before the App Store update.
- DB tests: 59 pass (8 new for invites + feedback).
- BART TO DO before inviting: run 0013 (and check 0012) in Supabase, switch
  on the hook, Site URL + redirect URLs, custom SMTP, add invite codes,
  Vercel env NEXT_PUBLIC_PF_SIGNUPS=invite, then OK to push web-app → main.

## LIVE 2026-11-05 — open for testers

- Supabase (done with Bart, step by step): migrations 0012 + 0013 run;
  Auth Hook "Before User Created" → public.hook_check_invite ENABLED;
  URL Configuration already right (Site URL yourfinanceacademy.com, redirects
  incl. www, localhost:3000, *-beekwilder.vercel.app); custom SMTP via Resend
  already on (noreply@yourfinanceacademy.com), 30 emails/h; invite code
  VRIENDEN-2026 (max 20 uses, note "eerste testers").
- Vercel: NEXT_PUBLIC_PF_SIGNUPS=invite (Production, Config).
- `main` pushed (Bart's OK): c396e95 (everything of 4–5 Nov), then 2782f36
  removes the site-wide "Enter the vault" preview lock (Bart: remove
  entirely; components/LockGate.tsx kept, unused). Website is public.
- Checked live: https://yourfinanceacademy.com/app?invite=VRIENDEN-2026 opens
  on Create account with the code filled in.
- Tester invite link: …/app?invite=VRIENDEN-2026. More codes: SQL insert into
  public.invite_codes (code, note, max_uses). Feedback: Table Editor ›
  feedback. Not yet tried end to end: a real tester sign-up (code email,
  hook, onboarding saving) — first tester = first real test.

## 2026-11-05 (evening) — incident: the setup saved over Bart's books

- Bart ran /app/welcome on the live site while signed in; since "ready for
  testers" it saved for real and added 42 items (accounts, categories,
  budgets, fixed costs, home/mortgage posts, a holding, insurances, a goal)
  and overwrote his current account (name/balance) and profile settings.
- Fixed: /app/welcome only saves for a new account (no transactions, no
  account balances) or one that began the setup (profile.onboarding);
  otherwise it's a preview. On web-app — LIVE only after the next push.
- Undone on localhost with a dev-only tool (Settings › "Undo the setup",
  components/finance/SetupUndo.tsx; provider `rewrite`): rows changed in the
  picked minutes removed (as tracked deletions), rows already in the local
  backup (.private/finance.json, 3 Nov) put back, profile fields from the
  backup, setup marker removed. Bart confirmed: data back. Values put back
  are from 3 Nov (current account balance / income / payday — Bart to check).
- Lesson: the account copy has no history (Supabase Free has no backups);
  consider keeping the previous copy (e.g. a second row / version) before
  big writes.

## Done 2026-11-05 (evening) — tour polish + Key figures

- Tour: subtle round arrows left/right on the card; the card you leave
  pops away over the next (back: slides away). Balance card is a real
  T-account (Assets | Liabilities + Equity, equal totals, "In balance",
  why it's unique); negative equity: "turns positive in N months" at
  what's left to save. Budget bars: the budget is a tick at 80% of the
  track, overspend red inside the bar (nothing sticks out).
- lib/finance/metrics.ts (+ metrics.test.mjs): keyMetrics (savings rate,
  runway, fixed costs of income, an hour of work, free to spend per day,
  equity in months of living, debt ratio — each with a rule of thumb and a
  tone), freedom (25× yearly spending, share there, years at 5%),
  monthsToPositive. components/finance/useKeyFigures.ts feeds it from the
  books (expected month = Budgets' rule, accounts + investments at market,
  balance sheet).
- Page /app/figures "Key figures" (menu after Balance sheet): freedom ring
  + number + year reached, "Saved this month so far" ticking per second,
  negative equity counter, a card per figure. Dashboard: Key figures strip
  at the bottom (freedom %, savings rate, runway, free per day, debt ratio)
  → "All key figures". Not translated yet.
- The tour still has its own copy of the figures (OnboardingReveal
  keyFigures) — could switch to metrics.ts.

## Done 2026-11-05 (late evening, on the Mac) — onboarding round 3, key figures, polish

LIVE: `main` = 842b0ed (Bart's OK, 5 Nov late evening; Vercel success). Since then also: big welcome, points for finishing the setup (setup-quick 100 / setup-complete 250) + the dashboard celebration (SetupCelebration), runway goal setting (profile.runway_goal), mortgage on the debt-free card.
- Month compare (Expenses): bars glide to the new month, rows slide to their
  new rank (useFlip) instead of rebuilding. Sidebar scrolls when tabs don't fit.
- Key figures: runway and freedom used the 1 January balances (Bart saw
  −2,2 months) → now today's balances (balance + accountFlows; runway without
  investment accounts). Hero tiles got padding. Freedom sentence in plain words.
- Onboarding (complete route):
  - Fixed costs: Rent and Mortgage apart; Energy & water and Internet & phone
    open into their bills (subcategories; mobile per person when together);
    bills can be LINKED into one ("Electricity + Gas") and have a PERIOD
    (monthly / quarterly / twice a year / yearly → counted per month); a
    BOOKING DAY per fixed cost, bill and subscription (books on that day,
    later changed via the transaction's date).
  - New Subscriptions screen (Netflix, Spotify, … own lines), each a fixed
    cost under Subscriptions. Insurance premiums also book as fixed costs
    (category Insurance). Neither is asked twice any more.
  - Home step: optional Mortgage details (parts: annuity / linear /
    interest-only, rate, years to go, extra) → this month's interest vs
    repayment, mortgage-free month, interest to go; saved to Real estate
    (property + mortgage parts) and it drives the Mortgage fixed cost.
  - The card's height glides with its content (ResizeObserver) — Bart's rule:
    containers never jump. Preview amounts never wrap; panel 320 px.
  - "Jouw maand" flow bar: calm pills (subscriptions / insurance / budgets one
    each, < 4% → rest), names on hover. Spent so far in red.
  - Preview only: "Test: fill" / "Test: clear" (made-up answers → last step).
- Tour (OnboardingReveal): carousel slide + swipe instead of the pop; ONE
  height for all cards (tallest measured once), scaled as a whole (CSS zoom)
  to fit the window; intro glance (equity live, four numbers, pills jump to
  their card); Live income month chart (income vs spending, now → month end);
  runway as accounts emptying month by month + the sum + what it takes to six
  months; debt-free as loans going down year by year; final card with what's
  set up and what's coming (check-in, payday, month close); calendar leaf for
  the booking day; free-per-day shows its sum.
- To port to iOS / Android: all of the above (onboarding model: Line.split,
  Part.linked/every/day, subscriptions step, mortgage details; key figures fix).

## LIVE 2026-11-06
- `main` pushed (Bart's OK) at 573be3f: phone tab bar (4 tabs + More),
  `/app?demo=1`, demo data in the visitor's language (Rent = noun, Renting
  on rent-vs-buy), no dev badge, Wrapped equity line, phone budgets
  (amounts under the bar). Vercel: success.
- Product site (A+B concept) still local only:
  `scrollcraft/builds/personal-finance-v2/site/concepts/ab.html`.
- System map updated: https://claude.ai/artifact/M57781RSTL8h4RzksrgGd4
  (Apple Note "Personal Finance — datastructuur" mirrors it).
