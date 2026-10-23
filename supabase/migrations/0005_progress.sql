-- Progress: closing months, personal goals, badges and daily activity — the
-- "fitness rings" of your finances. Points and levels are calculated from
-- these rows (lib/finance/achievements.ts); only the facts are stored.
--
--   month_closes  — one row per closed month: when, and a snapshot of the
--                   month (income, spent, saved, equity…) so the review
--                   stays as it was even if transactions change later.
--   goals         — save an amount, pay off a debt, reach an equity level,
--                   or keep a category under a limit; optional deadline.
--   achievements  — badges earned (a code from the app's catalogue).
--   activity_days — the days the app was used to update the books (streaks).
-- Same rules as every table: client UUIDs, updated_at by trigger, soft
-- deletes, row-level security per user. Private to the user for now;
-- sharing comes later.

create table public.month_closes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  month      date not null check (extract(day from month) = 1),
  closed_at  timestamptz not null default now(),
  summary    jsonb not null default '{}'::jsonb,
  points     integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index month_closes_user_month on public.month_closes (user_id, month) where deleted_at is null;

create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  kind         text not null default 'save' check (kind in ('save', 'debt', 'equity', 'category_limit')),
  name         text not null default '',
  target       numeric(19,4) not null default 0,
  start_value  numeric(19,4) not null default 0,
  target_date  date,
  category_id  uuid,
  achieved_at  timestamptz,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table public.achievements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  code       text not null,
  earned_at  timestamptz not null default now(),
  points     integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index achievements_user_code on public.achievements (user_id, code) where deleted_at is null;

create table public.activity_days (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index activity_days_user_day on public.activity_days (user_id, day) where deleted_at is null;

create index on public.month_closes  (user_id, updated_at);
create index on public.goals         (user_id, updated_at);
create index on public.achievements  (user_id, updated_at);
create index on public.activity_days (user_id, updated_at);

create trigger touch_month_closes  before update on public.month_closes  for each row execute function public.touch_updated_at();
create trigger touch_goals         before update on public.goals         for each row execute function public.touch_updated_at();
create trigger touch_achievements  before update on public.achievements  for each row execute function public.touch_updated_at();
create trigger touch_activity_days before update on public.activity_days for each row execute function public.touch_updated_at();

alter table public.month_closes  enable row level security;
alter table public.goals         enable row level security;
alter table public.achievements  enable row level security;
alter table public.activity_days enable row level security;
create policy "own rows" on public.month_closes  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.goals         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.achievements  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.activity_days for all using (user_id = auth.uid()) with check (user_id = auth.uid());
