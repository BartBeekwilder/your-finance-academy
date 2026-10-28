"use client";

import { t } from "@/lib/i18n";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Banknote, Check, CreditCard, Hourglass, Landmark, PiggyBank, Plus, Sparkles, Trash2, Wallet, X } from "lucide-react";
import { closeTransactionEditor, useTransactionEditor } from "@/lib/finance/editTransaction";
import { live } from "@/lib/finance/calc";
import { evalAmount } from "@/lib/finance/amountExpr";
import { isSalaryName, mainIncomeCategory, nearestPayday } from "@/lib/finance/salary";
import { money, shortMonthYear } from "@/lib/finance/format";
import type { Account, HouseholdMember, Transaction, TransactionType } from "@/lib/finance/types";
import { householdOf } from "@/lib/finance/household";
import CategoryEditor from "./CategoryEditor";
import CategoryIcon from "./CategoryIcon";
import { useFinance } from "./FinanceProvider";
import Segmented from "./Segmented";
import Sheet from "./Sheet";

// Web counterpart of the iOS QuickAddButton + AddEditTransactionView: the
// gradient "+" opens a sheet to log an expense or income. Category choice
// pre-fills "fixed" from the category's default, as on iOS. The last chip,
// "New category", opens a small editor in place (name, colour, icon); the
// new category is saved for the current type and selected straight away.

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function QuickAdd() {
  const { data, addTransaction, updateTransaction, deleteTransaction, addCategory, updateProfile } = useFinance();
  const salaryCategory = useMemo(() => mainIncomeCategory(data.transactions, Number(data.profile.expected_net_monthly) || 0), [data.transactions, data.profile.expected_net_monthly]);
  // Any transaction row can ask for the editor; it opens in this same sheet.
  const editing = useTransactionEditor();
  const [open, setOpen] = useState(false);
  // New key per opening, so the form starts empty every time (the sheet
  // keeps its content mounted for the closing animation).
  const [session, setSession] = useState(0);
  const [from, setFrom] = useState<Element | null>(null);
  // Other places can open Quick Add (the dashboard's "Last updated" pill).
  useEffect(() => {
    const open = () => {
      setFrom(null);
      setSession((n) => n + 1);
      setOpen(true);
    };
    window.addEventListener("pf-quick-add", open);
    return () => window.removeEventListener("pf-quick-add", open);
  }, []);

  return (
    <>
      <button
        className="pf-fab pf-bouncy"
        aria-label={t("Quick Add")}
        onClick={(e) => {
          setFrom(e.currentTarget);
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        <Plus size={22} strokeWidth={3} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} origin={from} focus="input[inputmode=decimal]" label={t("Quick Add")}>
        <Form key={session} past={data.transactions} salaryCategory={salaryCategory} payday={data.profile.payday_day} setPayday={(d) => updateProfile({ payday_day: d })} currency={data.profile.currency_code} grossRatio={grossRatio(data.profile)} categories={live(data.categories)} accounts={live(data.accounts)} household={householdOf(data.profile)} onDone={() => setOpen(false)} add={addTransaction} addCategory={addCategory} />
      </Sheet>
      <Sheet open={!!editing?.open} onClose={closeTransactionEditor} origin={editing?.origin} label={t("Edit transaction")}>
        {editing && (
          <Form
            key={`edit${editing.n}`}
            initial={editing.transaction}
            currency={data.profile.currency_code}
            grossRatio={grossRatio(data.profile)}
            categories={live(data.categories)}
            accounts={live(data.accounts)}
            household={householdOf(data.profile)}
            payday={data.profile.payday_day}
            salaryCategory={salaryCategory}
            setPayday={(d) => updateProfile({ payday_day: d })}
            onDone={closeTransactionEditor}
            add={(t) => updateTransaction(editing.transaction.id, t)}
            onDelete={() => deleteTransaction(editing.transaction.id)}
            addCategory={addCategory}
          />
        )}
      </Sheet>
    </>
  );
}

/** Expected gross ÷ net from the profile (1 when unknown), to suggest a
 *  gross amount for a net income. */
function grossRatio(p: { expected_gross_monthly: string | number | null; expected_net_monthly: string | number | null }) {
  const g = Number(p.expected_gross_monthly), n = Number(p.expected_net_monthly);
  return g > 0 && n > 0 ? g / n : 1;
}

function Form({
  currency,
  grossRatio = 1,
  categories,
  accounts = [],
  household = [],
  add,
  addCategory,
  onDone,
  initial,
  onDelete,
  past = [],
  payday = null,
  setPayday,
  salaryCategory = null,
}: {
  /** The income category the salary usually lands in (besides salary-like names). */
  salaryCategory?: string | null;
  /** The profile's payday (day of the month), and a way to change it. */
  payday?: number | null;
  setPayday?: (day: number) => Promise<void>;
  /** Earlier transactions: a description used before fills in its category
   *  and account (new transactions only). */
  past?: Transaction[];
  /** Accounts to pay from / receive on. */
  accounts?: Account[];
  /** Two or more people: income "from", expense "paid by". */
  household?: HouseholdMember[];
  /** Editing an existing transaction: its values fill the form. */
  initial?: Transaction;
  onDelete?: () => Promise<void>;
  currency: string;
  /** Profile's gross ÷ net, for the gross suggestion. */
  grossRatio?: number;
  categories: ReturnType<typeof useFinance>["data"]["categories"];
  add: ReturnType<typeof useFinance>["addTransaction"];
  addCategory: ReturnType<typeof useFinance>["addCategory"];
  onDone: () => void;
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? Number(initial.amount).toFixed(2).replace(".", ",") : "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [date, setDate] = useState(() => (initial ? localDate(initial.date) : todayLocal()));
  const [note, setNote] = useState(initial?.note ?? "");
  // Income: the amount is net (what came in); gross is optional.
  const [gross, setGross] = useState(initial?.gross_amount ? Number(initial.gross_amount).toFixed(2).replace(".", ",") : "");
  const [fixed, setFixed] = useState(initial?.is_fixed_expense ?? false);
  // Expense: spread a big purchase over N months (null = book it at once).
  const [spread, setSpread] = useState<number | null>(initial?.spread_months ?? null);
  // Which account it comes off (or goes to): the transaction's own, else the
  // one used last in this browser, else the default account.
  const payable = accounts.filter((a) => a.type !== "investment");
  const [accountId, setAccountId] = useState<string | null>(() => {
    if (initial) return initial.account_id;
    let last: string | null = null;
    try {
      last = localStorage.getItem("pf-last-account");
    } catch {}
    return payable.find((a) => a.id === last)?.id ?? payable.find((a) => a.is_default)?.id ?? payable[0]?.id ?? null;
  });
  // Whose income / who paid: the transaction's own, else the last choice
  // per kind in this browser; an income defaults to the first person, an
  // expense to shared.
  const [personId, setPersonId] = useState<string | null>(() => {
    if (initial) return initial.person_id ?? null;
    let last: string | null = null;
    try {
      last = localStorage.getItem("pf-last-person-expense");
    } catch {}
    return household.find((m) => m.id === last)?.id ?? null;
  });
  // What the person picked by hand in this form; a remembered description
  // never overrides those.
  const [touched, setTouched] = useState({ category: !!initial, account: !!initial });
  const [remembered, setRemembered] = useState<string | null>(null);
  // Latest transaction per description (lower-cased), per type.
  const memory = useMemo(() => {
    const m = new Map<string, Transaction>();
    for (const tx of past) {
      const k = tx.note?.trim().toLowerCase();
      if (!k || tx.deleted_at) continue;
      const key = `${tx.type}:${k}`;
      const had = m.get(key);
      if (!had || had.date < tx.date) m.set(key, tx);
    }
    return m;
  }, [past]);
  const suggestions = useMemo(() => {
    const names = new Map<string, string>();
    for (const [key, tx] of memory) if (key.startsWith(`${type}:`)) names.set(key, tx.note!.trim());
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [memory, type]);
  function recall(text: string) {
    const tx = memory.get(`${type}:${text.trim().toLowerCase()}`);
    if (!tx) return setRemembered(null);
    const cat = categories.find((c) => c.id === tx.category_id);
    const changed: string[] = [];
    if (!touched.category && cat && cat.id !== categoryId) {
      setCategoryId(cat.id);
      setFixed(cat.is_fixed_expense);
      changed.push(cat.id);
    }
    if (!touched.account && tx.account_id !== accountId && (tx.account_id === null ? type === "income" : payable.some((a) => a.id === tx.account_id))) {
      setAccountId(tx.account_id);
      changed.push(tx.account_id ?? "pending");
    }
    if (changed.length) setRemembered(changed.join(","));
  }

  // Salary: the date starts on the nearest payday (unless picked by hand),
  // and a salary on another day can become the new payday.
  const [dateTouched, setDateTouched] = useState(!!initial);
  const [isPayday, setIsPayday] = useState(false);
  const picked = categories.find((c) => c.id === categoryId);
  const pickedTop = categories.find((c) => c.id === (picked?.parent_id ?? picked?.id));
  const salaryPicked = type === "income" && !!picked && (isSalaryName(picked.name) || isSalaryName(pickedTop?.name) || pickedTop?.id === salaryCategory);
  useEffect(() => {
    if (!salaryPicked || dateTouched || !payday) return;
    const d = nearestPayday(payday, new Date());
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }, [salaryPicked, dateTouched, payday]);
  const pickedDay = Number(date.slice(8, 10));
  const offerPayday = salaryPicked && !!setPayday && pickedDay > 0 && pickedDay !== payday;

  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  // Top-level categories as chips; once one is picked, its subcategories
  // (if any) appear underneath as an optional finer choice.
  const choices = useMemo(
    () => categories.filter((c) => c.is_income_category === (type === "income") && !c.parent_id).sort((a, b) => a.sort_order - b.sort_order),
    [categories, type],
  );
  const selected = categories.find((c) => c.id === categoryId);
  const parentId = selected?.parent_id ?? selected?.id ?? null;
  const subs = useMemo(
    () => (parentId ? categories.filter((c) => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order) : []),
    [categories, parentId],
  );

  const parent = categories.find((c) => c.id === parentId);
  // Typing a new subcategory under the picked category (null = closed).
  const [newSub, setNewSub] = useState<string | null>(null);
  async function saveSub() {
    const name = newSub?.trim();
    if (!name || !parent) return;
    const same = subs.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const row = same ?? (await addCategory({ name, icon: parent.icon, color_hex: parent.color_hex, is_income_category: parent.is_income_category, is_fixed_expense: parent.is_fixed_expense, parent_id: parent.id }));
    setNewSub(null);
    setCategoryId(row.id);
    setFixed(row.is_fixed_expense);
    setFresh(row.id);
  }

  // Accept "12,50" as well as "12.50" — Dutch keyboards type a comma — and
  // a sum as on a receipt ("1,22+12,52+13,15").
  const sum = evalAmount(amount);
  const parsed = sum?.value ?? NaN;
  const valid = parsed > 0 && Number.isFinite(parsed);
  const grossParsed = evalAmount(gross)?.value ?? 0;
  const spreading = type === "expense" && spread != null && spread >= 2;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      // Noon local time, so the date never shifts a day across time zones.
      const [y, m, d] = date.split("-").map(Number);
      await add({
        amount: parsed.toFixed(2),
        type,
        date: new Date(y, m - 1, d, 12).toISOString(),
        note: note.trim() || null,
        is_auto_income: initial?.is_auto_income ?? false,
        gross_amount: type === "income" && grossParsed > 0 ? grossParsed.toFixed(2) : null,
        is_fixed_expense: type === "expense" && fixed,
        spread_months: spreading ? spread : null,
        recurrence_id: initial?.recurrence_id ?? null,
        category_id: categoryId,
        account_id: accountId,
        person_id: household.length ? (type === "income" ? (personId ?? household[0].id) : personId) : (initial?.person_id ?? null),
      });
      try {
        if (household.length) localStorage.setItem(`pf-last-person-${type}`, (type === "income" ? (personId ?? household[0].id) : personId) ?? "");
      } catch {}
      try {
        if (accountId) localStorage.setItem("pf-last-account", accountId);
      } catch {}
      if (offerPayday && isPayday) await setPayday!(pickedDay);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{initial ? type === "expense" ? t("Edit expense") : t("Edit income") : t("Quick Add")}</h2>
        <button type="button" className="pf-icon-button" aria-label={t("Close")} onClick={onDone}><X size={18} /></button>
      </div>

      <Segmented
        wide
        label={t("Type")}
        value={type}
        onChange={(t) => { setType(t); setCategoryId(null); setCreating(false); setTouched((x) => ({ ...x, category: false })); setRemembered(null); }}
        options={[{ value: "expense", label: t("Expense") }, { value: "income", label: t("Income") }]}
      />

      <input
        className="pf-input pf-rounded"
        inputMode="decimal"
        placeholder={money(0, currency)}
        aria-label={t("Amount")}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => {
          // A finished sum becomes its result, so the field reads as an amount.
          if (sum?.isSum && valid) setAmount(parsed.toFixed(2).replace(".", ","));
        }}
        style={{ fontSize: "2rem", fontWeight: 700, textAlign: "center", color: type === "income" ? "var(--pf-green)" : "var(--pf-ink)" }}
      />
      {sum?.isSum && (
        <span key={parsed} className="pf-amount-sum pf-readout pf-rounded" data-bad={!valid || undefined}>
          = {valid ? money(parsed, currency) : t("not a valid amount")}
        </span>
      )}

      {type === "income" && (
        <div className="pf-gross">
          <label className="pf-gross-field">
            <span>{t("Net received")}</span>
            <b className="pf-rounded">{valid ? money(parsed, currency) : "—"}</b>
          </label>
          <label className="pf-gross-field">
            <span>{t("Gross (optional)")}</span>
            <input
              className="pf-input pf-rounded"
              inputMode="decimal"
              aria-label={t("Gross (optional)")}
              placeholder={valid && grossRatio > 1 ? money(Math.round(parsed * grossRatio * 100) / 100, currency) : money(0, currency)}
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              onKeyDown={(e) => {
                // Tab on an empty field takes the suggestion.
                if (e.key === "Tab" && !gross && valid && grossRatio > 1) setGross((Math.round(parsed * grossRatio * 100) / 100).toFixed(2).replace(".", ","));
              }}
            />
          </label>
          {grossParsed > 0 && valid && (
            <span key={Math.round(grossParsed - parsed)} className="pf-gross-deductions pf-readout">
              {grossParsed >= parsed
                ? t("Deductions {amount} ({pct}%)", { amount: money(grossParsed - parsed, currency), pct: Math.round(((grossParsed - parsed) / grossParsed) * 100) })
                : t("Gross is lower than net")}
            </span>
          )}
        </div>
      )}

      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", marginBottom: 8 }}>{t("Category")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setCategoryId(c.id); setFixed(c.is_fixed_expense); setNewSub(null); setTouched((x) => ({ ...x, category: true })); }}
              className="pf-chip"
              aria-pressed={parentId === c.id}
              data-fresh={fresh === c.id || (remembered?.split(",").includes(categoryId ?? "") && parentId === c.id) || undefined}
              style={parentId === c.id ? { borderColor: `#${c.color_hex}`, background: `#${c.color_hex}33` } : undefined}
            >
              <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={20} />
              {c.name}
            </button>
          ))}
          {!creating && (
            <button type="button" className="pf-chip pf-chip-new" onClick={() => setCreating(true)}>
              <span className="pf-chip-new-icon"><Plus size={14} strokeWidth={3} /></span>
              {t("New category")}
            </button>
          )}
        </div>
        {selected && !creating && (
          <div key={parentId} className="pf-subchips">
            {/* While a new one is being typed, the label says what the field is for. */}
            <span style={{ fontSize: "0.72rem", color: newSub === null ? "var(--pf-ink-3)" : "var(--pf-ink)" }}>
              {newSub === null ? t("Subcategory (optional)") : t("New subcategory in {category}", { category: parent?.name ?? "" })}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {subs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="pf-chip pf-chip-sm"
                  aria-pressed={categoryId === c.id}
                  data-fresh={fresh === c.id || undefined}
                  onClick={() => {
                    // Tapping the chosen sub again goes back to just the parent.
                    const back = categoryId === c.id;
                    setTouched((x) => ({ ...x, category: true }));
                    const next = back ? categories.find((x) => x.id === parentId) : c;
                    setCategoryId(next?.id ?? null);
                    if (next) setFixed(next.is_fixed_expense);
                  }}
                  style={categoryId === c.id ? { borderColor: `#${c.color_hex}`, background: `#${c.color_hex}33` } : undefined}
                >
                  <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={16} />
                  {c.name}
                </button>
              ))}
              {newSub === null ? (
                <button type="button" className="pf-chip pf-chip-sm pf-chip-new" onClick={() => setNewSub("")}>
                  <span className="pf-chip-new-icon" style={{ width: 16, height: 16, borderRadius: 5 }}><Plus size={11} strokeWidth={3} /></span>
                  {t("Subcategory")}
                </button>
              ) : (
                // A new subcategory takes its parent's icon and colour; the
                // categories page can change those later.
                <span className="pf-chip pf-chip-sm pf-subnew">
                  {parent && <CategoryIcon icon={parent.icon} colorHex={parent.color_hex} size={16} />}
                  <input
                    autoFocus
                    aria-label={t("New subcategory")}
                    placeholder={t("e.g. {example}", { example: subExample(parent?.name) })}
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setNewSub(null); }
                      if (e.key === "Enter") { e.preventDefault(); void saveSub(); }
                    }}
                    onBlur={() => { if (!newSub.trim()) setNewSub(null); }}
                  />
                  <button type="button" className="pf-subnew-ok" disabled={!newSub.trim()} onMouseDown={(e) => e.preventDefault()} onClick={() => void saveSub()} aria-label={t("Add")}>
                    <Check size={13} strokeWidth={3} />
                  </button>
                  <button type="button" className="pf-subnew-cancel" onMouseDown={(e) => e.preventDefault()} onClick={() => setNewSub(null)} aria-label={t("Cancel")}>
                    <X size={13} strokeWidth={3} />
                  </button>
                </span>
              )}
            </div>
            {newSub !== null && <span style={{ fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>{t("Type the name here, then ✓ or Enter.")}</span>}
          </div>
        )}
        {creating && (
          <CategoryEditor
            type={type}
            taken={choices.map((c) => c.name.toLowerCase())}
            onCancel={() => setCreating(false)}
            onSave={async (c) => {
              const row = await addCategory({ ...c, is_income_category: type === "income", is_fixed_expense: false });
              setCreating(false);
              setCategoryId(row.id);
              setFixed(false);
              setFresh(row.id);
            }}
          />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input className="pf-input" type="date" aria-label={t("Date")} value={date} onChange={(e) => { setDate(e.target.value); setDateTouched(true); }} required />
        <input
          className="pf-input"
          placeholder={t("Note")}
          aria-label={t("Note")}
          list={initial ? undefined : "pf-note-memory"}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (!initial) recall(e.target.value);
          }}
        />
        {!initial && (
          <datalist id="pf-note-memory">
            {suggestions.map((n) => <option key={n} value={n} />)}
          </datalist>
        )}
      </div>
      {remembered && (
        <span key={remembered} className="pf-remembered pf-readout">
          <Sparkles size={12} /> {t("Filled in like last time")}
        </span>
      )}

      {offerPayday && (
        <label key={pickedDay} className="pf-payday-offer">
          <input type="checkbox" checked={isPayday} onChange={(e) => setIsPayday(e.target.checked)} />
          {t("This is my payday")}{" "}
          <span style={{ color: "var(--pf-ink-3)" }}>
            {payday ? t("— day {n} from now on (was day {old})", { n: pickedDay, old: payday }) : t("— day {n} from now on", { n: pickedDay })}
          </span>
        </label>
      )}

      {household.length > 0 && (
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", marginBottom: 8 }}>{type === "expense" ? t("Paid by") : t("From")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {type === "expense" && (
              <button type="button" className="pf-chip pf-acct-chip" aria-pressed={personId === null} onClick={() => setPersonId(null)}>
                <span className="pf-acct-icon" style={{ background: "linear-gradient(135deg, " + household.map((m) => m.color).join(", ") + ")" }} />
                {t("Shared")}
              </button>
            )}
            {household.map((m) => {
              const on = type === "income" ? (personId ?? household[0].id) === m.id : personId === m.id;
              return (
                <button key={m.id} type="button" className="pf-chip pf-acct-chip" aria-pressed={on} onClick={() => setPersonId(m.id)}>
                  <span className="pf-acct-icon" style={{ background: m.color }}>{m.name.slice(0, 1).toUpperCase()}</span>
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {payable.length > 0 && (
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", marginBottom: 8 }}>{type === "expense" ? t("Paid with") : t("Received on")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {type === "income" && (
              <button type="button" className="pf-chip pf-acct-chip" aria-pressed={accountId === null} onClick={() => { setAccountId(null); setTouched((x) => ({ ...x, account: true })); }} title={t("Not on an account yet — shows under Amounts to receive")}>
                <span className="pf-acct-icon" style={{ background: "#66d4cf" }}>
                  <Hourglass size={12} strokeWidth={2.4} />
                </span>
                {t("Still to receive")}
              </button>
            )}
            {payable.map((a) => {
              const Icon = ACCOUNT_ICON[a.type] ?? Wallet;
              return (
                <button key={a.id} type="button" className="pf-chip pf-acct-chip" aria-pressed={accountId === a.id} onClick={() => { setAccountId(type === "income" || accountId !== a.id ? a.id : null); setTouched((x) => ({ ...x, account: true })); }}>
                  <span className="pf-acct-icon" data-type={a.type}>
                    <Icon size={13} strokeWidth={2.4} />
                  </span>
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {type === "expense" && !spreading && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem" }}>
          <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
          {t("Fixed expense")} <span style={{ color: "var(--pf-ink-3)" }}>{t("— same amount every month")}</span>
        </label>
      )}

      {type === "expense" && (
        <SpreadPicker months={spread} onChange={setSpread} amount={valid ? parsed : 0} date={date} currency={currency} />
      )}

      {error && <p style={{ margin: 0, color: "var(--pf-red)", fontSize: "0.85rem" }}>{error}</p>}

      <button className="pf-button" disabled={!valid || saving}>
        {saving ? t("Saving…") : initial ? t("Save changes") : type === "expense" ? t("Add expense") : t("Add income")}
      </button>

      {onDelete && (
        <button
          type="button"
          className="pf-delete-button"
          data-confirm={confirming}
          disabled={saving}
          onClick={async () => {
            // First tap arms it, second tap deletes.
            if (!confirming) return setConfirming(true);
            setSaving(true);
            try {
              await onDelete();
              onDone();
            } catch (err) {
              setError((err as Error).message);
              setSaving(false);
            }
          }}
          onBlur={() => setConfirming(false)}
        >
          <Trash2 size={15} /> {confirming ? (type === "expense" ? t("Tap again to delete this expense") : t("Tap again to delete this income")) : t("Delete")}
        </button>
      )}
    </form>
  );
}

/** A placeholder for a new subcategory that fits the parent, where known. */
function subExample(parent?: string) {
  const n = (parent ?? "").toLowerCase();
  if (/bood|grocer/.test(n)) return t("Bakery");
  if (/uitgaan|going out|dining|eten/.test(n)) return t("Restaurant");
  if (/auto|car/.test(n)) return t("Parking");
  if (/wonen|home|housing/.test(n)) return t("Furniture");
  return t("Something specific");
}

const ACCOUNT_ICON: Partial<Record<Account["type"], typeof Wallet>> = { checking: Landmark, savings: PiggyBank, credit: CreditCard, cash: Banknote };

const SPREAD_CHOICES = [6, 12, 24, 36, 48, 60];

/** "Spread out": book a big purchase (a laptop, a sofa) as a monthly cost
 *  over the months you'll use it, instead of one big dip. The money still
 *  leaves your account at once; the balance sheet keeps the unused part as
 *  "Spread purchases" until it's used up. */
function SpreadPicker({ months, onChange, amount, date, currency }: { months: number | null; onChange: (m: number | null) => void; amount: number; date: string; currency: string }) {
  const on = months != null;
  const custom = on && !SPREAD_CHOICES.includes(months);
  const [y, m] = date.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = on ? new Date(y, m - 1 + months - 1, 1) : first;
  const label = (n: number) => (n < 12 ? t("{n} mo", { n }) : n === 12 ? t("1 yr") : t("{n} yrs", { n: n / 12 }));
  return (
    <div className={`pf-spread${on ? " is-on" : ""}`}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem" }}>
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? 48 : null)} />
        {t("Spread out")} <span style={{ color: "var(--pf-ink-3)" }}>{t("— count it monthly over the time you use it")}</span>
      </label>
      {on && (
        <div className="pf-spread-body">
          <div className="pf-spread-chips">
            {SPREAD_CHOICES.map((n) => (
              <button key={n} type="button" className={`pf-spread-chip${months === n ? " is-active" : ""}`} onClick={() => onChange(n)}>
                {label(n)}
              </button>
            ))}
            <label className={`pf-spread-chip pf-spread-custom${custom ? " is-active" : ""}`}>
              <input
                type="number"
                min={2}
                max={120}
                inputMode="numeric"
                aria-label={t("Months")}
                value={custom ? months : ""}
                placeholder="…"
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  if (n >= 2 && n <= 120) onChange(n);
                }}
              />
              {t("mo")}
            </label>
          </div>
          {amount > 0 && (
            <span key={`${months}-${amount}`} className="pf-spread-readout pf-readout">
              {t("{amount} per month, {from} – {to}", { amount: money(amount / months, currency), from: shortMonthYear(first), to: shortMonthYear(last) })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
