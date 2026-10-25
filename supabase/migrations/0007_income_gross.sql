-- Gross income: an income transaction's amount is what you received (net);
-- gross_amount is what it was before tax and deductions (optional — empty
-- means gross = net, e.g. a gift or untaxed freelance payment). The Income
-- page draws gross and net per month; the difference is the deductions.
alter table public.transactions
  add column gross_amount numeric(19,4) check (gross_amount is null or gross_amount >= 0);
