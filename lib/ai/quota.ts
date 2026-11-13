import { createClient } from "@supabase/supabase-js";

// How often an account may have documents read with AI: 2 reads per 24
// hours (supabase/migrations/0014_ai_reads.sql keeps the count). A read is
// claimed before the AI is called and given back when reading fails.
// Everything runs as the signed-in user, with their own access token.

export const READS_PER_DAY = 2;

export type Quota = { limit: number; used: number; left: number; next_at: string | null };

function asUser(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
}

/** The migration isn't applied yet (function unknown): don't block reading. */
const missing = (e: { code?: string } | null) => e?.code === "PGRST202" || e?.code === "42883";

export async function quota(req: Request): Promise<Quota | null> {
  const db = asUser(req);
  if (!db) return null;
  const { data, error } = await db.rpc("ai_reads_status");
  if (error) {
    if (missing(error)) return null;
    throw error;
  }
  return data as Quota;
}

/** Claim a read: { ok: false } when the day's reads are used up. */
export async function claim(req: Request, kind: string): Promise<(Quota & { ok: boolean; id?: number }) | null> {
  const db = asUser(req);
  if (!db) return null;
  const { data, error } = await db.rpc("claim_ai_read", { p_kind: kind });
  if (error) {
    if (missing(error)) {
      console.warn("ai reads: migration 0014 not applied yet — no limit");
      return null;
    }
    throw error;
  }
  return data as Quota & { ok: boolean; id?: number };
}

export async function refund(req: Request, id: number) {
  await asUser(req)?.rpc("refund_ai_read", { p_id: id });
}
