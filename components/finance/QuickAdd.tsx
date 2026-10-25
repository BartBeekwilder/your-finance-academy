"use client";

import { t } from "@/lib/i18n";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { closeTransactionEditor, useTransactionEditor } from "@/lib/finance/editTransaction";
import { live } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import type { Transaction, TransactionType } from "@/lib/finance/types";
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
  const { data, addTransaction, updateTransaction, deleteTransaction, addCategory } = useFinance();
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
        <Form key={session} currency={data.profile.currency_code} categories={live(data.categories)} onDone={() => setOpen(false)} add={addTransaction} addCategory={addCategory} />
      </Sheet>
      <Sheet open={!!editing?.open} onClose={closeTransactionEditor} origin={editing?.origin} label={t("Edit transaction")}>
        {editing && (
          <Form
            key={`edit${editing.n}`}
            initial={editing.transaction}
            currency={data.profile.currency_code}
            categories={live(data.categories)}
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

function Form({
  currency,
  categories,
  add,
  addCategory,
  onDone,
  initial,
  onDelete,
}: {
  /** Editing an existing transaction: its values fill the form. */
  initial?: Transaction;
  onDelete?: () => Promise<void>;
  currency: string;
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
  const [fixed, setFixed] = useState(initial?.is_fixed_expense ?? false);
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

  // Accept "12,50" as well as "12.50" — Dutch keyboards type a comma.
  const parsed = Number(amount.replace(/\s/g, "").replace(",", "."));
  const valid = parsed > 0 && Number.isFinite(parsed);

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
        is_fixed_expense: type === "expense" && fixed,
        recurrence_id: initial?.recurrence_id ?? null,
        category_id: categoryId,
        account_id: initial?.account_id ?? null,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{initial ? `Edit ${type === "expense" ? "expense" : "income"}` : t("Quick Add")}</h2>
        <button type="button" className="pf-icon-button" aria-label={t("Close")} onClick={onDone}><X size={18} /></button>
      </div>

      <Segmented
        wide
        label={t("Type")}
        value={type}
        onChange={(t) => { setType(t); setCategoryId(null); setCreating(false); }}
        options={[{ value: "expense", label: t("Expense") }, { value: "income", label: t("Income") }]}
      />

      <input
        className="pf-input pf-rounded"
        inputMode="decimal"
        placeholder={money(0, currency)}
        aria-label={t("Amount")}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ fontSize: "2rem", fontWeight: 700, textAlign: "center", color: type === "income" ? "var(--pf-green)" : "var(--pf-ink)" }}
      />

      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", marginBottom: 8 }}>{t("Category")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setCategoryId(c.id); setFixed(c.is_fixed_expense); }}
              className="pf-chip"
              aria-pressed={parentId === c.id}
              data-fresh={fresh === c.id || undefined}
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
        {subs.length > 0 && selected && (
          <div key={parentId} className="pf-subchips">
            <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>{t("Subcategory (optional)")}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {subs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="pf-chip pf-chip-sm"
                  aria-pressed={categoryId === c.id}
                  onClick={() => {
                    // Tapping the chosen sub again goes back to just the parent.
                    const back = categoryId === c.id;
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
            </div>
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
        <input className="pf-input" type="date" aria-label={t("Date")} value={date} onChange={(e) => setDate(e.target.value)} required />
        <input className="pf-input" placeholder={t("Note")} aria-label={t("Note")} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {type === "expense" && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem" }}>
          <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
          Fixed expense <span style={{ color: "var(--pf-ink-3)" }}>{t("— same amount every month")}</span>
        </label>
      )}

      {error && <p style={{ margin: 0, color: "var(--pf-red)", fontSize: "0.85rem" }}>{error}</p>}

      <button className="pf-button" disabled={!valid || saving}>
        {saving ? t("Saving…") : initial ? t("Save changes") : `Add ${type === "expense" ? t("Expense") : t("Income")}`}
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
