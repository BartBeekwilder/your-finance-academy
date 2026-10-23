"use client";

import { useMemo, useState } from "react";
import { Car, Check, CircleAlert, FileText, Gavel, HeartPulse, House, Lamp, PawPrint, Plane, Plus, ShieldCheck, Sofa, Umbrella, UserRound, X, type LucideIcon } from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import Segmented from "@/components/finance/Segmented";
import Sheet from "@/components/finance/Sheet";
import { live, num } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import { coverageCheck, KINDS, perMonth, renewal, totals, type InsuranceKind, type PremiumPeriod } from "@/lib/finance/insurance";
import type { InsurancePolicy } from "@/lib/finance/types";
import { intlLocale, t } from "@/lib/i18n";

// Insurance — every policy in one place:
//   • what you pay per month and per year, split by kind in one bar, and
//     what you'd pay yourself in deductibles;
//   • a coverage check for your situation (home, mortgage, car, country):
//     what's required, recommended or optional, and whether you have it;
//   • renewals coming up, with the last day you can still cancel;
//   • each policy as a card; tap to edit, add your own.

const KIND_STYLE: Record<InsuranceKind, { label: string; Icon: LucideIcon; color: string }> = {
  health: { label: "Health", Icon: HeartPulse, color: "#ff375f" },
  liability: { label: "Liability", Icon: ShieldCheck, color: "#40c8e0" },
  contents: { label: "Contents", Icon: Sofa, color: "#bf5af2" },
  home: { label: "Home", Icon: House, color: "#0a84ff" },
  car: { label: "Car", Icon: Car, color: "#ff9f0a" },
  travel: { label: "Travel", Icon: Plane, color: "#30d158" },
  life: { label: "Life", Icon: UserRound, color: "#ffd60a" },
  disability: { label: "Disability", Icon: Umbrella, color: "#64d2ff" },
  legal: { label: "Legal aid", Icon: Gavel, color: "#ac8e68" },
  pet: { label: "Pet", Icon: PawPrint, color: "#ff6482" },
  other: { label: "Other", Icon: Lamp, color: "#8e8e93" },
};

const input = (p: InsurancePolicy) => ({ kind: p.kind, premium: num(p.premium), period: p.period, deductible: num(p.deductible), renewalDate: p.renewal_date, noticeMonths: p.notice_months });

export default function InsurancePage() {
  const { data, now, savePolicy, deletePolicy } = useFinance();
  const currency = data.profile.currency_code;
  const policies = useMemo(() => live(data.insurancePolicies ?? []).sort((a, b) => a.sort_order - b.sort_order), [data.insurancePolicies]);
  const sum = totals(policies.map(input));
  const [editing, setEditing] = useState<{ row?: InsurancePolicy } | null>(null);
  const [view, setView] = useState<"month" | "year">("month");
  const [error, setError] = useState<string | null>(null);

  // Your situation, from what the app knows.
  const assets = live(data.balanceItems ?? []).filter((b) => b.side === "asset").map((b) => b.name.toLowerCase());
  const debts = live(data.balanceItems ?? []).filter((b) => b.side === "liability").map((b) => b.name.toLowerCase());
  const homes = live(data.properties ?? []);
  const situation = {
    ownsHome: homes.length > 0 || assets.some((n) => /home|house|huis|woning|apartment/.test(n)),
    hasMortgage: live(data.mortgageParts ?? []).length > 0 || debts.some((n) => /mortgage|hypotheek/.test(n)),
    hasCar: assets.some((n) => /\bcar\b|auto/.test(n)) || policies.some((p) => p.kind === "car"),
    country: (homes.some((h) => h.country === "NL") || intlLocale().startsWith("nl") ? "NL" : "INTL") as "NL" | "INTL",
  };
  const coverage = coverageCheck(policies.map(input), situation);
  const missing = coverage.filter((c) => !c.have && c.importance !== "optional").length;
  const upcoming = policies
    .map((p) => ({ p, r: renewal(input(p), now) }))
    .filter((x): x is { p: InsurancePolicy; r: NonNullable<ReturnType<typeof renewal>> } => x.r !== null)
    .sort((a, b) => a.r.next.getTime() - b.r.next.getTime());
  const fmtDate = (d: Date) => d.toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" });
  const factor = view === "month" ? 1 : 12;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Insurance")}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Segmented label={t("Period")} value={view} onChange={setView} options={[{ value: "month", label: t("Month") }, { value: "year", label: t("Year") }]} />
          <button className="pf-chip" onClick={() => setEditing({})}>
            <Plus size={14} /> {t("Add policy")}
          </button>
        </div>
      </header>
      {error && <div className="pf-close-note">{error}</div>}

      {/* What it costs. */}
      <section className="pf-card pf-ins-hero">
        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--pf-ink-2)" }}>{view === "month" ? t("Premiums per month") : t("Premiums per year")}</span>
          <b key={view} className="pf-rounded pf-readout" style={{ fontSize: "2.6rem", fontWeight: 800 }}>{money(sum.perMonth * factor, currency)}</b>
          <span style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>
            {t("{n} policies", { n: policies.length })} · {t("deductibles together {amount}", { amount: money(sum.deductibles, currency) })}
          </span>
        </div>
        <div className="pf-ins-bar">
          {sum.byKind.map((k, i) => (
            <span key={k.kind} title={`${t(KIND_STYLE[k.kind].label)} ${money(k.monthly * factor, currency)}`} style={{ flex: k.share, background: KIND_STYLE[k.kind].color, animationDelay: `${i * 0.06}s` }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
          {sum.byKind.map((k) => (
            <span key={k.kind} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: KIND_STYLE[k.kind].color }} />
              {t(KIND_STYLE[k.kind].label)} <b className="pf-rounded" style={{ color: "var(--pf-ink)" }}>{money(k.monthly * factor, currency)}</b>
            </span>
          ))}
        </div>
      </section>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        {/* Coverage check. */}
        <section className="pf-card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>{t("Coverage check")}</h2>
            <span style={{ fontSize: "0.75rem", color: missing ? "#ff9f0a" : "var(--pf-green)" }}>{missing ? t("{n} to look at", { n: missing }) : t("All essentials covered")}</span>
          </div>
          {coverage.map((c, i) => {
            const S = KIND_STYLE[c.kind];
            const tone = c.have ? "var(--pf-green)" : c.importance === "required" ? "var(--pf-red)" : c.importance === "recommended" ? "#ff9f0a" : "var(--pf-ink-3)";
            return (
              <div key={c.kind} className="pf-ins-check" style={{ animationDelay: `${i * 0.05}s` }}>
                <span className="pf-ins-icon" style={{ color: S.color, background: `${S.color}22` }}><S.Icon size={16} /></span>
                <span style={{ display: "grid", gap: 2 }}>
                  <b style={{ fontSize: "0.88rem" }}>{t(S.label)} <em className="pf-ins-tag" data-level={c.importance}>{t(c.importance === "required" ? "Required" : c.importance === "recommended" ? "Recommended" : "Optional")}</em></b>
                  <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>{t(c.reason)}</span>
                </span>
                <span style={{ color: tone }}>{c.have ? <Check size={18} /> : c.importance === "optional" ? <span style={{ fontSize: "0.7rem" }}>—</span> : <CircleAlert size={18} />}</span>
              </div>
            );
          })}
        </section>

        {/* Renewals. */}
        <section className="pf-card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>{t("Renewals")}</h2>
          {upcoming.length === 0 && <p style={{ fontSize: "0.85rem", color: "var(--pf-ink-3)" }}>{t("Add renewal dates to your policies to see them here.")}</p>}
          <div className="pf-ins-timeline">
            {upcoming.map(({ p, r }) => {
              const soon = r.canStillCancel && r.daysToCancel <= 60;
              return (
                <button key={p.id} className="pf-ins-renewal" data-soon={soon} onClick={() => setEditing({ row: p })}>
                  <span className="pf-ins-dot" style={{ background: KIND_STYLE[p.kind].color }} />
                  <span style={{ display: "grid", gap: 2, textAlign: "left" }}>
                    <b style={{ fontSize: "0.88rem" }}>{p.name || t(KIND_STYLE[p.kind].label)}</b>
                    <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>{t("Renews {date}", { date: fmtDate(r.next) })} · {t("in {n} days", { n: r.daysToRenewal })}</span>
                    <span style={{ fontSize: "0.72rem", color: soon ? "#ff9f0a" : "var(--pf-ink-3)" }}>
                      {r.canStillCancel ? t("Cancel by {date}", { date: fmtDate(r.cancelBy) }) : t("Too late to cancel this round")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* The policies. */}
      <section style={{ display: "grid", gap: 10 }}>
        <span style={{ fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--pf-ink-2)" }}>{t("Your policies")}</span>
        {policies.length === 0 ? (
          <div className="pf-card" style={{ padding: 28, display: "grid", gap: 10, justifyItems: "center", textAlign: "center" }}>
            <FileText size={36} color="#40c8e0" />
            <p style={{ color: "var(--pf-ink-2)" }}>{t("No policies yet. Add your health, liability and home insurance to see what you pay and what's missing.")}</p>
            <button className="pf-button" onClick={() => setEditing({})}>{t("Add policy")}</button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {policies.map((p, i) => {
              const S = KIND_STYLE[p.kind];
              return (
                <button key={p.id} className="pf-card pf-ins-policy" style={{ ["--c" as string]: S.color, animationDelay: `${i * 0.04}s` }} onClick={() => setEditing({ row: p })}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="pf-ins-icon" style={{ color: S.color, background: `${S.color}22` }}><S.Icon size={18} /></span>
                    <span style={{ display: "grid", flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || t(S.label)}</b>
                      <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>{p.insurer || t(S.label)}</span>
                    </span>
                  </div>
                  <b className="pf-rounded" style={{ fontSize: "1.4rem" }}>{money(perMonth(num(p.premium), p.period) * factor, currency)}<span style={{ fontSize: "0.75rem", color: "var(--pf-ink-3)", fontWeight: 500 }}> / {view === "month" ? t("month") : t("year")}</span></b>
                  <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
                    {t("Deductible {amount}", { amount: money(num(p.deductible), currency) })}
                    {p.coverage ? ` · ${t("covered up to {amount}", { amount: money(num(p.coverage), currency, { compact: true }) })}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} label={editing?.row ? t("Edit policy") : t("Add policy")}>
        {editing && (
          <PolicyForm
            key={editing.row?.id ?? "new"}
            row={editing.row}
            next={policies.length}
            onCancel={() => setEditing(null)}
            onSave={(x) => savePolicy(x).then(() => { setEditing(null); setError(null); }).catch((e: Error) => setError(e.message))}
            onDelete={editing.row ? () => deletePolicy(editing.row!.id).then(() => setEditing(null)).catch((e: Error) => setError(e.message)) : undefined}
          />
        )}
      </Sheet>
    </div>
  );
}

function PolicyForm({ row, next, onSave, onCancel, onDelete }: { row?: InsurancePolicy; next: number; onSave: (p: Omit<InsurancePolicy, "updated_at" | "deleted_at" | "id"> & { id?: string }) => void; onCancel: () => void; onDelete?: () => void }) {
  const [kind, setKind] = useState<InsuranceKind>(row?.kind ?? "health");
  const [name, setName] = useState(row?.name ?? "");
  const [insurer, setInsurer] = useState(row?.insurer ?? "");
  const [premium, setPremium] = useState(row ? String(num(row.premium)) : "");
  const [period, setPeriod] = useState<PremiumPeriod>(row?.period ?? "month");
  const [deductible, setDeductible] = useState(row ? String(num(row.deductible)) : "");
  const [coverage, setCoverage] = useState(row?.coverage ? String(num(row.coverage)) : "");
  const [renewalDate, setRenewal] = useState(row?.renewal_date?.slice(0, 10) ?? "");
  const [notice, setNotice] = useState(String(row?.notice_months ?? 1));
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [confirm, setConfirm] = useState(false);
  const n = (s: string) => Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
  return (
    <form
      style={{ display: "grid", gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id: row?.id, kind, name: name.trim(), insurer: insurer.trim(), premium: n(premium).toFixed(2), period, deductible: n(deductible).toFixed(2),
          coverage: coverage ? n(coverage).toFixed(2) : null, start_date: row?.start_date ?? null, renewal_date: renewalDate || null,
          notice_months: Math.min(Math.max(Math.round(n(notice)), 0), 24), notes: notes.trim(), sort_order: row?.sort_order ?? next,
        });
      }}
    >
      <div className="pf-ins-kinds">
        {KINDS.map((k) => {
          const S = KIND_STYLE[k];
          return (
            <button type="button" key={k} data-on={kind === k} style={{ ["--c" as string]: S.color }} onClick={() => setKind(k)}>
              <S.Icon size={16} /> {t(S.label)}
            </button>
          );
        })}
      </div>
      <label className="pf-field">{t("Name")}<input className="pf-input" value={name} placeholder={t(KIND_STYLE[kind].label)} onChange={(e) => setName(e.target.value)} /></label>
      <label className="pf-field">{t("Insurer")}<input className="pf-input" value={insurer} onChange={(e) => setInsurer(e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
        <label className="pf-field">{t("Premium")}<input className="pf-input" inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} required /></label>
        <Segmented label={t("Period")} value={period} onChange={setPeriod} options={[{ value: "month", label: t("Month") }, { value: "quarter", label: t("Quarter") }, { value: "year", label: t("Year") }]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="pf-field">{t("Deductible")}<input className="pf-input" inputMode="decimal" value={deductible} onChange={(e) => setDeductible(e.target.value)} /></label>
        <label className="pf-field">{t("Covered up to (optional)")}<input className="pf-input" inputMode="decimal" value={coverage} onChange={(e) => setCoverage(e.target.value)} /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="pf-field">{t("Renewal date")}<input className="pf-input" type="date" value={renewalDate} onChange={(e) => setRenewal(e.target.value)} /></label>
        <label className="pf-field">{t("Notice (months)")}<input className="pf-input" inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} /></label>
      </div>
      <label className="pf-field">{t("Notes")}<input className="pf-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        {onDelete ? (
          <button type="button" className="pf-chip" style={{ color: confirm ? "#fff" : "var(--pf-red)", background: confirm ? "var(--pf-red)" : undefined }} onClick={() => (confirm ? onDelete() : setConfirm(true))}>
            <X size={14} /> {confirm ? t("Tap again to remove this policy") : t("Remove policy")}
          </button>
        ) : <span />}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="pf-chip" onClick={onCancel}>{t("Cancel")}</button>
          <button className="pf-button" type="submit">{t("Save")}</button>
        </div>
      </div>
    </form>
  );
}
