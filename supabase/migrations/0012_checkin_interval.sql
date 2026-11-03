-- Check-ins: how often the "are my books up to date?" checklist comes
-- round. The check-ins themselves are achievements (code checkin:YYYY-MM-DD).
alter table public.profiles
  add column if not exists checkin_interval text not null default 'daily'
  check (checkin_interval in ('daily', 'twice-weekly', 'weekly'));
