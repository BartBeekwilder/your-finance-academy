-- New accounts start with the same starter categories and hidden default
-- account the iOS app seeds on first launch (Services/SeedData.swift).
-- Done here, once, by the database — if each client seeded on its own, a
-- user signing in on iPhone and web at the same time would get duplicates.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id);

  insert into public.categories
    (user_id, name, icon, color_hex, is_default, is_income_category, is_fixed_expense, sort_order)
  values
    (new.id, 'Groceries',     'cart.fill',              '2E8B57', true, false, false, 0),
    (new.id, 'Rent',          'house.fill',             '2F6690', true, false, true,  1),
    (new.id, 'Transport',     'car.fill',               'F3A712', true, false, false, 2),
    (new.id, 'Dining Out',    'fork.knife',             'E4572E', true, false, false, 3),
    (new.id, 'Utilities',     'bolt.fill',              '6D4C41', true, false, true,  4),
    (new.id, 'Shopping',      'bag.fill',               '9B5DE5', true, false, false, 5),
    (new.id, 'Entertainment', 'film.fill',              'D64584', true, false, false, 6),
    (new.id, 'Health',        'cross.case.fill',        'E63946', true, false, false, 7),
    (new.id, 'Income',        'dollarsign.circle.fill', '1C7C54', true, true,  false, 8);

  insert into public.accounts (user_id, name, type, balance, is_default)
  values (new.id, 'Default', 'checking', 0, true);

  return new;
end $$;
