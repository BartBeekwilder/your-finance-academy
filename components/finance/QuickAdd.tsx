"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Plus, X } from "lucide-react";
import { live } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import type { TransactionType } from "@/lib/finance/types";
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

export default function QuickAdd() {
  const { data, addTransaction, addCategory } = useFinance();
  const [open, setOpen] = useState(false);
  // New key per opening, so the form starts empty every time (the sheet
  // keeps its content mounted for the closing animation).
  const [session, setSession] = useState(0);
  const [from, setFrom] = useState<Element | null>(null);

  return (
    <>
      <button
        className="pf-fab pf-bouncy"
        aria-label="Quick Add"
        onClick={(e) => {
          setFrom(e.currentTarget);
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        <Plus size={22} strokeWidth={3} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} origin={from} focus="input[inputmode=decimal]" label="Quick Add">
        <Form key={session} currency={data.profile.currency_code} categories={live(data.categories)} onDone={() => setOpen(false)} add={addTransaction} addCategory={addCategory} />
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
}: {
  currency: string;
  categories: ReturnType<typeof useFinance>["data"]["categories"];
  add: ReturnType<typeof useFinance>["addTransaction"];
  addCategory: ReturnType<typeof useFinance>["addCategory"];
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
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

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

      <Segmented
        wide
        label="Type"
        value={type}
        onChange={(t) => { setType(t); setCategoryId(null); setCreating(false); }}
        options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]}
      />

      <input
        className="pf-input pf-rounded"
        inputMode="decimal"
        placeholder={money(0, currency)}
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
              data-fresh={fresh === c.id || undefined}
              style={categoryId === c.id ? { borderColor: `#${c.color_hex}`, background: `#${c.color_hex}33` } : undefined}
            >
              <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={20} />
              {c.name}
            </button>
          ))}
          {!creating && (
            <button type="button" className="pf-chip pf-chip-new" onClick={() => setCreating(true)}>
              <span className="pf-chip-new-icon"><Plus size={14} strokeWidth={3} /></span>
              New category
            </button>
          )}
        </div>
        {creating && (
          <NewCategoryEditor
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

// SF Symbol names (shared with iOS), each drawn by CategoryIcon.
const ICONS = {
  expense: [
    "cart.fill", "fork.knife", "car.fill", "house.fill", "bolt.fill", "heart.fill", "bag.fill", "film.fill",
    "airplane", "gift.fill", "pawprint.fill", "graduationcap.fill", "dumbbell.fill", "wifi", "phone.fill",
    "tshirt.fill", "cup.and.saucer.fill", "wrench.and.screwdriver.fill",
  ],
  income: [
    "banknote.fill", "briefcase.fill", "dollarsign.circle.fill", "chart.line.uptrend.xyaxis", "wallet.pass.fill",
    "gift.fill", "percent", "star.fill", "house.fill", "person.2.fill",
  ],
};
const COLORS = ["30D158", "0A84FF", "5E5CE6", "BF5AF2", "FF375F", "FF453A", "FF9F0A", "FFD60A", "64D2FF", "AC8E68", "8E8E93"];

/** Inline editor for a new category: unfolds under the chips. */
function NewCategoryEditor({
  type,
  taken,
  onCancel,
  onSave,
}: {
  type: TransactionType;
  taken: string[];
  onCancel: () => void;
  onSave: (c: { name: string; icon: string; color_hex: string }) => Promise<void>;
}) {
  const icons = ICONS[type === "income" ? "income" : "expense"];
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(icons[0]);
  const [color, setColor] = useState(COLORS[type === "income" ? 0 : 1]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const trimmed = name.trim();

  async function save() {
    if (!trimmed) return setError("Give the category a name.");
    if (taken.includes(trimmed.toLowerCase())) return setError("You already have a category with that name.");
    setSaving(true);
    setError("");
    try {
      await onSave({ name: trimmed, icon, color_hex: color });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="pf-newcat" style={{ ["--c" as string]: `#${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="pf-newcat-preview">
          <CategoryIcon icon={icon} colorHex={color} size={34} />
        </span>
        <input
          className="pf-input"
          autoFocus
          placeholder={type === "income" ? "Side job" : "Gym"}
          aria-label="Category name"
          value={name}
          maxLength={40}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          // Enter saves the category, not the whole transaction form.
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); save(); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
          }}
          style={{ flex: 1 }}
        />
      </div>

      <div className="pf-newcat-row" role="radiogroup" aria-label="Colour">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={`Colour #${c}`}
            className="pf-swatch"
            onClick={() => setColor(c)}
            style={{ background: `#${c}` }}
          />
        ))}
      </div>

      <div className="pf-newcat-row" role="radiogroup" aria-label="Icon">
        {icons.map((i) => (
          <button key={i} type="button" role="radio" aria-checked={i === icon} aria-label={i} className="pf-iconpick" onClick={() => setIcon(i)}>
            <CategoryIcon icon={i} colorHex={i === icon ? color : "3a3a3c"} size={28} />
          </button>
        ))}
      </div>

      {error && <p style={{ margin: 0, color: "var(--pf-red)", fontSize: "0.8rem" }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="pf-link" onClick={onCancel}>Cancel</button>
        <button type="button" className="pf-button pf-button-sm" onClick={save} disabled={saving}>
          <Check size={15} strokeWidth={3} /> {saving ? "Adding…" : "Add category"}
        </button>
      </div>
    </div>
  );
}
