-- Fills ONE account with 12 months of realistic sample data for testing.
-- Run in the Supabase SQL Editor; change the email below first.
--
-- Every sample row's id starts with 'dddddddd', so sample_data_remove.sql
-- can delete exactly these rows and nothing the user entered themselves.

do $$
declare
  uid uuid := (select id from auth.users where email = 'bartbeekwilder@mac.com');
  cat record;
  m date;
  last_day int;
  n int;
  sample_id text := 'dddddddd';
begin
  if uid is null then
    raise exception 'No user with that email — sign in on the website once first.';
  end if;

  update public.profiles
     set expected_gross_monthly = 5200, expected_net_monthly = 3850, payday_day = 25
   where user_id = uid;

  for m in
    select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month')::date
  loop
    -- Only up to today in the current month.
    last_day := case when m = date_trunc('month', now())::date
                     then extract(day from now())::int
                     else extract(day from (m + interval '1 month - 1 day'))::int end;

    -- Salary on the 25th, rent on the 1st, utilities on the 3rd.
    if last_day >= 25 then
      insert into public.transactions (id, user_id, amount, type, date, note, is_auto_income, category_id)
      select overlay(gen_random_uuid()::text placing sample_id from 1 for 8)::uuid, uid,
             round((3850 + (random() * 2 - 1) * 260)::numeric, 2), 'income',
             m + interval '24 days 12 hours', 'Salary', true, c.id
        from public.categories c where c.user_id = uid and c.name = 'Income' and c.deleted_at is null limit 1;
    end if;

    -- Extra income in finished months: holiday allowance (May), year-end
    -- bonus (December), tax refund (April), freelance in about half the months.
    if m < date_trunc('month', now())::date then
      insert into public.transactions (id, user_id, amount, type, date, note, category_id)
      select overlay(gen_random_uuid()::text placing sample_id from 1 for 8)::uuid, uid, v.amount, 'income',
             m + (v.day - 1) * interval '1 day' + interval '12 hours', v.note, c.id
        from (values (5, 2480.00, 20, 'Holiday allowance'), (12, 1900.00, 18, 'Year-end bonus'), (4, 640.00, 9, 'Tax refund'))
               as v(month, amount, day, note)
        join public.categories c on c.user_id = uid and c.name = 'Income' and c.deleted_at is null
       where v.month = extract(month from m);
      if random() < 0.45 then
        insert into public.transactions (id, user_id, amount, type, date, note, category_id)
        select overlay(gen_random_uuid()::text placing sample_id from 1 for 8)::uuid, uid,
               round((150 + random() * 500)::numeric, 2), 'income',
               m + floor(random() * 27) * interval '1 day' + interval '12 hours', 'Freelance', c.id
          from public.categories c where c.user_id = uid and c.name = 'Income' and c.deleted_at is null limit 1;
      end if;
    end if;

    insert into public.transactions (id, user_id, amount, type, date, note, is_fixed_expense, category_id)
    select overlay(gen_random_uuid()::text placing sample_id from 1 for 8)::uuid, uid, v.amount, 'expense',
           m + (v.day - 1) * interval '1 day' + interval '12 hours', v.note, true, c.id
      from (values ('Rent', 1250.00, 1, 'Rent'), ('Utilities', round((140 + random() * 40)::numeric, 2), 3, 'Energy & water'))
             as v(category, amount, day, note)
      join public.categories c on c.user_id = uid and c.name = v.category and c.deleted_at is null;

    -- Variable spending: [category, min, max, entries per month, notes]
    for cat in
      select c.id, p.lo, p.hi, p.cnt, p.notes
        from (values
          ('Groceries',     18,  95, 9, array['Albert Heijn', 'Jumbo', 'Lidl', 'Market']),
          ('Transport',     12,  60, 5, array['NS train', 'Fuel', 'Parking', 'OV top-up']),
          ('Dining Out',    15,  70, 4, array['Lunch', 'Pizza', 'Sushi', 'Café']),
          ('Shopping',      20, 140, 2, array['Clothing', 'Bol.com', 'Home goods']),
          ('Entertainment',  9,  45, 2, array['Cinema', 'Streaming', 'Concert']),
          ('Health',        10,  80, 1, array['Pharmacy', 'Gym'])
        ) as p(name, lo, hi, cnt, notes)
        join public.categories c on c.user_id = uid and c.name = p.name and c.deleted_at is null
    loop
      for n in 1..cat.cnt loop
        insert into public.transactions (id, user_id, amount, type, date, note, category_id)
        values (
          overlay(gen_random_uuid()::text placing sample_id from 1 for 8)::uuid, uid,
          round((cat.lo + random() * (cat.hi - cat.lo))::numeric, 2), 'expense',
          m + floor(random() * last_day) * interval '1 day' + interval '12 hours',
          cat.notes[1 + floor(random() * array_length(cat.notes, 1))::int], cat.id);
      end loop;
    end loop;
  end loop;

  -- This month's budgets.
  insert into public.budgets (id, user_id, category_id, amount, month)
  select overlay(gen_random_uuid()::text placing sample_id from 1 for 8)::uuid, uid, c.id, v.amount, date_trunc('month', now())::date
    from (values ('Groceries', 450), ('Rent', 1250), ('Transport', 180), ('Dining Out', 150),
                 ('Utilities', 170), ('Shopping', 200), ('Entertainment', 80), ('Health', 60)) as v(name, amount)
    join public.categories c on c.user_id = uid and c.name = v.name and c.deleted_at is null;

  -- A few investments.
  insert into public.holdings (id, user_id, symbol, name, asset_type, quantity, cost_basis, cost_basis_currency, date_added)
  values
    (overlay(gen_random_uuid()::text placing sample_id from 1 for 8)::uuid, uid, 'BTC',  'Bitcoin',    'crypto', 0.085, 4200, null,  now() - interval '7 months'),
    (overlay(gen_random_uuid()::text placing sample_id from 1 for 8)::uuid, uid, 'AAPL', 'Apple Inc.', 'stock',  12,    2050, 'USD', now() - interval '4 months'),
    (overlay(gen_random_uuid()::text placing sample_id from 1 for 8)::uuid, uid, 'XAU',  'Gold',       'metal',  1,     2100, null,  now() - interval '11 months');

  -- Starting balance so net worth isn't just this year's savings.
  update public.accounts set balance = 8400 where user_id = uid and is_default;
end $$;
