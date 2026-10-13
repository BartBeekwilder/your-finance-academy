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

await as(A, () => sql(`insert into categories (name, color_hex) values ('Groceries', '2E8B57')`));
const catA = (await as(A, () => sql(`select id from categories`))).rows[0].id;
await as(A, () => sql(`insert into transactions (amount, type, category_id) values (12.34, 'expense', $1)`, [catA]));
ok((await as(A, () => sql(`select user_id from transactions`))).rows[0].user_id === A, "user_id defaults to signed-in user");
ok((await as(B, () => sql(`select * from transactions`))).rows.length === 0, "user B cannot see user A's transactions");
ok((await as(B, () => sql(`select * from categories`))).rows.length === 0, "user B cannot see user A's categories");
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
