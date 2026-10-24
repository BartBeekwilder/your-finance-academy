"use client";

import { t } from "@/lib/i18n";
import { useState } from "react";
import { Check } from "lucide-react";
import type { TransactionType } from "@/lib/finance/types";
import CategoryIcon from "./CategoryIcon";
import Segmented from "./Segmented";

// Inline editor for a category: name, colour and icon (and, for expenses
// when asked, Fixed / Variable). Used to create a category in Quick Add and
// to create or edit categories and subcategories on the Categories page.

// SF Symbol names (shared with iOS), each drawn by CategoryIcon.
export const CATEGORY_ICONS = {
  expense: [
    "cart.fill", "fork.knife", "car.fill", "house.fill", "bolt.fill", "drop.fill", "flame.fill", "wifi", "phone.fill",
    "tv.fill", "heart.fill", "pills.fill", "stethoscope", "bag.fill", "tshirt.fill", "film.fill", "music.note",
    "gamecontroller.fill", "airplane", "fuelpump.fill", "bus.fill", "tram.fill", "bicycle", "parkingsign.circle.fill",
    "gift.fill", "pawprint.fill", "graduationcap.fill", "book.fill", "dumbbell.fill", "cup.and.saucer.fill",
    "takeoutbag.and.cup.and.straw.fill", "wineglass.fill", "wrench.and.screwdriver.fill", "receipt.fill",
    "creditcard.fill", "leaf.fill", "person.2.fill", "ellipsis.circle.fill",
  ],
  income: [
    "banknote.fill", "briefcase.fill", "dollarsign.circle.fill", "chart.line.uptrend.xyaxis", "wallet.pass.fill",
    "gift.fill", "percent", "star.fill", "house.fill", "person.2.fill",
  ],
};
export const CATEGORY_COLORS = ["30D158", "0A84FF", "5E5CE6", "BF5AF2", "FF375F", "FF453A", "FF9F0A", "FFD60A", "64D2FF", "AC8E68", "8E8E93"];

export type CategoryDraft = { name: string; icon: string; color_hex: string; is_fixed_expense: boolean };

export default function CategoryEditor({
  type,
  taken,
  initial,
  showFixed = false,
  placeholder,
  saveLabel,
  onCancel,
  onSave,
}: {
  type: TransactionType;
  /** Names already in use (lower case), to refuse a duplicate. */
  taken: string[];
  /** Editing: the current values (a new one starts from these too). */
  initial?: Partial<CategoryDraft>;
  /** Offer Fixed / Variable (expenses). */
  showFixed?: boolean;
  placeholder?: string;
  saveLabel?: string;
  onCancel: () => void;
  onSave: (c: CategoryDraft) => Promise<void>;
}) {
  const icons = CATEGORY_ICONS[type === "income" ? "income" : "expense"];
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon && icons.includes(initial.icon) ? initial.icon : initial?.icon ?? icons[0]);
  const [color, setColor] = useState((initial?.color_hex ?? CATEGORY_COLORS[type === "income" ? 0 : 1]).toUpperCase());
  const [fixed, setFixed] = useState(initial?.is_fixed_expense ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const trimmed = name.trim();
  const iconList = icons.includes(icon) ? icons : [icon, ...icons];
  const colorList = CATEGORY_COLORS.includes(color) ? CATEGORY_COLORS : [color, ...CATEGORY_COLORS];

  async function save() {
    if (!trimmed) return setError(t("Give the category a name."));
    if (taken.includes(trimmed.toLowerCase())) return setError(t("You already have a category with that name."));
    setSaving(true);
    setError("");
    try {
      await onSave({ name: trimmed, icon, color_hex: color, is_fixed_expense: type === "expense" && fixed });
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
          placeholder={placeholder ?? (type === "income" ? t("Side job") : t("Gym"))}
          aria-label={t("Category name")}
          value={name}
          maxLength={40}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          // Enter saves the category, not a surrounding form.
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); save(); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
          }}
          style={{ flex: 1 }}
        />
      </div>

      <div className="pf-newcat-row" role="radiogroup" aria-label={t("Colour")}>
        {colorList.map((c) => (
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

      <div className="pf-newcat-row" role="radiogroup" aria-label={t("Icon")}>
        {iconList.map((i) => (
          <button key={i} type="button" role="radio" aria-checked={i === icon} aria-label={i} className="pf-iconpick" onClick={() => setIcon(i)}>
            <CategoryIcon icon={i} colorHex={i === icon ? color : "3a3a3c"} size={28} />
          </button>
        ))}
      </div>

      {showFixed && type === "expense" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--pf-ink-2)" }}>{t("Kind of cost")}</span>
          <Segmented
            size="sm"
            label={t("Kind of cost")}
            value={fixed ? "fixed" : "variable"}
            onChange={(v) => setFixed(v === "fixed")}
            options={[{ value: "variable", label: t("Variable") }, { value: "fixed", label: t("Fixed") }]}
          />
        </div>
      )}

      {error && <p style={{ margin: 0, color: "var(--pf-red)", fontSize: "0.8rem" }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="pf-link" onClick={onCancel}>{t("Cancel")}</button>
        <button type="button" className="pf-button pf-button-sm" onClick={save} disabled={saving}>
          <Check size={15} strokeWidth={3} /> {saving ? t("Saving…") : saveLabel ?? t("Add category")}
        </button>
      </div>
    </div>
  );
}
