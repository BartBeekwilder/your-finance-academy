-- Real estate: a home (or other property) and the mortgage parts on it.
-- The schedule (interest, repayment, remaining debt per month), totals,
-- ownership share and tax effects are calculated by the apps from these
-- inputs (lib/finance/mortgage.ts); nothing derived is stored.
--
--   properties     — value, purchase, country rules ('INTL' or 'NL').
--   mortgage_parts — one row per loan part ("leningdeel"): kind annuity /
--                    linear / interest_only, principal, annual rate %, fixed-
--                    rate end, start date, term in months, NHG, and a planned
--                    extra monthly repayment.
-- Same sync rules as every table: client UUIDs, updated_at by trigger, soft
-- deletes, numeric(19,4) money, row-level security per user.

create table public.properties (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  name           text not null default '',
  value          numeric(19,4) not null default 0,
  value_date     date,
  purchase_price numeric(19,4),
  purchase_date  date,
  country        text not null default 'INTL' check (country in ('INTL', 'NL')),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table public.mortgage_parts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  property_id    uuid not null,
  name           text not null default '',
  kind           text not null default 'annuity' check (kind in ('annuity', 'linear', 'interest_only')),
  principal      numeric(19,4) not null default 0 check (principal >= 0),
  rate           numeric(7,4) not null default 0 check (rate >= 0 and rate < 100),
  fixed_until    date,
  start_date     date not null default current_date,
  term_months    integer not null default 360 check (term_months between 1 and 600),
  nhg            boolean not null default false,
  extra_monthly  numeric(19,4) not null default 0 check (extra_monthly >= 0),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- A part always belongs to a property of the same user.
alter table public.properties add unique (user_id, id);
alter table public.mortgage_parts
  add foreign key (user_id, property_id) references public.properties (user_id, id) on delete cascade;

create index on public.properties     (user_id, updated_at);
create index on public.mortgage_parts (user_id, updated_at);

create trigger touch_properties before update on public.properties
  for each row execute function public.touch_updated_at();
create trigger touch_mortgage_parts before update on public.mortgage_parts
  for each row execute function public.touch_updated_at();

alter table public.properties     enable row level security;
alter table public.mortgage_parts enable row level security;
create policy "own rows" on public.properties
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.mortgage_parts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
