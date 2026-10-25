-- Spread an expense over a period ("afschrijven"): a laptop of €2,000 used
-- for 4 years costs €41.67 a month for 48 months in spending, budgets and
-- charts, while the money left the account on the purchase date. The apps
-- split it into monthly parts and show the not-yet-used part on the balance
-- sheet as an asset (book value). Empty = an ordinary one-off expense.
alter table public.transactions
  add column spread_months integer check (spread_months is null or spread_months between 2 and 120);
