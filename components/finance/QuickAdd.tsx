"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { live } from "@/lib/finance/calc";
import type { TransactionType } from "@/lib/finance/types";
import CategoryIcon from "./CategoryIcon";
import { useFinance } from "./FinanceProvider";
import Sheet from "./Sheet";

// Web counterpart of the iOS QuickAddButton + AddEditTransactionView: the
// gradient "+" opens a sheet to log an expense or income. Category choice
// pre-fills "fixed" from the category's default, as on iOS.

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function QuickAdd() {
  const { data, addTransaction } = useFinance();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="pf-fab pf-bouncy" aria-label="Quick Add" onClick={() => setOpen(true)}>
        <Plus size={22} strokeWidth={3} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} focus="input[inputmode=decimal]" label="Quick Add">
        <Form categories={live(data.categories)} onDone={() => setOpen(false)} add={addTransaction} />
      </Sheet>
    </>
  );
}

function Form({
  categories,
  add,
  onDone,
}: {
  categories: ReturnType<typeof useFinance>["data"]["categories"];
  add: ReturnType<typeof useFinance>["addTransaction"];
  onDone: () => void;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(todayLocal);
  const [note, setNote] = useState("");
  const [fixed, setFixed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const choices = useMemo(
    () => categories.filter((c) => c.is_income_category === (type === "income")).sort((a, b) => a.sort_order - b.sort_order),
    [categories, type],
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
        is_auto_income: false,
        is_fixed_expense: type === "expense" && fixed,
        recurrence_id: null,
        category_id: categoryId,
        account_id: null,
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
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Quick Add</h2>
        <button type="button" className="pf-icon-button" aria-label="Close" onClick={onDone}><X size={18} /></button>
      </div>

      <div className="pf-card" role="tablist" style={{ display: "flex", padding: 2, borderRadius: 9 }}>
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => { setType(t); setCategoryId(null); }}
            className="pf-segment"
          >
            {t === "expense" ? "Expense" : "Income"}
          </button>
        ))}
      </div>

      <input
        className="pf-input pf-rounded"
        inputMode="decimal"
        placeholder="€ 0,00"
        aria-label="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ fontSize: "2rem", fontWeight: 700, textAlign: "center", color: type === "income" ? "var(--pf-green)" : "var(--pf-ink)" }}
      />

      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", marginBottom: 8 }}>Category</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setCategoryId(c.id); setFixed(c.is_fixed_expense); }}
              className="pf-chip"
              aria-pressed={categoryId === c.id}
              style={categoryId === c.id ? { borderColor: `#${c.color_hex}`, background: `#${c.color_hex}33` } : undefined}
            >
              <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={20} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input className="pf-input" type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input className="pf-input" placeholder="Note" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {type === "expense" && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem" }}>
          <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
          Fixed expense <span style={{ color: "var(--pf-ink-3)" }}>— same amount every month</span>
        </label>
      )}

      {error && <p style={{ margin: 0, color: "var(--pf-red)", fontSize: "0.85rem" }}>{error}</p>}

      <button className="pf-button" disabled={!valid || saving}>
        {saving ? "Saving…" : `Add ${type === "expense" ? "Expense" : "Income"}`}
      </button>
    </form>
  );
}
