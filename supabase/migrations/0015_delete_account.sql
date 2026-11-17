-- Delete my account (Settings › Your data): a signed-in user removes their
-- own auth user; every table that holds their data references auth.users
-- "on delete cascade", so the books, the encrypted vault, feedback and AI
-- read counts go with it. The web route first checks there's no running
-- paid subscription and removes the RevenueCat customer.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.delete_my_account() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.delete_my_account() to authenticated';
  end if;
end;
$$;
