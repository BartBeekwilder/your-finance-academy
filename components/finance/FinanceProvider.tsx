"use client";

import { t } from "@/lib/i18n";
import { withSpread } from "@/lib/finance/spread";
import { useMarket } from "@/lib/finance/useMarket";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { buildDemoData } from "@/lib/finance/demo";
import type { FinanceDocument, Account, Achievement, ActivityDay, BalanceItem, BalanceValue, Budget, Category, FinanceData, Goal, InsurancePolicy, MonthClose, MortgagePartRow, Profile, Property, Transaction } from "@/lib/finance/types";
import { getSupabase } from "@/lib/supabase";
import SignIn, { RECOVERY_KEY } from "./SignIn";

// Single source of finance data for every /app screen: the signed-in user's
// rows from Supabase, or demo data when the visitor chooses it (or the site
// has no Supabase config). Screens read `data` and call the actions below;
// they never talk to Supabase directly.

export type NewTransaction = Omit<Transaction, "id" | "updated_at" | "deleted_at">;
export type NewCategory = Pick<Category, "name" | "icon" | "color_hex" | "is_income_category" | "is_fixed_expense"> & { parent_id?: string | null };

type FinanceState = {
  data: FinanceData;
  source: Source;
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
  /** Real estate: create or update a property / mortgage part (no id = new). */
  saveProperty: (p: Omit<Property, "updated_at" | "deleted_at" | "id"> & { id?: string }) => Promise<string>;
  deleteProperty: (id: string) => Promise<void>;
  saveMortgagePart: (m: Omit<MortgagePartRow, "updated_at" | "deleted_at" | "id"> & { id?: string }) => Promise<void>;
  deleteMortgagePart: (id: string) => Promise<void>;
  /** Progress: close a month (with its snapshot) and store new badges. */
  closeMonth: (month: Date, summary: MonthClose["summary"], points: number, badges: { code: string; points: number }[]) => Promise<void>;
  /** Stores badges earned outside a month close (e.g. adding a home). */
  awardBadges: (badges: { code: string; points: number }[]) => Promise<void>;
  saveGoal: (g: Omit<Goal, "updated_at" | "deleted_at" | "id"> & { id?: string }) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  /** Insurance: create or update a policy (no id = new). */
  savePolicy: (p: Omit<InsurancePolicy, "updated_at" | "deleted_at" | "id"> & { id?: string }) => Promise<void>;
  deletePolicy: (id: string) => Promise<void>;
  /** Creates a category (a subcategory when parent_id is set) at the end of
   *  its list; returns it. */
  addCategory: (c: NewCategory) => Promise<Category>;
  /** Renames / recolours / re-icons a category or flips fixed ↔ variable. */
  updateCategory: (id: string, patch: Partial<Pick<Category, "name" | "icon" | "color_hex" | "is_fixed_expense">>) => Promise<void>;
  /** Soft-deletes a category and its subcategories. Their transactions move
   *  to the parent (a subcategory) or become uncategorised (a top level). */
  deleteCategory: (id: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
  signOut: () => Promise<void>;
  /** The stored data as it is (no runtime spread parts or market values) —
   *  what an encrypted copy is made of. */
  storedData: () => FinanceData;
  /** Local mode: replace everything with a restored copy (saved to the file). */
  restoreLocal: (d: FinanceData) => void;
  /** Documents (payslips…): the file is stored first (/api/local-docs), this
   *  keeps its record with the data. Local mode only for now. */
  addDocument: (d: FinanceDocument) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
};

/** demo = built-in sample data; supabase = the signed-in account; local =
 *  the owner's private file on this Mac (dev only, see app/api/local-data). */
export type Source = "demo" | "supabase" | "local";

const FinanceContext = createContext<FinanceState | null>(null);
const DEMO_KEY = "pf-demo";
const LOCAL_KEY = "pf-local";
const LOCAL_API = "/api/local-data";
const DEV = process.env.NODE_ENV === "development";

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
  const [profile, accounts, categories, budgets, transactions, incomeRecords, holdings, balanceItems, balanceValues, properties, mortgageParts, monthCloses, goals, achievements, activityDays, insurancePolicies] = await Promise.all([
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
    optional(fetchAll<Property>(supabase, "properties", "sort_order")),
    optional(fetchAll<MortgagePartRow>(supabase, "mortgage_parts", "sort_order")),
    optional(fetchAll<MonthClose>(supabase, "month_closes", "month")),
    optional(fetchAll<Goal>(supabase, "goals", "sort_order")),
    optional(fetchAll<Achievement>(supabase, "achievements", "earned_at")),
    optional(fetchAll<ActivityDay>(supabase, "activity_days", "day")),
    optional(fetchAll<InsurancePolicy>(supabase, "insurance_policies", "sort_order")),
  ]);
  return { profile: profile ?? DEFAULT_PROFILE, accounts, categories, budgets, transactions, incomeRecords, holdings, balanceItems, balanceValues, properties, mortgageParts, monthCloses, goals, achievements, activityDays, insurancePolicies };
}

type Phase =
  | { kind: "starting" }
  | { kind: "signed-out" }
  | { kind: "loading"; session: Session }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: FinanceData; source: Source; email: string | null };

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

  // Dev only: is there a private data file on this Mac?
  const [hasLocal, setHasLocal] = useState(false);
  useEffect(() => {
    if (!DEV) return;
    fetch(LOCAL_API, { method: "GET", cache: "no-store" }).then((r) => setHasLocal(r.ok)).catch(() => {});
  }, []);

  const startLocal = useCallback(async () => {
    const r = await fetch(LOCAL_API, { cache: "no-store" });
    if (!r.ok) return setPhase({ kind: "error", message: "No local data file (.private/finance.json)." });
    const empty: FinanceData = { profile: DEFAULT_PROFILE, accounts: [], categories: [], budgets: [], transactions: [], incomeRecords: [], holdings: [], balanceItems: [], balanceValues: [], properties: [], mortgageParts: [], monthCloses: [], goals: [], achievements: [], activityDays: [], insurancePolicies: [] };
    const data = { ...empty, ...((await r.json()) as Partial<FinanceData>) };
    try {
      sessionStorage.setItem(LOCAL_KEY, "1");
    } catch {}
    setPhase({ kind: "ready", data, source: "local", email: null });
  }, []);

  // Follow the auth session: signed in → load that user's data.
  useEffect(() => {
    let demo = false, local = false;
    try {
      // Dev only: /app?local=1 opens the private data straight away.
      if (DEV && new URLSearchParams(location.search).get("local") === "1") {
        sessionStorage.removeItem(DEMO_KEY);
        sessionStorage.setItem(LOCAL_KEY, "1");
      }
      demo = sessionStorage.getItem(DEMO_KEY) === "1";
      local = DEV && sessionStorage.getItem(LOCAL_KEY) === "1";
    } catch {}
    if (local) {
      queueMicrotask(() => void startLocal());
      return;
    }
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
  }, [supabase, startDemo, startLocal]);

  const update = useCallback((fn: (d: FinanceData) => FinanceData) => {
    setPhase((p) => (p.kind === "ready" ? { ...p, data: fn(p.data) } : p));
  }, []);

  const source = phase.kind === "ready" ? phase.source : "demo";

  // gross_amount is only sent when set, so saving keeps working on a database
  // without migration 0007 as long as no gross is entered.
  // …same for spread_months (0008) and person_id (0010). Runtime-only spread
  // fields never go out.
  const withoutEmptyGross = (t: NewTransaction) => {
    const { gross_amount, spread_months, person_id, spread_of: _o, spread_index: _i, spread_total: _n, ...rest } = t;
    void _o; void _i; void _n;
    return { ...rest, ...(gross_amount != null ? { gross_amount } : {}), ...(spread_months != null ? { spread_months } : {}), ...(person_id != null ? { person_id } : {}) };
  };

  const addTransaction = useCallback(
    async (t: NewTransaction) => {
      const row: Transaction = { ...t, id: crypto.randomUUID(), updated_at: new Date().toISOString(), deleted_at: null };
      if (source === "supabase" && supabase) {
        const { data, error } = await supabase.from("transactions").insert({ ...withoutEmptyGross(t), id: row.id }).select().single();
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
        const had = (phase.kind === "ready" ? phase.data.transactions : []).find((x) => x.id === id)?.gross_amount != null;
        const before = (phase.kind === "ready" ? phase.data.transactions : []).find((x) => x.id === id);
        const out = withoutEmptyGross(t) as Record<string, unknown>;
        if (had) out.gross_amount = t.gross_amount ?? null;
        if (before?.spread_months != null) out.spread_months = t.spread_months ?? null;
        if (before?.person_id != null) out.person_id = t.person_id ?? null;
        const { error } = await supabase.from("transactions").update(out).eq("id", id);
        if (error) throw error;
      }
      update((d) => ({ ...d, transactions: d.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort((a, b) => b.date.localeCompare(a.date)) }));
    },
    [source, supabase, update, phase],
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

  // Local mode: every change is written back to the private file (debounced;
  // the stored data never contains the runtime spread parts).
  const localData = phase.kind === "ready" && phase.source === "local" ? phase.data : null;
  useEffect(() => {
    if (!localData) return;
    const id = setTimeout(() => {
      fetch(LOCAL_API, { method: "PUT", body: JSON.stringify(localData, null, 1) }).catch(() => {});
    }, 600);
    return () => clearTimeout(id);
  }, [localData]);
  // What every screen sees: spread expenses as their monthly parts.
  // …and investments with their live market value (for the balance sheet).
  const market = useMarket(current);
  const shown = useMemo(() => (current ? { ...withSpread(current), market } : null), [current, market]);

  const addCategory = useCallback(
    async (c: NewCategory) => {
      const sort_order = Math.max(-1, ...(current?.categories ?? []).map((x) => x.sort_order)) + 1;
      const fields = { ...c, is_default: false, sort_order, parent_id: c.parent_id ?? null };
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

  const updateCategory = useCallback(
    async (id: string, patch: Partial<Pick<Category, "name" | "icon" | "color_hex" | "is_fixed_expense">>) => {
      if (source === "supabase" && supabase) {
        const { error } = await supabase.from("categories").update(patch).eq("id", id);
        if (error) throw error;
      }
      update((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c)) }));
    },
    [source, supabase, update],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      if (!current) return;
      const cat = current.categories.find((c) => c.id === id);
      if (!cat) return;
      const gone = new Set([id, ...current.categories.filter((c) => c.parent_id === id).map((c) => c.id)]);
      const moveTo = cat.parent_id; // a sub's transactions go to its parent
      const stamp = new Date().toISOString();
      if (source === "supabase" && supabase) {
        const ids = [...gone];
        const r1 = await supabase.from("transactions").update({ category_id: moveTo }).in("category_id", ids);
        if (r1.error) throw r1.error;
        const r2 = await supabase.from("budgets").update({ deleted_at: stamp }).in("category_id", ids);
        if (r2.error) throw r2.error;
        const r3 = await supabase.from("categories").update({ deleted_at: stamp }).in("id", ids);
        if (r3.error) throw r3.error;
      }
      update((d) => ({
        ...d,
        categories: d.categories.filter((c) => !gone.has(c.id)),
        transactions: d.transactions.map((t) => (t.category_id && gone.has(t.category_id) ? { ...t, category_id: moveTo } : t)),
        budgets: d.budgets.filter((b) => !(b.category_id && gone.has(b.category_id))),
      }));
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

  // ---- Progress ---------------------------------------------------------------
  const insertRows = useCallback(
    async <K extends "monthCloses" | "achievements" | "activityDays">(key: K, table: string, rows: Omit<FinanceData[K][number], "updated_at" | "deleted_at">[]) => {
      if (!rows.length) return;
      if (source === "supabase" && supabase) {
        const { error } = await supabase.from(table).insert(rows as never);
        if (error && !/duplicate/.test(error.message)) throw error;
      }
      const stamped = rows.map((r) => ({ ...r, updated_at: new Date().toISOString(), deleted_at: null })) as FinanceData[K];
      update((d) => ({ ...d, [key]: [...(d[key] as FinanceData[K]), ...stamped] }));
    },
    [source, supabase, update],
  );

  const awardBadges = useCallback(
    async (badges: { code: string; points: number }[]) => {
      const have = new Set((current?.achievements ?? []).filter((a) => !a.deleted_at).map((a) => a.code));
      const fresh = badges.filter((b) => !have.has(b.code));
      await insertRows("achievements", "achievements", fresh.map((b) => ({ id: crypto.randomUUID(), code: b.code, points: b.points, earned_at: new Date().toISOString() })));
    },
    [current, insertRows],
  );

  const closeMonth = useCallback(
    async (month: Date, summary: MonthClose["summary"], points: number, badges: { code: string; points: number }[]) => {
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
      await insertRows("monthCloses", "month_closes", [{ id: crypto.randomUUID(), month: key, closed_at: new Date().toISOString(), summary, points }]);
      await awardBadges(badges);
    },
    [insertRows, awardBadges],
  );

  // One activity row per day the app is used (streaks).
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const hasToday = !!current?.activityDays?.some((a) => a.day.slice(0, 10) === today && !a.deleted_at);
  useEffect(() => {
    if (current && !hasToday) queueMicrotask(() => void insertRows("activityDays", "activity_days", [{ id: crypto.randomUUID(), day: today }]).catch(() => {}));
  }, [current, hasToday, today, insertRows]);


  // ---- Real estate ------------------------------------------------------------
  // Generic upsert/soft-delete for the two real-estate tables.
  const upsertRow = useCallback(
    async <K extends "properties" | "mortgageParts" | "goals" | "insurancePolicies">(key: K, table: string, row: Omit<FinanceData[K][number], "updated_at" | "deleted_at" | "id"> & { id?: string }) => {
      const list = (current?.[key] ?? []) as FinanceData[K];
      const existing = row.id ? list.find((x) => x.id === row.id) : undefined;
      const id = row.id ?? crypto.randomUUID();
      const { id: _drop, ...fields } = row;
      void _drop;
      if (source === "supabase" && supabase) {
        const { error } = existing ? await supabase.from(table).update(fields).eq("id", id) : await supabase.from(table).insert({ ...fields, id });
        if (error) throw error;
      }
      const full = { ...(existing ?? {}), ...fields, id, updated_at: new Date().toISOString(), deleted_at: null } as FinanceData[K][number];
      update((d) => ({ ...d, [key]: [...(d[key] as FinanceData[K]).filter((x) => x.id !== id), full] }));
      return id;
    },
    [current, source, supabase, update],
  );
  const softDelete = useCallback(
    async (key: "properties" | "mortgageParts" | "goals" | "insurancePolicies", table: string, id: string) => {
      if (source === "supabase" && supabase) {
        const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      }
      update((d) => ({
        ...d,
        [key]: (d[key] as { id: string }[]).filter((x) => x.id !== id),
        ...(key === "properties" ? { mortgageParts: d.mortgageParts.filter((m) => m.property_id !== id) } : {}),
      }));
    },
    [source, supabase, update],
  );
  const saveProperty = useCallback((p: Parameters<FinanceState["saveProperty"]>[0]) => upsertRow("properties", "properties", p), [upsertRow]);
  const deleteProperty = useCallback((id: string) => softDelete("properties", "properties", id), [softDelete]);
  const saveMortgagePart = useCallback(async (m: Parameters<FinanceState["saveMortgagePart"]>[0]) => { await upsertRow("mortgageParts", "mortgage_parts", m); }, [upsertRow]);
  const deleteMortgagePart = useCallback((id: string) => softDelete("mortgageParts", "mortgage_parts", id), [softDelete]);
  const saveGoal = useCallback(async (g: Parameters<FinanceState["saveGoal"]>[0]) => { await upsertRow("goals", "goals", g); }, [upsertRow]);
  const deleteGoal = useCallback((id: string) => softDelete("goals", "goals", id), [softDelete]);
  const savePolicy = useCallback(async (x: Parameters<FinanceState["savePolicy"]>[0]) => { await upsertRow("insurancePolicies", "insurance_policies", x); }, [upsertRow]);
  const deletePolicy = useCallback((id: string) => softDelete("insurancePolicies", "insurance_policies", id), [softDelete]);

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
      sessionStorage.removeItem(LOCAL_KEY);
    } catch {}
    if (phase.kind === "ready" && phase.source === "local") return setPhase(supabase ? { kind: "signed-out" } : { kind: "starting" });
    if (!supabase) return startDemo(); // demo is the only mode without Supabase config
    await supabase.auth.signOut();
    setPhase({ kind: "signed-out" });
  }, [supabase, startDemo, phase]);

  const storedData = useCallback(() => (phase.kind === "ready" ? phase.data : (null as unknown as FinanceData)), [phase]);
  const restoreLocal = useCallback((d: FinanceData) => {
    setPhase((p) => (p.kind === "ready" && p.source === "local" ? { ...p, data: d } : p));
  }, []);

  const addDocument = useCallback(async (d: FinanceDocument) => {
    if (source !== "local") throw new Error("Documents can be kept with local data for now.");
    update((x) => ({ ...x, documents: [...(x.documents ?? []), d] }));
  }, [source, update]);
  const removeDocument = useCallback(async (id: string) => {
    if (source === "local") await fetch(`${LOCAL_API.replace("local-data", "local-docs")}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    update((x) => ({ ...x, documents: (x.documents ?? []).filter((d) => d.id !== id) }));
  }, [source, update]);

  if (phase.kind === "signed-out")
    return (
      <div className="pf-solo">
        <SignIn onDemo={startDemo} onLocal={hasLocal ? () => void startLocal() : undefined} />
      </div>
    );
  if (phase.kind === "error")
    return (
      <div className="pf-solo">
        <div className="pf-card" style={{ padding: 20, maxWidth: 480 }}>
          <strong>{t("Couldn't load your data")}</strong>
          <p style={{ color: "var(--pf-ink-2)", margin: "6px 0 14px" }}>{phase.message}</p>
          <button className="pf-button" onClick={() => location.reload()}>{t("Try again")}</button>
        </div>
      </div>
    );
  if (phase.kind !== "ready") return <div className="pf-solo pf-loading" aria-busy="true" />;

  return (
    <FinanceContext.Provider
      value={{ data: shown ?? phase.data, source: phase.source, now, email: phase.email, addTransaction, updateTransaction, addCategory, updateCategory, deleteCategory, updateProfile, addBalanceItem, setBalanceValue, saveAccount, setBudget, saveProperty, deleteProperty, saveMortgagePart, deleteMortgagePart, closeMonth, awardBadges, saveGoal, deleteGoal, savePolicy, deletePolicy, renameBalanceItem, deleteBalanceItem, deleteTransaction, reorderCategories, signOut, storedData, restoreLocal, addDocument, removeDocument }}
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
