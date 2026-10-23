"use client";

import { useMemo, useState } from "react";
import { House, Pencil, Plus, Trash2, X } from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import HouseFill from "@/components/finance/HouseFill";
import Segmented from "@/components/finance/Segmented";
import Sheet from "@/components/finance/Sheet";
import Stat from "@/components/finance/Stat";
import { num } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";
import { combined, extraEffect, ltv, NL, nlMonthlyTaxEffect, ownership, perYear, summarize, type MortgagePart } from "@/lib/finance/mortgage";
import { homes } from "@/lib/finance/realEstate";
import type { MortgagePartRow, Property } from "@/lib/finance/types";
import { intlLocale, t } from "@/lib/i18n";

// Real estate — your home and its mortgage, worked out in full:
//   • a house that fills up with the share that's yours (value − debt), and
//     a time slider to see it fill up over the years to the last payment;
//   • this month's payment split into interest and repayment; the totals
//     over the whole term (interest, everything paid, the end date);
//   • per year how much goes to interest and how much to repayment, with the
//     remaining debt as a line;
//   • each loan part (annuity / linear / interest-only, rate, fixed period);
//   • what extra repayments save, what the end of the fixed-rate period
//     could cost, and — for Dutch homes — the tax effect (renteaftrek minus
//     eigenwoningforfait) and the penalty-free repayment room.
// The home and the parts feed the balance sheet automatically.

const INTEREST = "#ff9f0a";
const REPAY = "#40c8e0";
const EXTRA = "#30d158";

export default function RealEstatePage() {
  const { data, now, saveProperty, deleteProperty, saveMortgagePart, deleteMortgagePart } = useFinance();
  const currency = data.profile.currency_code;
  const list = homes(data);
  const [sel, setSel] = useState(0);
  const home = list[Math.min(sel, list.length - 1)];
  const [editing, setEditing] = useState<{ kind: "property"; row?: Property } | { kind: "part"; row?: MortgagePartRow; propertyId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => p.then(() => setError(null)).catch((e: Error) => setError(e.message));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Real estate")}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {list.length > 1 && (
            <Segmented label={t("Property")} value={String(sel)} onChange={(v) => setSel(Number(v))} options={list.map((h, i) => ({ value: String(i), label: h.property.name || t("Home") }))} />
          )}
          <button className="pf-chip" onClick={() => setEditing({ kind: "property" })}>
            <Plus size={14} /> {t("Add property")}
          </button>
        </div>
      </header>

      {!home ? (
        <div className="pf-card" style={{ padding: 32, display: "grid", gap: 12, justifyItems: "center", textAlign: "center" }}>
          <House size={40} color="#40c8e0" />
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>{t("Add your home")}</h2>
          <p style={{ color: "var(--pf-ink-2)", maxWidth: 460 }}>{t("Enter its value and your mortgage parts to see what you pay in interest and repayment, how much is already yours, and what extra repayments would save.")}</p>
          <button className="pf-button" onClick={() => setEditing({ kind: "property" })}>{t("Add property")}</button>
        </div>
      ) : (
        <HomeView
          key={home.property.id}
          property={home.property}
          parts={home.parts}
          rows={data.mortgageParts.filter((m) => m.property_id === home.property.id && !m.deleted_at)}
          now={now}
          currency={currency}
          onEditProperty={() => setEditing({ kind: "property", row: home.property })}
          onEditPart={(row) => setEditing({ kind: "part", row, propertyId: home.property.id })}
          onAddPart={() => setEditing({ kind: "part", propertyId: home.property.id })}
        />
      )}
      {error && <p style={{ color: "var(--pf-red)" }}>{error}</p>}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} label={t("Edit")}>
        {editing?.kind === "property" && (
          <PropertyForm
            key={editing.row?.id ?? "new"}
            row={editing.row}
            onCancel={() => setEditing(null)}
            onSave={(p) => run(saveProperty(p).then((id) => { setEditing(null); if (!editing.row) setSel(list.length); return id; }))}
            onDelete={editing.row ? () => run(deleteProperty(editing.row!.id).then(() => { setEditing(null); setSel(0); })) : undefined}
          />
        )}
        {editing?.kind === "part" && (
          <PartForm
            key={editing.row?.id ?? "new-part"}
            row={editing.row}
            propertyId={editing.propertyId}
            currency={currency}
            onCancel={() => setEditing(null)}
            onSave={(m) => run(saveMortgagePart(m).then(() => setEditing(null)))}
            onDelete={editing.row ? () => run(deleteMortgagePart(editing.row!.id).then(() => setEditing(null))) : undefined}
          />
        )}
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------

function HomeView({
  property,
  parts,
  rows,
  now,
  currency,
  onEditProperty,
  onEditPart,
  onAddPart,
}: {
  property: Property;
  parts: MortgagePart[];
  rows: MortgagePartRow[];
  now: Date;
  currency: string;
  onEditProperty: () => void;
  onEditPart: (row: MortgagePartRow) => void;
  onAddPart: () => void;
}) {
  const value = num(property.value);
  const [extra, setExtra] = useState(0);
  const [lump, setLump] = useState(0);
  // Extra repayments go to the part with the highest rate (what saves the
  // most interest, and what lenders usually advise).
  const target = parts.reduce<MortgagePart | null>((best, p) => (!best || p.rate > best.rate ? p : best), null);
  const scenario = (p: MortgagePart) =>
    p.id === target?.id
      ? { extraMonthly: (p.extraMonthly ?? 0) + extra, extraFrom: extra ? now : null, lumps: lump ? [{ month: now, amount: lump }] : [] }
      : { extraMonthly: p.extraMonthly ?? 0, lumps: [] };
  const months = useMemo(() => combined(parts, scenario), [parts, extra, lump]); // eslint-disable-line react-hooks/exhaustive-deps
  const years = perYear(months);
  const base = useMemo(() => perYear(combined(parts)), [parts]);
  const nowKey = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nowIndex = Math.max(months.findIndex((m) => m.month.getTime() === nowKey), 0);
  const [offset, setOffset] = useState(0);
  const at = months[Math.min(nowIndex + offset, months.length - 1)] ?? null;
  const atDate = at?.month ?? now;
  const sums = parts.map((p) => summarize(p, atDate, scenario(p)));
  const debt = sums.reduce((t, s) => t + s.balance, 0);
  const thisMonth = parts.map((p) => summarize(p, now, scenario(p)).thisMonth);
  const interestNow = thisMonth.reduce((t, r) => t + (r?.interest ?? 0), 0);
  const repayNow = thisMonth.reduce((t, r) => t + (r?.repayment ?? 0) + (r?.extra ?? 0), 0);
  const totals = parts.map((p) => summarize(p, now, scenario(p)));
  const totalInterest = totals.reduce((t, s) => t + s.totalInterest, 0);
  const totalPaid = totals.reduce((t, s) => t + s.totalPaid, 0);
  const principal = parts.reduce((t, p) => t + p.principal, 0);
  const repaidSoFar = totals.reduce((t, s) => t + s.repaidSoFar, 0);
  const interestSoFar = totals.reduce((t, s) => t + s.interestSoFar, 0);
  const end = totals.reduce((d, s) => (s.end > d ? s.end : d), now);
  const share = ownership(value, debt);
  const fmtMonth = (d: Date) => monthYear(d);
  const maxOffset = Math.max(months.length - 1 - nowIndex, 0);

  // What the extra plan saves (all parts together).
  const effects = parts.map((p) => extraEffect(p, scenario(p)));
  const saved = effects.reduce((t, e) => t + e.interestSaved, 0);
  const sooner = target ? (effects[parts.indexOf(target)]?.monthsSooner ?? 0) : 0;

  // End of the fixed-rate period: the first part that resets, and +1%.
  const resets = parts.filter((p) => p.fixedUntil && p.fixedUntil > now).sort((a, b) => a.fixedUntil!.getTime() - b.fixedUntil!.getTime());
  const nextReset = resets[0]?.fixedUntil ?? null;
  const resetImpact = nextReset
    ? parts.reduce((t, p) => {
        if (!p.fixedUntil || p.fixedUntil.getTime() !== nextReset.getTime()) return t;
        const after = summarize(p, nextReset, { rateFrom: { month: nextReset, rate: p.rate + 1 } }).thisMonth?.payment ?? 0;
        const before = summarize(p, nextReset).thisMonth?.payment ?? 0;
        return t + (after - before);
      }, 0)
    : 0;
  const monthsToReset = nextReset ? (nextReset.getFullYear() - now.getFullYear()) * 12 + nextReset.getMonth() - now.getMonth() : 0;

  const nl = property.country === "NL" ? nlMonthlyTaxEffect(parts, now, value) : null;
  const penaltyFree = principal * NL.penaltyFreeShare;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Hero: the house and the key numbers, with a time slider. */}
      <section className="pf-card pf-re-hero">
        <div className="pf-re-house">
          <HouseFill share={share} label={offset === 0 ? t("today") : fmtMonth(atDate)} />
        </div>
        <div style={{ display: "grid", gap: 14, alignContent: "start", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
            <div>
              <div className="pf-eq-label">{(property.name || t("Home")).toUpperCase()}</div>
              <div className="pf-rounded" style={{ fontSize: "2.2rem", fontWeight: 800, color: "#40c8e0", textShadow: "0 0 28px rgba(64,200,224,.35)" }}>
                {money(value - debt, currency)}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>
                {t("{pct}% of your home is yours", { pct: Math.round(share * 100) })} · {t("value {value} · debt {debt}", { value: money(value, currency), debt: money(debt, currency) })}
              </div>
            </div>
            <button className="pf-icon-button" aria-label={t("Edit")} onClick={onEditProperty}>
              <Pencil size={15} />
            </button>
          </div>
          <div className="pf-re-chips">
            <span className="pf-eq-chip">{t("Loan-to-value")} <b className="pf-rounded">{Math.round(ltv(value, debt) * 100)}%</b></span>
            {property.purchase_price && (
              <span className="pf-eq-chip" data-up={value >= num(property.purchase_price)}>
                {t("Value change since purchase")} <b className="pf-rounded">{money(value - num(property.purchase_price), currency, { signed: true })}</b>
              </span>
            )}
            <span className="pf-eq-chip">{t("Mortgage-free in {month}", { month: fmtMonth(end) })}</span>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
              <span>{t("Look ahead")}</span>
              <b style={{ color: "var(--pf-ink)" }}>{offset === 0 ? t("today") : fmtMonth(atDate)}</b>
            </div>
            <input
              className="pf-re-range"
              type="range"
              min={0}
              max={maxOffset}
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value))}
              aria-label={t("Look ahead")}
              style={{ ["--fill" as string]: `${maxOffset ? (offset / maxOffset) * 100 : 0}%` }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--pf-ink-3)" }}>
              <span>{now.getFullYear()}</span>
              <span>{end.getFullYear()}</span>
            </div>
          </div>
        </div>
      </section>

      {/* This month and the whole term. */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Stat label={t("Payment this month")} value={money(interestNow + repayNow, currency)} hint={t("Interest {interest} · repayment {repayment}", { interest: money(interestNow, currency), repayment: money(repayNow, currency) })} />
        {nl && <Stat label={t("Net after tax (estimate)")} value={money(interestNow + repayNow - nl.effect, currency)} color="var(--pf-green)" hint={t("Mortgage interest deduction {amount} per month", { amount: money(nl.effect, currency) })} />}
        <Stat label={t("Total interest over the term")} value={money(totalInterest, currency)} color={INTEREST} hint={t("{pct}% on top of the loan", { pct: Math.round((totalInterest / Math.max(principal, 1)) * 100) })} />
        <Stat label={t("Total you pay")} value={money(totalPaid, currency)} hint={t("Loan {amount} + interest", { amount: money(principal, currency) })} />
        <Stat label={t("Repaid so far")} value={money(repaidSoFar, currency)} color={REPAY} progress={{ share: repaidSoFar / Math.max(principal, 1), of: money(principal, currency) }} />
        <Stat label={t("Interest paid so far")} value={money(interestSoFar, currency)} color={INTEREST} progress={{ share: interestSoFar / Math.max(totalInterest, 1), of: money(totalInterest, currency) }} />
      </div>

      <YearChart years={years} base={base} now={now} currency={currency} principal={principal} />

      {/* Loan parts. */}
      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="pf-section-title" style={{ margin: 0 }}>{t("Mortgage parts")}</h2>
          <button className="pf-chip" onClick={onAddPart}><Plus size={14} /> {t("Add part")}</button>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {rows.map((row) => {
            const s = sums.find((x) => x.part.id === row.id) ?? summarize(parts.find((p) => p.id === row.id)!, now);
            const tm = s.thisMonth;
            return (
              <button key={row.id} className="pf-card pf-re-part" onClick={() => onEditPart(row)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b>{row.name || t("Loan part")}</b>
                  <span className="pf-re-kind">{t(kindLabel(row.kind))} · {num(row.rate).toLocaleString(intlLocale(), { maximumFractionDigits: 2 })}%</span>
                </div>
                <div className="pf-rounded" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{money(s.balance, currency)}</div>
                <div className="pf-re-bar"><span style={{ width: `${(1 - s.balance / Math.max(num(row.principal), 1)) * 100}%` }} /></div>
                <div style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)", display: "grid", gap: 2 }}>
                  <span>{t("{pct}% repaid of {amount}", { pct: Math.round((1 - s.balance / Math.max(num(row.principal), 1)) * 100), amount: money(num(row.principal), currency) })}</span>
                  {tm && <span>{t("This month {payment} (interest {interest})", { payment: money(tm.payment, currency), interest: money(tm.interest, currency) })}</span>}
                  {row.fixed_until && <span>{t("Rate fixed until {month}", { month: fmtMonth(new Date(row.fixed_until)) })}</span>}
                </div>
              </button>
            );
          })}
          {rows.length === 0 && <p style={{ color: "var(--pf-ink-2)" }}>{t("No mortgage parts yet — add one to see the schedule.")}</p>}
        </div>
      </section>

      {/* Extra repayments, fixed-rate period, Dutch rules. */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <section className="pf-card" style={{ padding: 16, display: "grid", gap: 12 }}>
          <div>
            <h3 style={{ fontWeight: 700 }}>{t("Repay extra")}</h3>
            {parts.length > 1 && target && <p style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>{t("Goes to the part with the highest rate: {part} ({rate}%)", { part: target.name || t("Loan part"), rate: target.rate.toLocaleString(intlLocale(), { maximumFractionDigits: 2 }) })}</p>}
          </div>
          <label className="pf-re-slider">
            <span>{t("Every month")} <b className="pf-rounded">{money(extra, currency)}</b></span>
            <input className="pf-re-range" type="range" min={0} max={1000} step={25} value={extra} onChange={(e) => setExtra(Number(e.target.value))} style={{ ["--fill" as string]: `${extra / 10}%` }} />
          </label>
          <label className="pf-re-slider">
            <span>{t("One-off now")} <b className="pf-rounded">{money(lump, currency)}</b></span>
            <input className="pf-re-range" type="range" min={0} max={50000} step={500} value={lump} onChange={(e) => setLump(Number(e.target.value))} style={{ ["--fill" as string]: `${lump / 500}%` }} />
          </label>
          <div key={`${extra}-${lump}`} className="pf-readout" style={{ display: "grid", gap: 4 }}>
            <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 800, color: EXTRA }}>{money(saved, currency)}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>
              {extra || lump
                ? t("less interest · {part} paid off {n} months sooner", { part: target?.name || t("Loan part"), n: sooner })
                : t("Slide to see what extra repayments save.")}
            </div>
            {property.country === "NL" && lump > 0 && (
              <div style={{ fontSize: "0.72rem", color: lump > penaltyFree ? "var(--pf-orange)" : "var(--pf-ink-3)" }}>
                {t("Usually penalty-free up to {amount} per year (10% of the loan)", { amount: money(penaltyFree, currency) })}
              </div>
            )}
          </div>
        </section>

        {nextReset && (
          <section className="pf-card" style={{ padding: 16, display: "grid", gap: 8, alignContent: "start" }}>
            <h3 style={{ fontWeight: 700 }}>{t("Fixed-rate period")}</h3>
            <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 800 }}>{t("{n} months", { n: monthsToReset })}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>{t("until {month}", { month: fmtMonth(nextReset) })}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>
              {t("If the rate is 1% higher then, you pay about {amount} more per month.", { amount: money(resetImpact, currency) })}
            </div>
          </section>
        )}

        {nl && (
          <section className="pf-card" style={{ padding: 16, display: "grid", gap: 8, alignContent: "start" }}>
            <h3 style={{ fontWeight: 700 }}>{t("Dutch tax (estimate)")}</h3>
            <Row label={t("Deductible interest this month")} value={money(nl.deductibleInterest, currency)} />
            <Row label={t("Eigenwoningforfait per month")} value={money(-nl.forfait, currency)} />
            <Row label={t("Back via the tax ({rate}%)", { rate: (NL.maxDeductionRate * 100).toLocaleString(intlLocale(), { maximumFractionDigits: 2 }) })} value={money(nl.effect, currency)} strong />
            <p style={{ fontSize: "0.68rem", color: "var(--pf-ink-3)" }}>{t("2025 rates; interest-only parts are left out. A rough guide, not tax advice.")}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: strong ? 700 : 400, color: strong ? "var(--pf-green)" : "var(--pf-ink-2)" }}>
      <span>{label}</span>
      <span className="pf-rounded">{value}</span>
    </div>
  );
}

const kindLabel = (k: MortgagePartRow["kind"]) => (k === "annuity" ? "Annuity" : k === "linear" ? "Linear" : "Interest-only");

// ---------------------------------------------------------------------------

/** Per year: interest (orange) and repayment (teal, extra in green) as
 *  stacked bars, the remaining debt as a line; the plan without extra
 *  repayments as a faint dashed line. Hover a year to read it. */
function YearChart({ years, base, now, currency, principal }: { years: ReturnType<typeof perYear>; base: ReturnType<typeof perYear>; now: Date; currency: string; principal: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 200;
  const maxPay = Math.max(1, ...years.map((y) => y.interest + y.repayment + y.extra));
  const shown = hover !== null ? years[hover] : years.find((y) => y.year === now.getFullYear()) ?? years[0];
  const n = Math.max(years.length, 1);
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const line = (ys: ReturnType<typeof perYear>) => ys.map((y, i) => `${i ? "L" : "M"}${x(i)},${H - (y.balance / Math.max(principal, 1)) * H}`).join(" ");
  if (!years.length) return null;
  return (
    <section className="pf-card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{t("Interest and repayment per year")}</span>
        {shown && (
          <span key={shown.year} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
            <b style={{ color: "var(--pf-ink)" }}>{shown.year}</b> · <span style={{ color: INTEREST }}>{t("interest")} {money(shown.interest, currency)}</span> · <span style={{ color: REPAY }}>{t("repayment")} {money(shown.repayment + shown.extra, currency)}</span> · {t("debt after {amount}", { amount: money(shown.balance, currency) })}
          </span>
        )}
      </div>
      <div style={{ position: "relative", height: H }} onMouseLeave={() => setHover(null)}>
        <div className="pf-re-bars">
          {years.map((y, i) => {
            const past = y.year < now.getFullYear();
            return (
              <div key={y.year} className="pf-re-col" data-lit={hover === i} data-now={y.year === now.getFullYear()} onMouseEnter={() => setHover(i)}>
                <div className="pf-re-stack" style={{ height: `${((y.interest + y.repayment + y.extra) / maxPay) * 100}%`, opacity: past ? 0.55 : 1, animationDelay: `${i * 18}ms` }}>
                  <span style={{ flex: y.extra, background: EXTRA }} />
                  <span style={{ flex: y.repayment, background: REPAY }} />
                  <span style={{ flex: y.interest, background: INTEREST }} />
                </div>
              </div>
            );
          })}
        </div>
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
          <path d={line(base)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d={line(years)} fill="none" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" className="pf-re-line" />
        </svg>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--pf-ink-3)" }}>
        <span>{years[0].year}</span>
        <span>{years[Math.floor(years.length / 2)].year}</span>
        <span>{years[years.length - 1].year}</span>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.68rem", color: "var(--pf-ink-2)" }}>
        <Legend color={INTEREST} label={t("Interest")} />
        <Legend color={REPAY} label={t("Repayment")} />
        <Legend color={EXTRA} label={t("Extra repayment")} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: "#fff" }} />{t("Remaining debt")}</span>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------

function PropertyForm({ row, onSave, onCancel, onDelete }: { row?: Property; onSave: (p: Omit<Property, "updated_at" | "deleted_at" | "id"> & { id?: string }) => void; onCancel: () => void; onDelete?: () => void }) {
  const [name, setName] = useState(row?.name ?? t("Home"));
  const [value, setValue] = useState(row ? String(num(row.value)) : "");
  const [purchase, setPurchase] = useState(row?.purchase_price ? String(num(row.purchase_price)) : "");
  const [purchaseDate, setPurchaseDate] = useState(row?.purchase_date?.slice(0, 10) ?? "");
  const [country, setCountry] = useState<Property["country"]>(row?.country ?? "INTL");
  const [confirm, setConfirm] = useState(false);
  const n = (s: string) => Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
  return (
    <form
      style={{ display: "grid", gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ id: row?.id, name: name.trim() || t("Home"), value: n(value).toFixed(2), value_date: null, purchase_price: purchase ? n(purchase).toFixed(2) : null, purchase_date: purchaseDate || null, country, sort_order: row?.sort_order ?? 0 });
      }}
    >
      <FormHead title={row ? t("Edit property") : t("Add property")} onCancel={onCancel} />
      <Field label={t("Name")}><input className="pf-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={t("Current value (WOZ or estimate)")}><input className="pf-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} required /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={t("Purchase price")}><input className="pf-input" inputMode="decimal" value={purchase} onChange={(e) => setPurchase(e.target.value)} /></Field>
        <Field label={t("Purchase date")}><input className="pf-input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></Field>
      </div>
      <Field label={t("Rules")}>
        <Segmented wide label={t("Rules")} value={country} onChange={setCountry} options={[{ value: "INTL", label: t("International") }, { value: "NL", label: t("Netherlands") }]} />
      </Field>
      <button className="pf-button">{t("Save")}</button>
      {onDelete && (
        <button type="button" className="pf-delete-button" data-confirm={confirm} onClick={() => (confirm ? onDelete() : setConfirm(true))} onBlur={() => setConfirm(false)}>
          <Trash2 size={15} /> {confirm ? t("Tap again to remove this property and its mortgage") : t("Remove property")}
        </button>
      )}
    </form>
  );
}

function PartForm({ row, propertyId, currency, onSave, onCancel, onDelete }: { row?: MortgagePartRow; propertyId: string; currency: string; onSave: (m: Omit<MortgagePartRow, "updated_at" | "deleted_at" | "id"> & { id?: string }) => void; onCancel: () => void; onDelete?: () => void }) {
  const today = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const [name, setName] = useState(row?.name ?? t("Loan part"));
  const [kind, setKind] = useState<MortgagePartRow["kind"]>(row?.kind ?? "annuity");
  const [principal, setPrincipal] = useState(row ? String(num(row.principal)) : "");
  const [rate, setRate] = useState(row ? String(num(row.rate)) : "");
  const [start, setStart] = useState(row?.start_date.slice(0, 10) ?? iso(today));
  const [years, setYears] = useState(row ? String(Math.round(row.term_months / 12)) : "30");
  const [fixed, setFixed] = useState(row?.fixed_until?.slice(0, 10) ?? "");
  const [nhg, setNhg] = useState(row?.nhg ?? false);
  const [extra, setExtra] = useState(row ? String(num(row.extra_monthly)) : "0");
  const [confirm, setConfirm] = useState(false);
  const n = (s: string) => Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
  return (
    <form
      style={{ display: "grid", gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id: row?.id, property_id: propertyId, name: name.trim() || t("Loan part"), kind, principal: n(principal).toFixed(2), rate: n(rate).toFixed(4),
          fixed_until: fixed || null, start_date: start, term_months: Math.min(Math.max(Math.round(n(years) * 12), 1), 600), nhg, extra_monthly: n(extra).toFixed(2), sort_order: row?.sort_order ?? 0,
        });
      }}
    >
      <FormHead title={row ? t("Edit loan part") : t("Add loan part")} onCancel={onCancel} />
      <Field label={t("Name")}><input className="pf-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={t("Type")}>
        <Segmented wide label={t("Type")} value={kind} onChange={setKind} options={[{ value: "annuity", label: t("Annuity") }, { value: "linear", label: t("Linear") }, { value: "interest_only", label: t("Interest-only") }]} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={t("Original loan ({currency})", { currency })}><input className="pf-input" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} required /></Field>
        <Field label={t("Interest rate (%)")}><input className="pf-input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} required /></Field>
        <Field label={t("Start")}><input className="pf-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
        <Field label={t("Term (years)")}><input className="pf-input" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} required /></Field>
        <Field label={t("Rate fixed until")}><input className="pf-input" type="date" value={fixed} onChange={(e) => setFixed(e.target.value)} /></Field>
        <Field label={t("Extra repayment per month")}><input className="pf-input" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} /></Field>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: "0.9rem" }}>
        <input type="checkbox" checked={nhg} onChange={(e) => setNhg(e.target.checked)} /> {t("NHG (Dutch mortgage guarantee)")}
      </label>
      <button className="pf-button">{t("Save")}</button>
      {onDelete && (
        <button type="button" className="pf-delete-button" data-confirm={confirm} onClick={() => (confirm ? onDelete() : setConfirm(true))} onBlur={() => setConfirm(false)}>
          <Trash2 size={15} /> {confirm ? t("Tap again to remove this loan part") : t("Remove loan part")}
        </button>
      )}
    </form>
  );
}

function FormHead({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{title}</h2>
      <button type="button" className="pf-icon-button" aria-label={t("Close")} onClick={onCancel}><X size={18} /></button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
      {label}
      {children}
    </label>
  );
}
