-- Household: two or more people keeping the books together. The members
-- (id, name, colour) live on the profile; a transaction can say whose
-- income it is or who paid (null = shared / not set).
alter table public.profiles
  add column household jsonb not null default '[]'::jsonb;
alter table public.transactions
  add column person_id uuid;
