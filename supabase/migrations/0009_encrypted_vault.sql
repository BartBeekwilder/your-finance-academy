-- Encrypted vault: an end-to-end encrypted copy of the user's finance data.
-- The browser encrypts everything with a key derived from a passphrase only
-- the user knows (PBKDF2-SHA256 → AES-256-GCM); this table only ever holds
-- the ciphertext plus the public salt / IV / KDF settings needed to decrypt
-- it again with that passphrase. Nobody with database access can read it,
-- and a forgotten passphrase cannot be recovered. One vault per user.
create table public.encrypted_vaults (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ciphertext  text not null,
  iv          text not null,
  salt        text not null,
  kdf         jsonb not null default '{"name":"PBKDF2","hash":"SHA-256","iterations":600000}',
  version     integer not null default 1,
  bytes       integer not null default 0 check (bytes >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger touch_encrypted_vaults before update on public.encrypted_vaults
  for each row execute function public.touch_updated_at();

alter table public.encrypted_vaults enable row level security;
create policy "own vault" on public.encrypted_vaults
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
