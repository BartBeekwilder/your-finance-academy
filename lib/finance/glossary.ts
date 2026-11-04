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
  { id: "rings", term: "Progress rings", text: "Three rings for the month, like a watch's activity rings: Tracking (pink), Budget (green) and Saving (purple). A ring closes when you reach its goal; past it, it starts a second lap. The calendar shows them day by day." },
  { id: "ring-tracking", term: "Tracking ring", text: "The share of this month's days you kept your books up. A day counts when you open the app, or when a check-in covers it: a check-in counts every day back to the one before." },
  { id: "ring-budget", term: "Budget ring", text: "A month goal for all your budgets together: the ring is full while the spending expected by month end fits your total budget. Expected = what you've spent so far plus what you usually spend in the rest of the month (your average of the three months before), with fixed costs for the whole month. One category over is fine if another makes up for it. Over the total, the ring shrinks: 10% over → about 90%. In the calendar, a day's green ring shows whether that day's forecast was still within the total budget." },
  { id: "ring-saving", term: "Saving ring", text: "Whether you're on course to save 20% of your income this month: the month-end forecast (expected income minus expected spending) as a share of expected income. It closes at 20%. In the calendar, each day shows what was saved up to then, with salary and fixed costs spread over the month." },
  { id: "checkin", term: "Check-in", text: "Confirming your books are up to date: all expenses and income entered, and your account balances match the bank. Once per period (Settings › Check-in), for 15 bonus points; it also counts the days since your previous check-in as kept up." },
  { id: "correction", term: "Correction", text: "The difference between your account balances and your bookings. If it shows up, something doesn't add up yet." },
];

export const termById = (id: string) => GLOSSARY.find((g) => g.id === id);
