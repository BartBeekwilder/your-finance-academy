-- Advances: when one is expected back (the dashboard reminds from three days
-- before). Only for the old per-table storage; the vault keeps it in its JSON.
alter table public.transactions
  add column if not exists expected_back timestamptz;
