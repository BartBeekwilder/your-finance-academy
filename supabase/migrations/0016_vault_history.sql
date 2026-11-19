-- Vault history: every time a user's encrypted copy is replaced, the copy it
-- replaces is kept here first (the last 10 per user). Still ciphertext only —
-- nobody can read it without the user's passphrase — but a bad upload (on
-- 18 Nov 2026 an iPhone with a stale sync snapshot marked 896 records as
-- deleted and uploaded that) can now be undone by putting an earlier copy
-- back. Users can list their own history; only the trigger writes it.
create table public.encrypted_vault_history (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  ciphertext   text not null,
  iv           text not null,
  salt         text not null,
  kdf          jsonb not null,
  version      integer not null,
  bytes        integer not null,
  saved_at     timestamptz not null,           -- when the replaced copy was uploaded
  replaced_at  timestamptz not null default now()
);

create index encrypted_vault_history_user on public.encrypted_vault_history (user_id, replaced_at desc);

alter table public.encrypted_vault_history enable row level security;
create policy "own vault history" on public.encrypted_vault_history
  for select using (user_id = auth.uid());

create function public.keep_vault_history() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if old.ciphertext is distinct from new.ciphertext then
    insert into public.encrypted_vault_history (user_id, ciphertext, iv, salt, kdf, version, bytes, saved_at)
    values (old.user_id, old.ciphertext, old.iv, old.salt, old.kdf, old.version, old.bytes, old.updated_at);
    delete from public.encrypted_vault_history h
     where h.user_id = old.user_id
       and h.id not in (select id from public.encrypted_vault_history
                         where user_id = old.user_id order by replaced_at desc, id desc limit 10);
  end if;
  return new;
end $$;

revoke all on function public.keep_vault_history() from public, anon, authenticated;

create trigger keep_vault_history before update on public.encrypted_vaults
  for each row execute function public.keep_vault_history();
