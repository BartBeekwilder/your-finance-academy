import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-side Supabase client. The publishable key is safe to ship: every
// table has row-level security, so a session can only reach its own rows.
// Returns null when the env vars aren't set, and the app falls back to demo
// data instead of crashing.

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}
