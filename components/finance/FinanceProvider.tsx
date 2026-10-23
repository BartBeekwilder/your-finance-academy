"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { buildDemoData } from "@/lib/finance/demo";
import type { Account, BalanceItem, BalanceValue, Budget, Category, FinanceData, Profile, Transaction } from "@/lib/finance/types";
import { getSupabase } from "@/lib/supabase";
import SignIn, { RECOVERY_KEY } from "./SignIn";

// Single source of finance data for every /app screen: the signed-in user's
// rows from Supabase, or demo data when the visitor chooses it (or the site
// has no Supabase config). Screens read `data` and call the actions below;
// they never talk to Supabase directly.

export type NewTransaction = Omit<Transaction, "id" | "updated_at" | "deleted_at">;
export type NewCategory = Pick<Category, "name" | "icon" | "color_hex" | "is_income_category" | "is_fixed_expense">;

type FinanceState = {
  data: FinanceData;
  source: "demo" | "supabase";
  now: Date;
  email: string | null;
  addTransaction: (t: NewTransaction) => Promise<void>;
  /** Saves changes to an existing transaction. */
  updateTransaction: (id: string, t: NewTransaction) => Promise<void>;
  /** Saves settings (e.g. currency_code) to the user's profile. */
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  /** Balance sheet: add a post (its value becomes this month's stand too). */
  addBalanceItem: (item: { name: string; side: BalanceItem["side"]; value: number }) => Promise<void>;
  /** A post's value for a month: this month also sets the current stand;
   *  an earlier month sets that month-end stand only. */
  setBalanceValue: (itemId: string, month: Date, value: number) => Promise<void>;
  renameBalanceItem: (itemId: string, name: string) => Promise<void>;
  deleteBalanceItem: (itemId: string) => Promise<void>;
  /** Creates or updates an account (no id = new). */
  saveAccount: (a: { id?: string; name: string; type: Account["type"]; balance: number }) => Promise<void>;
  /** Sets a category's budget for a month (creates or updates that month's row). */
  setBudget: (categoryId: string, month: Date, amount: number) => Promise<void>;
  /** Creates a top-level category at the end of the list; returns it. */
  addCategory: (c: NewCategory) => Promise<Category>;
  deleteTransaction: (id: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
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
  // Balance sheet tables are newer: a project without them still loads.
  const optional = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const [profile, accounts, categories, budgets, transactions, incomeRecords, holdings, balanceItems, balanceValues] = await Promise.all([
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
    optional(fetchAll<BalanceItem>(supabase, "balance_items", "sort_order")),
    optional(fetchAll<BalanceValue>(supabase, "balance_values", "month")),
  ]);
  return { profile: profile ?? DEFAULT_PROFILE, accounts, categories, budgets, transactions, incomeRecords, holdings, balanceItems, balanceValues };
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

    // getSession() and the initial SIGNED_IN event both report the same
    // session on load; remember whose data is loaded so it's fetched once.
    let loadedFor: string | null = null;
    const apply = (session: Session | null) => {
      if (!session) {
        loadedFor = null;
        return setPhase({ kind: "signed-out" });
      }
      // Mid password-reset: stay on the sign-in screen until a new password
      // is saved (SignIn clears the flag and refreshes the session).
      if (sessionStorage.getItem(RECOVERY_KEY) === "1") return setPhase({ kind: "signed-out" });
      if (loadedFor === session.user.id) return;
      loadedFor = session.user.id;
      setPhase({ kind: "loading", session });
      loadAll(supabase)
        .then((data) => setPhase({ kind: "ready", data, source: "supabase", email: session.user.email ?? null }))
        .catch((e: Error) => setPhase({ kind: "error", message: e.message }));
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refreshes re-apply too (that's how a finished password reset
      // gets loaded); apply() skips the reload if this user is already loaded.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") apply(session);
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

  const updateTransaction = useCallback(
    async (id: string, t: NewTransaction) => {
      const patch = { ...t, updated_at: new Date().toISOString() };
      if (source === "supabase" && supabase) {
        const { error } = await supabase.from("transactions").update(t).eq("id", id);
        if (error) throw error;
      }
      update((d) => ({ ...d, transactions: d.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort((a, b) => b.date.localeCompare(a.date)) }));
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

  const current = phase.kind === "ready" ? phase.data : null;

  const addCategory = useCallback(
    async (c: NewCategory) => {
      const sort_order = Math.max(-1, ...(current?.categories ?? []).map((x) => x.sort_order)) + 1;
      const fields = { ...c, is_default: false, sort_order, parent_id: null };
      const row = { ...fields, id: crypto.randomUUID(), updated_at: new Date().toISOString(), deleted_at: null } as Category;
      if (source === "supabase" && supabase) {
        const { data, error } = await supabase.from("categories").insert({ ...fields, id: row.id }).select().single();
        if (error) throw error;
        Object.assign(row, data);
      }
      update((d) => ({ ...d, categories: [...d.categories, row] }));
      return row;
    },
    [current, source, supabase, update],
  );

  const reorderCategories = useCallback(
    async (orderedIds: string[]) => {
      // sort_order is shared with iOS (Category.sortOrder), so a new order
      // follows the user to every device. Only rows whose position changed
      // are written; local state updates first so the drop feels instant.
      if (!current) return;
      const pos = new Map(orderedIds.map((id, i) => [id, i]));
      const changed = current.categories
        .filter((c) => pos.has(c.id) && pos.get(c.id) !== c.sort_order)
        .map((c) => ({ id: c.id, sort_order: pos.get(c.id)! }));
      if (changed.length === 0) return;
      const next = new Map(changed.map((c) => [c.id, c.sort_order]));
      update((d) => ({ ...d, categories: d.categories.map((c) => (next.has(c.id) ? { ...c, sort_order: next.get(c.id)! } : c)) }));
      if (source === "supabase" && supabase) {
        const results = await Promise.all(
          changed.map((c) => supabase.from("categories").update({ sort_order: c.sort_order }).eq("id", c.id)),
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      }
    },
    [current, source, supabase, update],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      // The profile row may not exist yet (new account): upsert it. Shared
      // with iOS, so a new currency follows the user to every device.
      if (source === "supabase" && supabase) {
        const { data: auth } = await supabase.auth.getSession();
        const userId = auth.session?.user.id;
        if (!userId) throw new Error("You're signed out. Sign in again to save settings.");
        const { error } = await supabase.from("profiles").upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      update((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
    },
    [source, supabase, update],
  );

  const saveAccount = useCallback(
    async (a: { id?: string; name: string; type: Account["type"]; balance: number }) => {
      const existing = a.id ? current?.accounts.find((x) => x.id === a.id) : undefined;
      const row: Account = existing
        ? { ...existing, name: a.name, type: a.type, balance: a.balance.toFixed(2), updated_at: new Date().toISOString() }
        : { id: crypto.randomUUID(), name: a.name, type: a.type, balance: a.balance.toFixed(2), institution: null, is_default: false, updated_at: new Date().toISOString(), deleted_at: null };
      if (source === "supabase" && supabase) {
        const { error } = existing
          ? await supabase.from("accounts").update({ name: row.name, type: row.type, balance: row.balance }).eq("id", row.id)
          : await supabase.from("accounts").insert({ id: row.id, name: row.name, type: row.type, balance: row.balance, is_default: false });
        if (error) throw error;
      }
      update((d) => ({ ...d, accounts: [...d.accounts.filter((x) => x.id !== row.id), row] }));
    },
    [current, source, supabase, update],
  );

  const setBudget = useCallback(
    async (categoryId: string, month: Date, amount: number) => {
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
      const existing = current?.budgets.find((b) => b.category_id === categoryId && b.month.slice(0, 10) === key && !b.deleted_at);
      const row: Budget = existing
        ? { ...existing, amount: amount.toFixed(2), updated_at: new Date().toISOString() }
        : { id: crypto.randomUUID(), category_id: categoryId, amount: amount.toFixed(2), month: key, updated_at: new Date().toISOString(), deleted_at: null };
      if (source === "supabase" && supabase) {
        const { error } = existing
          ? await supabase.from("budgets").update({ amount: row.amount }).eq("id", row.id)
          : await supabase.from("budgets").insert({ id: row.id, category_id: categoryId, amount: row.amount, month: key });
        if (error) throw error;
      }
      update((d) => ({ ...d, budgets: [...d.budgets.filter((b) => b.id !== row.id), row] }));
    },
    [current, source, supabase, update],
  );

  // ---- Balance sheet ----------------------------------------------------------
  const monthIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

  const upsertValue = useCallback(
    async (itemId: string, month: Date, value: number) => {
      const key = monthIso(month);
      const existing = current?.balanceValues.find((v) => v.item_id === itemId && v.month.slice(0, 10) === key && !v.deleted_at);
      const row: BalanceValue = existing
        ? { ...existing, value: value.toFixed(2), updated_at: new Date().toISOString() }
        : { id: crypto.randomUUID(), item_id: itemId, month: key, value: value.toFixed(2), updated_at: new Date().toISOString(), deleted_at: null };
      if (source === "supabase" && supabase) {
        const { error } = existing
          ? await supabase.from("balance_values").update({ value: row.value }).eq("id", row.id)
          : await supabase.from("balance_values").insert({ id: row.id, item_id: itemId, month: key, value: row.value });
        if (error) throw error;
      }
      update((d) => ({ ...d, balanceValues: [...d.balanceValues.filter((v) => v.id !== row.id), row] }));
    },
    [current, source, supabase, update],
  );

  const setBalanceValue = useCallback(
    async (itemId: string, month: Date, value: number) => {
      const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
      if (isCurrent) {
        if (source === "supabase" && supabase) {
          const { error } = await supabase.from("balance_items").update({ current_value: value.toFixed(2) }).eq("id", itemId);
          if (error) throw error;
        }
        update((d) => ({ ...d, balanceItems: d.balanceItems.map((i) => (i.id === itemId ? { ...i, current_value: value.toFixed(2) } : i)) }));
      }
      await upsertValue(itemId, month, value);
    },
    [now, source, supabase, update, upsertValue],
  );

  const addBalanceItem = useCallback(
    async (item: { name: string; side: BalanceItem["side"]; value: number }) => {
      const sort_order = Math.max(-1, ...(current?.balanceItems ?? []).map((i) => i.sort_order)) + 1;
      const row: BalanceItem = {
        id: crypto.randomUUID(),
        name: item.name,
        side: item.side,
        current_value: item.value.toFixed(2),
        sort_order,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      if (source === "supabase" && supabase) {
        const { error } = await supabase.from("balance_items").insert({ id: row.id, name: row.name, side: row.side, current_value: row.current_value, sort_order });
        if (error) throw error;
      }
      update((d) => ({ ...d, balanceItems: [...d.balanceItems, row] }));
      await upsertValue(row.id, new Date(now.getFullYear(), now.getMonth(), 1), item.value);
    },
    [current, now, source, supabase, update, upsertValue],
  );

  const renameBalanceItem = useCallback(
    async (itemId: string, name: string) => {
      if (source === "supabase" && supabase) {
        const { error } = await supabase.from("balance_items").update({ name }).eq("id", itemId);
        if (error) throw error;
      }
      update((d) => ({ ...d, balanceItems: d.balanceItems.map((i) => (i.id === itemId ? { ...i, name } : i)) }));
    },
    [source, supabase, update],
  );

  const deleteBalanceItem = useCallback(
    async (itemId: string) => {
      // Soft delete, like every table, so other devices hear about it.
      if (source === "supabase" && supabase) {
        const { error } = await supabase.from("balance_items").update({ deleted_at: new Date().toISOString() }).eq("id", itemId);
        if (error) throw error;
      }
      update((d) => ({ ...d, balanceItems: d.balanceItems.filter((i) => i.id !== itemId), balanceValues: d.balanceValues.filter((v) => v.item_id !== itemId) }));
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
      value={{ data: phase.data, source: phase.source, now, email: phase.email, addTransaction, updateTransaction, addCategory, updateProfile, addBalanceItem, setBalanceValue, saveAccount, setBudget, renameBalanceItem, deleteBalanceItem, deleteTransaction, reorderCategories, signOut }}
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
