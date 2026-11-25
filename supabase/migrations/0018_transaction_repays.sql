-- Repayment of a debt (Bart, 25 Nov): an expense can pay off a loan or a
-- mortgage part — the id of that debt. Only for the old per-table storage;
-- the vault keeps it in its JSON.
alter table public.transactions
  add column if not exists repays uuid;
