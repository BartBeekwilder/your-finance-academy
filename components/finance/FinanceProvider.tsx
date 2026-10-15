"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { buildDemoData } from "@/lib/finance/demo";
import type { FinanceData, Profile, Transaction } from "@/lib/finance/types";
import { getSupabase } from "@/lib/supabase";
import SignIn from "./SignIn";

// Single source of finance data for every /app screen: the signed-in user's
// rows from Supabase, or demo data when the visitor chooses it (or the site
// has no Supabase config). Screens read `data` and call the actions below;
// they never talk to Supabase directly.

export type NewTransaction = Omit<Transaction, "id" | "updated_at" | "deleted_at">;

type FinanceState = {
  data: FinanceData;
  source: "demo" | "supabase";
  now: Date;
  email: string | null;
  addTransaction: (t: NewTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const FinanceContext = createContext<FinanceState | null>(null);
const DEMO_KEY = "pf-demo";

const DEFAULT_PROFILE: Profile = {
  currency_code: "EUR",
  appearance_mode: "dark",
  expected_gross_monthly: null,
  expected_net_monthly: null,
  payday_day: null,
  income_reminders: true,
};

/** Supabase caps a request at 1,000 rows, so page through larger tables. */
async function fetchAll<T>(supabase: SupabaseClient, table: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .is("deleted_at", null)
      .order(order, { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
}

async function loadAll(supabase: SupabaseClient): Promise<FinanceData> {
  const [profile, accounts, categories, budgets, transactions, incomeRecords, holdings] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle().then(({ data, error }) => {
      if (error) throw error;
      return data as Profile | null;
    }),
    fetchAll<FinanceData["accounts"][number]>(supabase, "accounts", "created_at"),
    fetchAll<FinanceData["categories"][number]>(supabase, "categories", "sort_order"),
    fetchAll<FinanceData["budgets"][number]>(supabase, "budgets", "month"),
    fetchAll<Transaction>(supabase, "transactions", "date"),
    fetchAll<FinanceData["incomeRecords"][number]>(supabase, "income_records", "month"),
    fetchAll<FinanceData["holdings"][number]>(supabase, "holdings", "date_added"),
  ]);
  return { profile: profile ?? DEFAULT_PROFILE, accounts, categories, budgets, transactions, incomeRecords, holdings };
}

type Phase =
  | { kind: "starting" }
  | { kind: "signed-out" }
  | { kind: "loading"; session: Session }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: FinanceData; source: "demo" | "supabase"; email: string | null };

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const [now] = useState(() => new Date());
  const supabase = getSupabase();

  const startDemo = useCallback(() => {
    try {
      sessionStorage.setItem(DEMO_KEY, "1");
    } catch {}
    setPhase({ kind: "ready", data: buildDemoData(new Date()), source: "demo", email: null });
  }, []);

  // Follow the auth session: signed in → load that user's data.
  useEffect(() => {
    let demo = false;
    try {
      demo = sessionStorage.getItem(DEMO_KEY) === "1";
    } catch {}
    if (!supabase || demo) {
      queueMicrotask(startDemo);
      return;
    }

    const apply = (session: Session | null) => {
      if (!session) return setPhase({ kind: "signed-out" });
      setPhase({ kind: "loading", session });
      loadAll(supabase)
        .then((data) => setPhase({ kind: "ready", data, source: "supabase", email: session.user.email ?? null }))
        .catch((e: Error) => setPhase({ kind: "error", message: e.message }));
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refreshes don't change whose data this is — no need to reload.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") apply(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, startDemo]);

  const update = useCallback((fn: (d: FinanceData) => FinanceData) => {
    setPhase((p) => (p.kind === "ready" ? { ...p, data: fn(p.data) } : p));
  }, []);

  const source = phase.kind === "ready" ? phase.source : "demo";

  const addTransaction = useCallback(
    async (t: NewTransaction) => {
      const row: Transaction = { ...t, id: crypto.randomUUID(), updated_at: new Date().toISOString(), deleted_at: null };
      if (source === "supabase" && supabase) {
        const { data, error } = await supabase.from("transactions").insert({ ...t, id: row.id }).select().single();
        if (error) throw error;
        Object.assign(row, data);
      }
      update((d) => ({ ...d, transactions: [row, ...d.transactions].sort((a, b) => b.date.localeCompare(a.date)) }));
    },
    [source, supabase, update],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      // Soft delete, so the user's other devices learn about it on next sync.
      if (source === "supabase" && supabase) {
        const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      }
      update((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
    },
    [source, supabase, update],
  );

  const signOut = useCallback(async () => {
    try {
      sessionStorage.removeItem(DEMO_KEY);
    } catch {}
    if (!supabase) return startDemo(); // demo is the only mode without Supabase config
    await supabase.auth.signOut();
    setPhase({ kind: "signed-out" });
  }, [supabase, startDemo]);

  if (phase.kind === "signed-out")
    return (
      <div className="pf-solo">
        <SignIn onDemo={startDemo} />
      </div>
    );
  if (phase.kind === "error")
    return (
      <div className="pf-solo">
        <div className="pf-card" style={{ padding: 20, maxWidth: 480 }}>
          <strong>Couldn&apos;t load your data</strong>
          <p style={{ color: "var(--pf-ink-2)", margin: "6px 0 14px" }}>{phase.message}</p>
          <button className="pf-button" onClick={() => location.reload()}>Try again</button>
        </div>
      </div>
    );
  if (phase.kind !== "ready") return <div className="pf-solo pf-loading" aria-busy="true" />;

  return (
    <FinanceContext.Provider
      value={{ data: phase.data, source: phase.source, now, email: phase.email, addTransaction, deleteTransaction, signOut }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used inside <FinanceProvider>");
  return ctx;
}
