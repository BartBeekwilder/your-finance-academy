// The app's terms in plain words — the Glossary page lists them, and the
// small ⓘ next to a term opens its line. English is the key (lib/i18n).

export type Term = { id: string; term: string; text: string };

export const GLOSSARY: Term[] = [
  { id: "liquidity", term: "Liquidity", text: "All the money you can spend: your accounts plus your investments at today's prices — without your home and your loans." },
  { id: "equity", term: "Equity", text: "Everything you own minus everything you owe. What is truly yours." },
  { id: "assets", term: "Assets", text: "Everything you own: your home, accounts, investments and costs you've already paid ahead." },
  { id: "liabilities", term: "Liabilities", text: "How your assets are paid for: your debts (mortgage, loans) plus your equity. Both sides of the balance sheet are always equal." },
  { id: "pending", term: "Amounts to receive", text: "Income you've entered that hasn't landed on an account yet, like a salary on its way. Pick “Received on” when it arrives." },
  { id: "receivable", term: "Receivable", text: "Income you've earned so far this month but haven't received yet. The app spreads your monthly income over the days." },
  { id: "advance", term: "Income received in advance", text: "Income that came in before you earned it: a salary paid on the 24th also covers the last days of the month. It shrinks to zero by month end." },
  { id: "prepaid", term: "Prepaid", text: "Fixed costs you've paid for the rest of the month, like rent or insurance. They're used up day by day." },
  { id: "spread", term: "Spread purchases", text: "A big purchase counted monthly over the time you use it. The part not used up yet stays an asset (its book value)." },
  { id: "nominal", term: "Nominal", text: "What you put in: the price you paid for an investment." },
  { id: "real", term: "Real value", text: "What it's worth now, at live market prices." },
  { id: "result", term: "Result", text: "Real value minus nominal: what you've gained or lost." },
  { id: "gross", term: "Gross and net", text: "Gross is your pay before tax and premiums; net is what lands in your account. The difference is the deductions." },
  { id: "fixed", term: "Fixed and variable costs", text: "Fixed costs are the same every month (rent, subscriptions); variable costs are the rest (groceries, going out)." },
  { id: "saved", term: "Saved this year", text: "This year's income minus this year's spending." },
  { id: "forecast", term: "Forecast", text: "An estimate for the rest of the period, based on your average so far. Shown dashed." },
  { id: "yeartotal", term: "Year total", text: "Imported history: a year's total, spread evenly over the months that have no transactions." },
  { id: "pace", term: "Pace for today", text: "The little dashed line in a budget bar: how much of the budget you could have spent by today if you spread it evenly over the month — about 13% on the 4th, half on the 15th. Orange: you've spent more than that so far. Not a problem by itself — a quieter few days bring you back on pace. Fixed costs don't get one: they're paid at once." },
  { id: "rings", term: "Progress rings", text: "Three rings for the month, like a watch's activity rings: Tracking (pink), Budget (green) and Saving (purple). A ring closes when you reach its goal; past it, it starts a second lap. The calendar shows them day by day." },
  { id: "ring-tracking", term: "Tracking ring", text: "The days of this month your books were kept up, out of all its days — it fills day by day and closes on the last day if you keep up every day. A day counts when a check-in covers it (“Bring your books up to date”): a check-in counts every day back to the one before. Just opening the app earns points, but doesn't fill the ring." },
  { id: "ring-budget", term: "Budget ring", text: "A month goal for all your budgets together: on schedule — the spending expected by month end fits your total budget — the ring fills a little every day and closes on the last day of the month. Expected = what you've spent so far plus what you usually spend in the rest of the month (your average of the three months before), with fixed costs for the whole month. One category over is fine if another makes up for it. Behind schedule it grows slower: 10% over → about 90% of the pace. In the calendar, a day's green ring is full when that day you were still on course on average — one big day is fine." },
  { id: "ring-saving", term: "Saving ring", text: "Saving 20% of your income this month, as a month goal: on course — the month-end forecast (expected income minus expected spending) reaches 20% of expected income — the ring fills a little every day and closes on the last day. Saving more fills it faster, up to a second lap; less, slower. In the calendar, each day shows what was saved up to then, with salary and fixed costs spread over the month." },
  { id: "checkin", term: "Check-in", text: "Confirming your books are up to date: all expenses and income entered, and your account balances match the bank. Once per period (Settings › Check-in), for 15 bonus points; it also counts the days since your previous check-in as kept up." },
  { id: "correction", term: "Correction", text: "The difference between your account balances and your bookings. If it shows up, something doesn't add up yet." },
];

export const termById = (id: string) => GLOSSARY.find((g) => g.id === id);
