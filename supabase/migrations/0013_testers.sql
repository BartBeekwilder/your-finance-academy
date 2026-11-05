-- Testers: invite codes for sign-up, and feedback from inside the app.
--
-- INVITE CODES. A new account needs a valid code: the sign-up form sends it
-- as user metadata ("invite"), and the auth hook below checks it before the
-- user is created (Supabase › Authentication › Hooks › "Before user created"
-- → Postgres function public.hook_check_invite). Each code can be used
-- `max_uses` times. Codes are only readable by the database owner (no
-- policies): add them in the Table Editor or with
--   insert into public.invite_codes (code, note, max_uses) values ('VRIENDEN-2026', 'friends', 20);
-- Without the hook switched on, the code is asked for but not checked.

create table if not exists public.invite_codes (
  code        text primary key check (code = upper(code) and length(code) between 4 and 40),
  note        text not null default '',
  max_uses    integer not null default 1 check (max_uses >= 0),
  uses        integer not null default 0 check (uses >= 0),
  created_at  timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
-- No policies: app users can neither read nor change codes.

create or replace function public.hook_check_invite(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  given text := upper(trim(coalesce(event -> 'user' -> 'user_metadata' ->> 'invite', '')));
  hit   public.invite_codes%rowtype;
begin
  select * into hit from public.invite_codes where code = given for update;
  if not found or hit.uses >= hit.max_uses then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'This invite code is not valid (any more). Ask for a new one.'));
  end if;
  update public.invite_codes set uses = uses + 1 where code = given;
  return '{}'::jsonb;
end;
$$;

-- Only Supabase Auth may run the hook (the role exists on Supabase only).
revoke execute on function public.hook_check_invite(jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function public.hook_check_invite(jsonb) to supabase_auth_admin';
    execute 'grant usage on schema public to supabase_auth_admin';
    execute 'grant select, update on public.invite_codes to supabase_auth_admin';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.hook_check_invite(jsonb) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.hook_check_invite(jsonb) from authenticated';
  end if;
end $$;

-- FEEDBACK. "Send feedback" in the app writes a row here; the owner reads
-- them in the Table Editor. A user can add and read only their own.
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email       text,
  kind        text not null default 'idea' check (kind in ('bug', 'idea', 'love', 'other')),
  message     text not null check (length(message) between 1 and 5000),
  page        text,
  context     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy "add own feedback" on public.feedback
  for insert with check (user_id = auth.uid());
create policy "read own feedback" on public.feedback
  for select using (user_id = auth.uid());
