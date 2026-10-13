-- Personal Finance — shared schema for iOS, Android and web.
--
-- Mirrors the iOS SwiftData models (Models/*.swift) one table per model.
-- Sync rules every client follows:
--   * ids are client-generated UUIDs (the iOS models already have `id: UUID`),
--     so a row created offline keeps its id when it reaches the server.
--   * `updated_at` is bumped by trigger on every write; clients pull rows
--     with updated_at > their last sync time.
--   * deletes are soft (`deleted_at` set), so other devices learn about them
--     on their next pull. A periodic job can hard-delete old tombstones.
--   * money is numeric(19,4), never float — matches Swift's Decimal.
-- Row-level security limits every table to the signed-in user's own rows.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profile: per-user settings that live in UserDefaults on iOS today
-- (CurrencySettings, IncomeSettings, AppearanceSettings).
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id               uuid primary key references auth.users on delete cascade,
  display_name          text,
  currency_code         text not null default 'EUR',
  appearance_mode       text not null default 'dark'
                        check (appearance_mode in ('system', 'light', 'dark')),
  expected_gross_monthly numeric(19,4),
  expected_net_monthly   numeric(19,4),
  payday_day            smallint check (payday_day between 1 and 31),
  income_reminders      boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Create the profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Subscriptions: one row per user, written ONLY by the server (RevenueCat
-- webhook using the service-role key). Clients may read, never write — so
-- nobody can grant themselves Premium from a browser console.
-- ---------------------------------------------------------------------------

create table public.entitlements (
  user_id      uuid primary key references auth.users on delete cascade,
  is_premium   boolean not null default false,
  store        text check (store in ('app_store', 'play_store', 'stripe', 'promotional')),
  product_id   text,
  expires_at   timestamptz,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Finance data (mirrors Account, Category, Budget, Transaction,
-- IncomeRecord, Holding)
-- ---------------------------------------------------------------------------

create table public.accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null default '',
  type         text not null default 'checking'
               check (type in ('checking', 'savings', 'credit', 'cash', 'investment')),
  balance      numeric(19,4) not null default 0,
  institution  text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table public.categories (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users on delete cascade,
  name               text not null default '',
  icon               text not null default 'questionmark.circle.fill', -- SF Symbol name
  color_hex          text not null default '808080',
  is_default         boolean not null default false,
  is_income_category boolean not null default false,
  is_fixed_expense   boolean not null default false,
  sort_order         integer not null default 0,
  parent_id          uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  category_id  uuid,
  amount       numeric(19,4) not null default 0,
  month        date not null default date_trunc('month', now())::date, -- always the 1st
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  amount           numeric(19,4) not null default 0 check (amount >= 0), -- sign comes from type
  type             text not null default 'expense' check (type in ('expense', 'income')),
  date             timestamptz not null default now(),
  note             text,
  is_auto_income   boolean not null default false,
  is_fixed_expense boolean not null default false,
  recurrence_id    uuid,
  category_id      uuid,
  account_id       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create table public.income_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  month           date not null default date_trunc('month', now())::date,
  gross_amount    numeric(19,4) not null default 0,
  net_amount      numeric(19,4) not null default 0,
  is_actual       boolean not null default false,
  confirmed_date  timestamptz,
  transaction_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table public.holdings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users on delete cascade,
  symbol              text not null default '',
  name                text not null default '',
  asset_type          text not null default 'crypto' check (asset_type in ('crypto', 'stock', 'metal')),
  quantity            numeric(28,10) not null default 0, -- crypto needs more decimals
  cost_basis          numeric(19,4),
  cost_basis_currency text,
  date_added          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- ---------------------------------------------------------------------------
-- Links between rows. Each foreign key includes user_id, so a row can only
-- point at another row owned by the SAME user — plain FKs bypass row-level
-- security, which would let someone attach their data to a stranger's id.
-- SET NULL (col) clears just the link column, never user_id.
-- ---------------------------------------------------------------------------

alter table public.accounts     add unique (user_id, id);
alter table public.categories   add unique (user_id, id);
alter table public.transactions add unique (user_id, id);

alter table public.categories
  add foreign key (user_id, parent_id) references public.categories (user_id, id)
  on delete set null (parent_id);
alter table public.budgets
  add foreign key (user_id, category_id) references public.categories (user_id, id)
  on delete cascade;
alter table public.transactions
  add foreign key (user_id, category_id) references public.categories (user_id, id)
  on delete set null (category_id);
alter table public.transactions
  add foreign key (user_id, account_id) references public.accounts (user_id, id)
  on delete set null (account_id);
alter table public.income_records
  add foreign key (user_id, transaction_id) references public.transactions (user_id, id)
  on delete set null (transaction_id);

-- ---------------------------------------------------------------------------
-- Indexes for the sync pull (user + updated_at) and common lookups
-- ---------------------------------------------------------------------------

create index on public.accounts       (user_id, updated_at);
create index on public.categories     (user_id, updated_at);
create index on public.budgets        (user_id, updated_at);
create index on public.transactions   (user_id, updated_at);
create index on public.transactions   (user_id, date);
create index on public.income_records (user_id, updated_at);
create index on public.holdings       (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles', 'entitlements', 'accounts', 'categories',
                           'budgets', 'transactions', 'income_records', 'holdings']
  loop
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security: each user sees and edits only their own rows
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.entitlements   enable row level security;
alter table public.accounts       enable row level security;
alter table public.categories     enable row level security;
alter table public.budgets        enable row level security;
alter table public.transactions   enable row level security;
alter table public.income_records enable row level security;
alter table public.holdings       enable row level security;

create policy "own profile" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read own entitlement" on public.entitlements
  for select using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'budgets', 'transactions',
                           'income_records', 'holdings']
  loop
    execute format(
      'create policy "own rows" on public.%1$s
         for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
