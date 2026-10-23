-- Insurance: every policy you hold, so the app can show what you pay per
-- month and year, what you're covered for, what you'd pay yourself
-- (deductible), when each one renews or can be cancelled, and what might
-- be missing for your situation. Totals and checks are calculated by the
-- apps (lib/finance/insurance.ts); nothing derived is stored.
--
--   insurance_policies — kind (health, home, contents, liability, car,
--                        travel, life, disability, legal, pet, other),
--                        insurer, premium + period (month / quarter / year),
--                        deductible, coverage, start, renewal date and the
--                        notice period in months, notes.
-- Same sync rules as every table: client UUIDs, updated_at by trigger, soft
-- deletes, numeric(19,4) money, row-level security per user.

create table public.insurance_policies (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  kind            text not null default 'other' check (kind in ('health', 'home', 'contents', 'liability', 'car', 'travel', 'life', 'disability', 'legal', 'pet', 'other')),
  name            text not null default '',
  insurer         text not null default '',
  premium         numeric(19,4) not null default 0 check (premium >= 0),
  period          text not null default 'month' check (period in ('month', 'quarter', 'year')),
  deductible      numeric(19,4) not null default 0 check (deductible >= 0),
  coverage        numeric(19,4),
  start_date      date,
  renewal_date    date,
  notice_months   integer not null default 1 check (notice_months between 0 and 24),
  notes           text not null default '',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index on public.insurance_policies (user_id, updated_at);

create trigger touch_insurance_policies before update on public.insurance_policies
  for each row execute function public.touch_updated_at();

alter table public.insurance_policies enable row level security;
create policy "own rows" on public.insurance_policies
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
