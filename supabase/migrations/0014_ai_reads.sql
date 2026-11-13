-- Reading documents with AI: at most 2 reads per account per 24 hours, so
-- nobody uploads non-stop (it costs money per read) and the habit stays a
-- weekly one. Only *when* a read happened is kept — never the document or
-- what was in it.
--
-- The server claims a read before calling the AI (public.claim_ai_read) and
-- gives it back if reading failed (public.refund_ai_read). Both run as the
-- signed-in user (auth.uid()); users can read their own rows but can't add,
-- change or remove them directly.

create table if not exists public.ai_reads (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('bank', 'payslip', 'mortgage')),
  created_at  timestamptz not null default now()
);
create index if not exists ai_reads_user_time on public.ai_reads (user_id, created_at desc);
alter table public.ai_reads enable row level security;
create policy "own ai reads readable" on public.ai_reads for select using (user_id = auth.uid());
-- No insert / update / delete policies: only the functions below write.

-- How many reads are left in the last 24 hours, and when the next one frees up.
create or replace function public.ai_reads_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select created_at from public.ai_reads
    where user_id = auth.uid() and created_at > now() - interval '24 hours'
  )
  select jsonb_build_object(
    'limit', 2,
    'used', (select count(*) from recent),
    'left', greatest(0, 2 - (select count(*) from recent)),
    'next_at', case when (select count(*) from recent) >= 2 then (select min(created_at) + interval '24 hours' from recent) end
  );
$$;

-- Claim one read for the signed-in user; refused (ok = false) when two were
-- used in the last 24 hours. The row lock keeps two clicks at once from both
-- getting through.
create or replace function public.claim_ai_read(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  used integer;
  id   bigint;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'signed out');
  end if;
  perform 1 from auth.users where auth.users.id = uid for update;
  select count(*) into used from public.ai_reads where user_id = uid and created_at > now() - interval '24 hours';
  if used >= 2 then
    return public.ai_reads_status() || jsonb_build_object('ok', false);
  end if;
  insert into public.ai_reads (user_id, kind) values (uid, p_kind) returning ai_reads.id into id;
  return public.ai_reads_status() || jsonb_build_object('ok', true, 'id', id);
end;
$$;

-- Give a read back when reading failed (only your own, only just now).
create or replace function public.refund_ai_read(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ai_reads where id = p_id and user_id = auth.uid() and created_at > now() - interval '10 minutes';
$$;

revoke all on function public.claim_ai_read(text), public.refund_ai_read(bigint), public.ai_reads_status() from public;
grant execute on function public.claim_ai_read(text), public.refund_ai_read(bigint), public.ai_reads_status() to authenticated;
