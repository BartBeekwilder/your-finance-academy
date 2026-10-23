// Runs every migration in an in-memory Postgres (PGlite) with a minimal
// stand-in for Supabase auth, then checks row-level security and sync rules.
// Usage: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const db = new PGlite();
const sql = (q, p) => db.query(q, p);
// Minimal stand-in for Supabase's auth schema + roles.
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
  grant usage on schema public, auth to authenticated;
`);
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
await db.exec(`grant all on all tables in schema public to authenticated;`);
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
await sql(`insert into auth.users values ($1), ($2)`, [A, B]);
const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`); try { return await fn(); } finally { await db.exec(`reset role;`); } };
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

ok((await sql(`select count(*)::int n from profiles`)).rows[0].n === 2, "profile auto-created for each new user");

const catA = (await as(A, () => sql(`insert into categories (name, color_hex) values ('Groceries', '2E8B57') returning id`))).rows[0].id;
await as(A, () => sql(`insert into transactions (amount, type, category_id) values (12.34, 'expense', $1)`, [catA]));
ok((await as(A, () => sql(`select user_id from transactions`))).rows[0].user_id === A, "user_id defaults to signed-in user");
ok((await as(B, () => sql(`select * from transactions`))).rows.length === 0, "user B cannot see user A's transactions");
ok((await as(B, () => sql(`select * from categories where user_id = $1`, [A]))).rows.length === 0, "user B cannot see user A's categories");
let err = null; try { await as(B, () => sql(`insert into transactions (user_id, amount) values ($1, 1)`, [A])); } catch (e) { err = e.message; }
ok(err && /row-level security/.test(err), "user B cannot write rows into user A's account");
const upd = await as(B, () => sql(`update transactions set amount = 0`));
ok(upd.affectedRows === 0, "user B cannot modify user A's rows");

err = null; try { await as(A, () => sql(`insert into entitlements (user_id, is_premium) values ($1, true)`, [A])); } catch (e) { err = e.message; }
ok(err && /row-level security/.test(err), "user cannot grant themselves Premium");
await sql(`insert into entitlements (user_id, is_premium, store) values ($1, true, 'stripe')`, [A]);
ok((await as(A, () => sql(`select is_premium from entitlements`))).rows[0]?.is_premium === true, "user can read own entitlement (server-written)");
ok((await as(B, () => sql(`select * from entitlements`))).rows.length === 0, "user B cannot read user A's entitlement");

const before = (await as(A, () => sql(`select updated_at from transactions`))).rows[0].updated_at;
await new Promise(r => setTimeout(r, 20));
await db.exec(`begin`); 
await as(A, () => sql(`update transactions set note = 'AH'`)); await db.exec(`commit`);
const after = (await as(A, () => sql(`select updated_at from transactions`))).rows[0].updated_at;
ok(after > before, "updated_at bumps on edit (sync pull relies on this)");

err = null; try { await as(A, () => sql(`insert into transactions (amount) values (-5)`)); } catch (e) { err = e.message; }
ok(err && /check/.test(err), "negative amounts rejected (sign comes from type)");
const money = (await as(A, () => sql(`select amount::text a from transactions limit 1`))).rows[0].a;
ok(money === "12.3400", "money kept as exact decimal: " + money);

const catB = (await as(B, () => sql(`insert into categories (name) values ('B cat') returning id`))).rows[0].id;
err = null; try { await as(B, () => sql(`insert into transactions (amount, category_id) values (1, $1)`, [catA])); } catch (e) { err = e.message; }
ok(err && /foreign key/.test(err), "user B cannot link a transaction to user A's category");
await as(B, () => sql(`insert into transactions (amount, category_id) values (2, $1)`, [catB]));
await as(B, () => sql(`delete from categories where id = $1`, [catB]));
const orphan = (await as(B, () => sql(`select user_id, category_id from transactions`))).rows[0];
ok(orphan.user_id === B && orphan.category_id === null, "deleting a category clears the link but keeps the transaction's owner");

const seeded = (await as(A, () => sql(`select count(*)::int n, sum(is_fixed_expense::int)::int fixed, sum(is_income_category::int)::int income from categories where is_default`))).rows[0];
ok(seeded.n === 9 && seeded.fixed === 2 && seeded.income === 1, "new user gets the 9 iOS starter categories (Rent+Utilities fixed, 1 income)");
ok((await as(A, () => sql(`select count(*)::int n from accounts where is_default`))).rows[0].n === 1, "new user gets one hidden default account");
ok((await as(B, () => sql(`select count(*)::int n from categories where is_default`))).rows[0].n === 9, "each user gets their own copy");

// Balance sheet (0003).
const homeA = (await as(A, () => sql(`insert into balance_items (name, side, current_value) values ('Home', 'asset', 450000) returning id`))).rows[0].id;
await as(A, () => sql(`insert into balance_values (item_id, month, value) values ($1, '2026-01-01', 440000)`, [homeA]));
ok((await as(B, () => sql(`select * from balance_items`))).rows.length === 0, "user B cannot see user A's balance items");
ok((await as(B, () => sql(`select * from balance_values`))).rows.length === 0, "user B cannot see user A's balance values");
err = null; try { await as(B, () => sql(`insert into balance_values (item_id, month, value) values ($1, '2026-02-01', 1)`, [homeA])); } catch (e) { err = e.message; }
ok(err && /foreign key/.test(err), "user B cannot add a month value to user A's balance item");
err = null; try { await as(A, () => sql(`insert into balance_values (item_id, month, value) values ($1, '2026-01-01', 1)`, [homeA])); } catch (e) { err = e.message; }
ok(err && /unique|duplicate/.test(err), "one value per item per month");
err = null; try { await as(A, () => sql(`insert into balance_values (item_id, month, value) values ($1, '2026-03-15', 1)`, [homeA])); } catch (e) { err = e.message; }
ok(err && /check/.test(err), "balance months are the 1st of the month");
err = null; try { await as(A, () => sql(`insert into balance_items (name, side) values ('X', 'equity')`)); } catch (e) { err = e.message; }
ok(err && /check/.test(err), "balance item side is asset or liability");

// Real estate (0004).
const houseA = (await as(A, () => sql(`insert into properties (name, value, country) values ('Home', 675000, 'NL') returning id`))).rows[0].id;
await as(A, () => sql(`insert into mortgage_parts (property_id, kind, principal, rate, term_months) values ($1, 'annuity', 450000, 3.9, 360)`, [houseA]));
ok((await as(B, () => sql(`select * from properties`))).rows.length === 0, "user B cannot see user A's properties");
ok((await as(B, () => sql(`select * from mortgage_parts`))).rows.length === 0, "user B cannot see user A's mortgage parts");
err = null; try { await as(B, () => sql(`insert into mortgage_parts (property_id, principal) values ($1, 1)`, [houseA])); } catch (e) { err = e.message; }
ok(err && /foreign key/.test(err), "user B cannot add a mortgage part to user A's property");
err = null; try { await as(A, () => sql(`insert into mortgage_parts (property_id, kind) values ($1, 'balloon')`, [houseA])); } catch (e) { err = e.message; }
ok(err && /check/.test(err), "mortgage kind is annuity, linear or interest_only");
err = null; try { await as(A, () => sql(`insert into properties (name, country) values ('X', 'XX')`)); } catch (e) { err = e.message; }
ok(err && /check/.test(err), "property country rules are INTL or NL");
await as(A, () => sql(`delete from properties where id = $1`, [houseA]));
ok((await as(A, () => sql(`select count(*)::int n from mortgage_parts`))).rows[0].n === 0, "deleting a property removes its mortgage parts");

// Progress (0005).
await as(A, () => sql(`insert into month_closes (month, summary, points) values ('2026-09-01', '{"saved": 1200}', 150)`));
ok((await as(B, () => sql(`select * from month_closes`))).rows.length === 0, "user B cannot see user A's month closes");
err = null; try { await as(A, () => sql(`insert into month_closes (month) values ('2026-09-01')`)); } catch (e) { err = e.message; }
ok(err && /unique|duplicate/.test(err), "a month can be closed once");
err = null; try { await as(A, () => sql(`insert into month_closes (month) values ('2026-09-15')`)); } catch (e) { err = e.message; }
ok(err && /check/.test(err), "closed months are the 1st of the month");
await as(A, () => sql(`insert into goals (kind, name, target) values ('save', 'Buffer', 5000)`));
ok((await as(B, () => sql(`select * from goals`))).rows.length === 0, "user B cannot see user A's goals");
err = null; try { await as(A, () => sql(`insert into goals (kind) values ('lottery')`)); } catch (e) { err = e.message; }
ok(err && /check/.test(err), "goal kind is save, debt, equity or category_limit");
await as(A, () => sql(`insert into achievements (code, points) values ('first-close', 100)`));
err = null; try { await as(A, () => sql(`insert into achievements (code) values ('first-close')`)); } catch (e) { err = e.message; }
ok(err && /unique|duplicate/.test(err), "a badge is earned once");
ok((await as(B, () => sql(`select * from achievements`))).rows.length === 0, "user B cannot see user A's badges");
await as(A, () => sql(`insert into activity_days (day) values ('2026-10-23')`));
err = null; try { await as(A, () => sql(`insert into activity_days (day) values ('2026-10-23')`)); } catch (e) { err = e.message; }
ok(err && /unique|duplicate/.test(err), "one activity row per day");
