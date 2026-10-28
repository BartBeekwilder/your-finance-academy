-- Advances ("voorgeschoten"): an expense paid on someone else's behalf that
-- will be paid back. Not spending — the apps leave it out of every total and
-- show it on the balance sheet under Amounts to receive until it's back
-- (repaid_at; the money returns to the same account).
alter table public.transactions
  add column advance boolean not null default false,
  add column repaid_at timestamptz;
