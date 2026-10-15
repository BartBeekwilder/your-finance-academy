-- Removes everything sample_data.sql added (ids starting with 'dddddddd')
-- and resets the profile/account values it changed. Rows the user entered
-- themselves are untouched.

do $$
declare
  uid uuid := (select id from auth.users where email = 'bartbeekwilder@mac.com');
begin
  delete from public.transactions where user_id = uid and id::text like 'dddddddd%';
  delete from public.budgets      where user_id = uid and id::text like 'dddddddd%';
  delete from public.holdings     where user_id = uid and id::text like 'dddddddd%';
  update public.profiles set expected_gross_monthly = null, expected_net_monthly = null, payday_day = null
   where user_id = uid;
  update public.accounts set balance = 0 where user_id = uid and is_default;
end $$;
