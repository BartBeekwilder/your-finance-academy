"use client";

import { t } from "@/lib/i18n";
import { useState } from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import CategoryEditor, { type CategoryDraft } from "@/components/finance/CategoryEditor";
import CategoryIcon from "@/components/finance/CategoryIcon";
import { useFinance } from "@/components/finance/FinanceProvider";
import { live } from "@/lib/finance/calc";
import type { Category } from "@/lib/finance/types";

// Categories: every category opens up (accordion) to show its
// subcategories — e.g. Utilities → Water, Electricity, Gas — which can be
// added (with suggestions for the usual ones), renamed, recoloured, given an
// icon, set Fixed / Variable (a new sub takes its parent's) or deleted
// (its transactions move to the parent). The parent itself can be edited or
// deleted from the same panel. Subcategories roll up into their parent in
// every total, chart and budget.

type Suggestion = { name: string; icon: string };

/** Usual subcategories, keyed by the parent's icon (names differ per user
 *  and language, the default icons don't). */
function suggestionsFor(icon: string): Suggestion[] {
  const s: Record<string, Suggestion[]> = {
    "bolt.fill": [
      { name: t("Water"), icon: "drop.fill" },
      { name: t("Electricity"), icon: "bolt.fill" },
      { name: t("Gas"), icon: "flame.fill" },
      { name: t("Internet"), icon: "wifi" },
      { name: t("Phone"), icon: "phone.fill" },
      { name: t("TV & streaming"), icon: "tv.fill" },
    ],
    "cart.fill": [
      { name: t("Supermarket"), icon: "cart.fill" },
      { name: t("Market"), icon: "leaf.fill" },
      { name: t("Drugstore"), icon: "pills.fill" },
      { name: t("Bakery"), icon: "cup.and.saucer.fill" },
    ],
    "car.fill": [
      { name: t("Fuel"), icon: "fuelpump.fill" },
      { name: t("Public transport"), icon: "tram.fill" },
      { name: t("Parking"), icon: "parkingsign.circle.fill" },
      { name: t("Maintenance"), icon: "wrench.and.screwdriver.fill" },
      { name: t("Bike"), icon: "bicycle" },
    ],
    "house.fill": [
      { name: t("Rent"), icon: "house.fill" },
      { name: t("Service charges"), icon: "receipt.fill" },
      { name: t("Maintenance"), icon: "wrench.and.screwdriver.fill" },
    ],
    "cross.case.fill": [
      { name: t("Pharmacy"), icon: "pills.fill" },
      { name: t("Doctor"), icon: "stethoscope" },
      { name: t("Dentist"), icon: "heart.fill" },
      { name: t("Sport"), icon: "dumbbell.fill" },
    ],
    "fork.knife": [
      { name: t("Restaurant"), icon: "fork.knife" },
      { name: t("Takeaway"), icon: "takeoutbag.and.cup.and.straw.fill" },
      { name: t("Coffee"), icon: "cup.and.saucer.fill" },
      { name: t("Drinks"), icon: "wineglass.fill" },
    ],
    "bag.fill": [
      { name: t("Clothing"), icon: "tshirt.fill" },
      { name: t("Electronics"), icon: "tv.fill" },
      { name: t("Gifts"), icon: "gift.fill" },
      { name: t("Home & garden"), icon: "leaf.fill" },
    ],
    "film.fill": [
      { name: t("Streaming"), icon: "tv.fill" },
      { name: t("Cinema"), icon: "film.fill" },
      { name: t("Games"), icon: "gamecontroller.fill" },
      { name: t("Music"), icon: "music.note" },
      { name: t("Going out"), icon: "wineglass.fill" },
    ],
  };
  s["heart.fill"] = s["cross.case.fill"];
  return s[icon] ?? [];
}

export default function CategoriesPage() {
  const { data, addCategory, updateCategory, deleteCategory } = useFinance();
  const all = live(data.categories).sort((a, b) => a.sort_order - b.sort_order);
  const top = all.filter((c) => c.parent_id === null);
  const [open, setOpen] = useState<string | null>(null);
  // What is being edited: a category id, "new:<parentId>" (a sub), or
  // "new-top:expense|income".
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");

  const groups = [
    { key: "expense" as const, title: t("Expenses"), rows: top.filter((c) => !c.is_income_category) },
    { key: "income" as const, title: t("Income"), rows: top.filter((c) => c.is_income_category) },
  ];
  const subsOf = (id: string) => all.filter((s) => s.parent_id === id);
  const takenFor = (except?: string) => all.filter((c) => c.id !== except).map((c) => c.name.toLowerCase());
  const kind = (c: Category) => (c.is_income_category ? "income" : "expense");

  const remove = async (c: Category) => {
    if (confirm !== c.id) return setConfirm(c.id);
    setConfirm(null);
    try {
      await deleteCategory(c.id);
      if (open === c.id) setOpen(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const saveEdit = (c: Category) => async (d: CategoryDraft) => {
    await updateCategory(c.id, { name: d.name, icon: d.icon, color_hex: d.color_hex, ...(c.is_income_category ? {} : { is_fixed_expense: d.is_fixed_expense }) });
    setEditing(null);
  };
  const addSub = (p: Category) => async (d: CategoryDraft) => {
    await addCategory({ ...d, is_income_category: p.is_income_category, is_fixed_expense: !p.is_income_category && d.is_fixed_expense, parent_id: p.id });
    setEditing(null);
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "grid", gap: 6 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Categories")}</h1>
        <p style={{ margin: 0, color: "var(--pf-ink-2)", fontSize: "0.9rem" }}>
          {t("Open a category to add subcategories — for example Utilities → Water, Electricity, Gas. They count towards their category everywhere.")}
        </p>
      </header>
      {error && <p style={{ margin: 0, color: "var(--pf-red)" }}>{error}</p>}
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="pf-section-title">{g.title}</h2>
          <div className="pf-card pf-cats">
            {g.rows.map((c) => {
              const subs = subsOf(c.id);
              const isOpen = open === c.id;
              const sugg = suggestionsFor(c.icon).filter((s) => !subs.some((x) => x.name.toLowerCase() === s.name.toLowerCase()));
              return (
                <div key={c.id} className="pf-cat" data-open={isOpen}>
                  <button
                    type="button"
                    className="pf-row pf-cat-head"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpen(isOpen ? null : c.id);
                      setEditing(null);
                      setConfirm(null);
                    }}
                  >
                    <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={32} />
                    <span style={{ flex: 1, textAlign: "start" }}>
                      {c.name}
                      {subs.length > 0 && (
                        <span className="pf-cat-count">{subs.length === 1 ? t("1 subcategory") : t("{n} subcategories", { n: subs.length })}</span>
                      )}
                    </span>
                    {!c.is_income_category && <span className="pf-cat-kind">{c.is_fixed_expense ? t("Fixed") : t("Variable")}</span>}
                    <ChevronRight size={16} className="pf-cat-chevron" />
                  </button>

                  {isOpen && (
                    <div className="pf-cat-body">
                      {editing === c.id ? (
                        <CategoryEditor
                          type={kind(c)}
                          taken={takenFor(c.id)}
                          initial={c}
                          showFixed={!c.is_income_category}
                          saveLabel={t("Save")}
                          onCancel={() => setEditing(null)}
                          onSave={saveEdit(c)}
                        />
                      ) : (
                        <div className="pf-cat-actions">
                          <button type="button" className="pf-link" onClick={() => setEditing(c.id)}>
                            <Pencil size={13} /> {t("Edit")}
                          </button>
                          <button type="button" className="pf-link pf-danger" data-confirm={confirm === c.id} onClick={() => remove(c)} onBlur={() => setConfirm(null)}>
                            <Trash2 size={13} />{" "}
                            {confirm === c.id
                              ? subs.length
                                ? t("Tap again: delete with its subcategories")
                                : t("Tap again to delete")
                              : t("Delete")}
                          </button>
                        </div>
                      )}

                      {subs.map((s) =>
                        editing === s.id ? (
                          <CategoryEditor
                            key={s.id}
                            type={kind(c)}
                            taken={takenFor(s.id)}
                            initial={s}
                            showFixed={!c.is_income_category}
                            saveLabel={t("Save")}
                            onCancel={() => setEditing(null)}
                            onSave={saveEdit(s)}
                          />
                        ) : (
                          <div key={s.id} className="pf-row pf-sub">
                            <CategoryIcon icon={s.icon} colorHex={s.color_hex} size={24} />
                            <span style={{ flex: 1, fontSize: "0.92rem" }}>{s.name}</span>
                            {!c.is_income_category && <span className="pf-cat-kind">{s.is_fixed_expense ? t("Fixed") : t("Variable")}</span>}
                            <button type="button" className="pf-icon-button" aria-label={t("Edit")} onClick={() => setEditing(s.id)}>
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="pf-icon-button pf-danger"
                              data-confirm={confirm === s.id}
                              aria-label={confirm === s.id ? t("Tap again to delete") : t("Delete")}
                              title={confirm === s.id ? t("Tap again to delete") : t("Delete")}
                              onClick={() => remove(s)}
                              onBlur={() => setConfirm(null)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ),
                      )}

                      {editing === `new:${c.id}` ? (
                        <CategoryEditor
                          type={kind(c)}
                          taken={takenFor()}
                          initial={{ icon: c.icon, color_hex: c.color_hex, is_fixed_expense: c.is_fixed_expense }}
                          showFixed={!c.is_income_category}
                          placeholder={t("Subcategory name")}
                          saveLabel={t("Add subcategory")}
                          onCancel={() => setEditing(null)}
                          onSave={addSub(c)}
                        />
                      ) : (
                        <div className="pf-cat-add">
                          <button type="button" className="pf-chip pf-chip-new" onClick={() => setEditing(`new:${c.id}`)}>
                            <span className="pf-chip-new-icon"><Plus size={14} strokeWidth={3} /></span>
                            {t("Subcategory")}
                          </button>
                          {sugg.map((s) => (
                            <button
                              key={s.name}
                              type="button"
                              className="pf-chip pf-chip-sm pf-chip-suggest"
                              title={t("Add {name}", { name: s.name })}
                              onClick={() =>
                                addSub(c)({ name: s.name, icon: s.icon, color_hex: c.color_hex, is_fixed_expense: c.is_fixed_expense }).catch((e: Error) => setError(e.message))
                              }
                            >
                              <Plus size={12} strokeWidth={3} />
                              <CategoryIcon icon={s.icon} colorHex={c.color_hex} size={16} />
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {editing === `new-top:${g.key}` ? (
              <div style={{ padding: "0 12px 12px" }}>
                <CategoryEditor
                  type={g.key}
                  taken={takenFor()}
                  showFixed={g.key === "expense"}
                  onCancel={() => setEditing(null)}
                  onSave={async (d) => {
                    await addCategory({ ...d, is_income_category: g.key === "income" });
                    setEditing(null);
                  }}
                />
              </div>
            ) : (
              <div style={{ padding: "8px 12px 12px" }}>
                <button type="button" className="pf-chip pf-chip-new" onClick={() => setEditing(`new-top:${g.key}`)}>
                  <span className="pf-chip-new-icon"><Plus size={14} strokeWidth={3} /></span>
                  {t("New category")}
                </button>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
