"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Plus, Trash2, X } from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import { BadgeTile, Celebration, RingLegend, Rings, StreakFlame } from "@/components/finance/ProgressParts";
import Segmented from "@/components/finance/Segmented";
import Sheet from "@/components/finance/Sheet";
import { live, num } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";
import { BADGES, LEVELS } from "@/lib/finance/progress";
import { progressModel, type GoalState } from "@/lib/finance/progressModel";
import type { Goal } from "@/lib/finance/types";
import { intlLocale, t } from "@/lib/i18n";

// Progress — your finances as a fitness app: this month's three rings, your
// level and points, the streak, your own goals with an estimated date, the
// badges (earned and still to get) and the months you closed. Badges you've
// earned without a month close (adding your home, a goal, a streak) are
// handed out when you open this page, with a small celebration.

const GROUPS = [
  { key: "habits", label: "Habits" },
  { key: "progress", label: "Progress" },
  { key: "discipline", label: "Discipline" },
  { key: "discover", label: "Discover" },
] as const;

export default function ProgressPage() {
  const { data, now, awardBadges, saveGoal, deleteGoal } = useFinance();
  const currency = data.profile.currency_code;
  const m = useMemo(() => progressModel(data, now), [data, now]);
  const [celebrate, setCelebrate] = useState<{ code: string; title: string; points: number; icon: string }[] | null>(null);
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const awarded = useRef(false);

  // Hand out badges earned in the meantime (once per visit).
  const earnableKey = m.earnable.map((b) => b.code).join(",");
  useEffect(() => {
    if (awarded.current || !earnableKey) return;
    awarded.current = true;
    const list = BADGES.filter((b) => earnableKey.split(",").includes(b.code));
    awardBadges(list.map((b) => ({ code: b.code, points: b.points })))
      .then(() => setCelebrate(list.map((b) => ({ code: b.code, title: b.title, points: b.points, icon: b.icon }))))
      .catch(() => {});
  }, [earnableKey, awardBadges]);

  const earnedAt = new Map(m.achievements.map((a) => [a.code, a.earned_at]));
  const locale = intlLocale();

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Progress")}</h1>

      {m.closable && (
        <Link href="/app/close" className="pf-close-banner">
          <CalendarCheck size={22} />
          <span>
            <b>{t("Close {month}", { month: monthYear(m.closable) })}</b>
            <span>{t("Five short steps: check the month, enter month-end balances, collect your points.")}</span>
          </span>
          <em>→</em>
        </Link>
      )}

      {/* Level, points, streak, and this month's rings. */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="pf-card pf-level">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="pf-eq-label">{t("Level")}</span>
            <StreakFlame days={m.streak} />
          </div>
          <div className="pf-rounded pf-level-name">{t(m.level.name)}</div>
          <div style={{ fontSize: "0.85rem", color: "var(--pf-ink-2)" }}>
            <b className="pf-rounded" style={{ color: "var(--pf-ink)" }}>{m.points.toLocaleString(locale)}</b> {t("points")}
            {m.level.next && <> · {t("{n} to {level}", { n: m.level.toNext.toLocaleString(locale), level: t(m.level.next) })}</>}
          </div>
          <div className="pf-level-bar"><span style={{ width: `${m.level.progress * 100}%` }} /></div>
          <div className="pf-level-steps">
            {LEVELS.map((l, i) => (
              <span key={l.name} data-on={i <= m.level.index}>{t(l.name)}</span>
            ))}
          </div>
        </section>

        <section className="pf-card" style={{ padding: 18, display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, alignItems: "center" }}>
          <Rings {...m.rings} size={150} />
          <div style={{ display: "grid", gap: 10 }}>
            <span className="pf-eq-label">{t("This month").toUpperCase()}</span>
            <RingLegend {...m.rings} />
          </div>
        </section>
      </div>

      {/* Goals. */}
      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="pf-section-title" style={{ margin: 0 }}>{t("Goals")}</h2>
          <button className="pf-chip" onClick={() => setEditing("new")}><Plus size={14} /> {t("New goal")}</button>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {m.goals.map((g) => <GoalCard key={g.goal.id} g={g} currency={currency} locale={locale} onEdit={() => setEditing(g.goal)} />)}
          {m.goals.length === 0 && <p style={{ color: "var(--pf-ink-2)" }}>{t("No goals yet. Set one: a buffer to save, a debt to clear, an equity level to reach.")}</p>}
        </div>
      </section>

      {/* Badges. */}
      {GROUPS.map((g) => (
        <section key={g.key} style={{ display: "grid", gap: 10 }}>
          <h2 className="pf-section-title" style={{ margin: 0 }}>
            {t(g.label)} <span style={{ textTransform: "none", color: "var(--pf-ink-3)" }}>· {BADGES.filter((b) => b.group === g.key && earnedAt.has(b.code)).length}/{BADGES.filter((b) => b.group === g.key).length}</span>
          </h2>
          <div className="pf-badges">
            {BADGES.filter((b) => b.group === g.key).map((b) => <BadgeTile key={b.code} badge={b} earnedAt={earnedAt.get(b.code)} locale={locale} />)}
          </div>
        </section>
      ))}

      {/* Closed months. */}
      {m.closes.length > 0 && (
        <section style={{ display: "grid", gap: 10 }}>
          <h2 className="pf-section-title" style={{ margin: 0 }}>{t("Closed months")}</h2>
          <div className="pf-card">
            {[...m.closes].reverse().map((c) => (
              <div key={c.id} className="pf-row" style={{ gap: 14 }}>
                <span style={{ flex: 1 }}>{monthYear(new Date(c.month))}</span>
                <span style={{ fontSize: "0.8rem", color: c.summary.saved >= 0 ? "var(--pf-green)" : "var(--pf-red)" }} className="pf-rounded">{money(c.summary.saved, currency, { signed: true })}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-3)", width: 70, textAlign: "right" }}>{Math.round(c.summary.savingsRate * 100)}%</span>
                <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", width: 70, textAlign: "right" }}>{"●".repeat(c.summary.rings)}{"○".repeat(3 - c.summary.rings)}</span>
                <b className="pf-rounded" style={{ width: 56, textAlign: "right" }}>+{c.points}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} label={t("Goal")}>
        {editing !== null && (
          <GoalForm
            key={editing === "new" ? "new" : editing.id}
            goal={editing === "new" ? undefined : editing}
            categories={live(data.categories).filter((c) => !c.is_income_category && !c.parent_id)}
            onCancel={() => setEditing(null)}
            onSave={(g) => saveGoal(g).then(() => setEditing(null))}
            onDelete={editing !== "new" ? () => deleteGoal(editing.id).then(() => setEditing(null)) : undefined}
          />
        )}
      </Sheet>

      {celebrate && celebrate.length > 0 && (
        <Celebration
          title={celebrate.length === 1 ? t("New badge!") : t("{n} new badges!", { n: celebrate.length })}
          lines={celebrate.map((b) => ({ icon: b.icon, text: t(b.title), points: b.points }))}
          onClose={() => setCelebrate(null)}
        />
      )}
    </div>
  );
}

function GoalCard({ g, currency, locale, onEdit }: { g: GoalState; currency: string; locale: string; onEdit: () => void }) {
  const limit = g.goal.kind === "category_limit";
  const done = g.share >= 1;
  return (
    <button className="pf-card pf-goal" data-done={done} onClick={onEdit}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <b>{g.goal.name || t("Goal")}</b>
        <span className="pf-re-kind">{t(KIND[g.goal.kind])}</span>
      </div>
      <div className="pf-rounded" style={{ fontSize: "1.3rem", fontWeight: 700 }}>
        {limit ? t("{n} of 3 months", { n: g.current }) : `${money(g.current, currency)} / ${money(g.target, currency)}`}
      </div>
      <div className="pf-goal-bar"><span style={{ width: `${g.share * 100}%` }} /></div>
      <div style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
        {done ? t("Reached!") : g.eta ? t("At this pace: {date}", { date: g.eta.toLocaleDateString(locale, { month: "long", year: "numeric" }) }) : limit ? t("Stay under {amount} for 3 months in a row", { amount: money(g.target, currency) }) : t("No progress yet to estimate a date")}
        {g.goal.target_date && !done && <> · {t("target {date}", { date: new Date(g.goal.target_date).toLocaleDateString(locale, { month: "short", year: "numeric" }) })}</>}
      </div>
    </button>
  );
}

const KIND: Record<Goal["kind"], string> = { save: "Save", debt: "Pay off debt", equity: "Equity", category_limit: "Spending limit" };

function GoalForm({ goal, categories, onSave, onCancel, onDelete }: { goal?: Goal; categories: { id: string; name: string }[]; onSave: (g: Omit<Goal, "updated_at" | "deleted_at" | "id"> & { id?: string }) => Promise<void>; onCancel: () => void; onDelete?: () => Promise<void> }) {
  const [kind, setKind] = useState<Goal["kind"]>(goal?.kind ?? "save");
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(num(goal.target)) : "");
  const [start, setStart] = useState(goal ? String(num(goal.start_value)) : "0");
  const [date, setDate] = useState(goal?.target_date?.slice(0, 10) ?? "");
  const [category, setCategory] = useState(goal?.category_id ?? categories[0]?.id ?? "");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const n = (s: string) => Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
  const startLabel = kind === "save" ? t("Already saved") : kind === "debt" ? t("Debt now") : kind === "equity" ? t("Equity now") : "";
  return (
    <form
      style={{ display: "grid", gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ id: goal?.id, kind, name: name.trim() || t(KIND[kind]), target: n(target).toFixed(2), start_value: n(start).toFixed(2), target_date: date || null, category_id: kind === "category_limit" ? category || null : null, achieved_at: goal?.achieved_at ?? null, sort_order: goal?.sort_order ?? 0, created_at: goal?.created_at ?? new Date().toISOString() }).catch((err: Error) => setError(err.message));
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{goal ? t("Edit goal") : t("New goal")}</h2>
        <button type="button" className="pf-icon-button" aria-label={t("Close")} onClick={onCancel}><X size={18} /></button>
      </div>
      <Segmented wide label={t("Type")} value={kind} onChange={setKind} options={(Object.keys(KIND) as Goal["kind"][]).map((k) => ({ value: k, label: t(KIND[k]) }))} />
      <label className="pf-field"><span>{t("Name")}</span><input className="pf-input" value={name} placeholder={t(KIND[kind])} onChange={(e) => setName(e.target.value)} /></label>
      {kind === "category_limit" ? (
        <label className="pf-field"><span>{t("Category")}</span>
          <select className="pf-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      ) : (
        <label className="pf-field"><span>{startLabel}</span><input className="pf-input" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} /></label>
      )}
      <label className="pf-field"><span>{kind === "category_limit" ? t("Monthly limit") : kind === "debt" ? t("Debt target (e.g. 0)") : t("Target")}</span><input className="pf-input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} required /></label>
      {kind !== "category_limit" && <label className="pf-field"><span>{t("Target date (optional)")}</span><input className="pf-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>}
      {error && <p style={{ color: "var(--pf-red)", fontSize: "0.85rem" }}>{error}</p>}
      <button className="pf-button">{t("Save")}</button>
      {onDelete && (
        <button type="button" className="pf-delete-button" data-confirm={confirm} onClick={() => (confirm ? onDelete() : setConfirm(true))} onBlur={() => setConfirm(false)}>
          <Trash2 size={15} /> {confirm ? t("Tap again to remove this goal") : t("Remove goal")}
        </button>
      )}
    </form>
  );
}
