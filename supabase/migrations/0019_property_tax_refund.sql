-- A home's own monthly tax refund on the mortgage interest (NL: voorlopige
-- teruggaaf). Only for the old per-table storage; the vault keeps it in JSON.
alter table public.properties
  add column if not exists tax_refund_monthly numeric(12, 2);
