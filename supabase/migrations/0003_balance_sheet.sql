-- Balance sheet (Balans): the user's own assets and liabilities that the app
-- can't derive from transactions — a home, a mortgage, loans, an outside
-- savings account. Accounts, holdings, prepaid costs and income still to be
-- received are calculated by the apps and are not stored here.
--
--   balance_items  — one row per post: which side, its current value
--                    ("huidige stand"), its place in the list.
--   balance_values — the value a post had at the end of a month ("laatste
--                    stand per maand"). Editing the current value also writes
--                    the current month's row; a month without a row carries
--                    the latest earlier one forward.
-- Same sync rules as every table: client UUIDs, updated_at by trigger, soft
-- deletes, numeric(19,4), row-level security per user.

create table public.balance_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null default '',
  side          text not null default 'asset' check (side in ('asset', 'liability')),
  current_value numeric(19,4) not null default 0,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table public.balance_values (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  item_id    uuid not null,
  month      date not null check (extract(day from month) = 1),
  value      numeric(19,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- A value always belongs to an item of the same user; one row per item/month.
alter table public.balance_items add unique (user_id, id);
alter table public.balance_values
  add foreign key (user_id, item_id) references public.balance_items (user_id, id) on delete cascade;
create unique index balance_values_item_month on public.balance_values (item_id, month) where deleted_at is null;

create index on public.balance_items  (user_id, updated_at);
create index on public.balance_values (user_id, updated_at);

create trigger touch_balance_items before update on public.balance_items
  for each row execute function public.touch_updated_at();
create trigger touch_balance_values before update on public.balance_values
  for each row execute function public.touch_updated_at();

alter table public.balance_items  enable row level security;
alter table public.balance_values enable row level security;
create policy "own rows" on public.balance_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.balance_values
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
