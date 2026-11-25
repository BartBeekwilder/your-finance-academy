"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { LOAN_KINDS, LOAN_STYLE } from "@/components/finance/loanKinds";
import { useFinance } from "@/components/finance/FinanceProvider";
import Sheet from "@/components/finance/Sheet";
import { live, num } from "@/lib/finance/calc";
import { money, monthYear } from "@/lib/finance/format";
import { liveLoans, loanAt, loanSchedule, payoff } from "@/lib/finance/loans";
import type { Loan, LoanKind } from "@/lib/finance/types";
import { intlLocale, t } from "@/lib/i18n";
import { WithYAxis } from "@/components/finance/YAxis";

// Loans — everything you pay off besides the mortgage (study, car, a
// personal loan, a credit card): what's still owed, what goes out a month,
// when you're debt-free and the interest still to pay; a chart of the debt
// going down; a card per loan. The debt goes down by itself every month
// (lib/finance/loans.ts) and counts on the balance sheet; the monthly payment
// can book itself as a fixed cost (recurring.ts stops it once paid off).

type Draft = Omit<Loan, "updated_at" | "deleted_at" | "id"> & { id?: string };

export default function LoansPage() {
  const { data, now, saveLoan, deleteLoan, addCategory, addTransaction, updateTransaction, deleteBalanceItem } = useFinance();
  const currency = data.profile.currency_code;
  const loans = liveLoans(data);
  const [editing, setEditing] = useState<{ row?: Loan; from?: BalanceDebt } | null>(null);
  // Debts kept as a post on the balance sheet (Bart, 25 Nov: his student
  // loan): listed here, each can become a loan — rate and payment added, the
  // post itself goes (so the debt never counts twice).
  const balanceDebts = balanceDebtsOf(data, now);
  const [error, setError] = useState<string | null>(null);

  const rows = loans.map((l) => ({ l, at: loanAt(l, now), end: payoff(l, now) }));
  const owed = rows.reduce((s, r) => s + r.at.balance, 0);
  const monthly = rows.filter((r) => r.at.balance > 0.005).reduce((s, r) => s + num(r.l.monthly), 0);
  const interestLeft = rows.reduce((s, r) => s + (r.end?.interestLeft ?? 0), 0);
  const never = rows.some((r) => r.at.balance > 0.005 && !r.end);
  const free = never ? null : rows.reduce<Date | null>((d, r) => (r.end && (!d || r.end.date > d) ? r.end.date : d), null);

  // A new loan's payment books itself as a fixed cost from this month on,
  // under a "Loans" category (made the first time).
  async function bookPayment(loanId: string, d: Draft) {
    const name = t("Loans");
    const cat = live(data.categories).find((c) => !c.parent_id && !c.is_income_category && c.name.toLowerCase() === name.toLowerCase())
      ?? (await addCategory({ name, icon: "creditcard.fill", color_hex: "8E8E93", is_income_category: false, is_fixed_expense: true }));
    await addTransaction({
      amount: num(d.monthly).toFixed(2), type: "expense", date: new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString(),
      note: d.name || t(LOAN_STYLE[d.kind].label), is_auto_income: false, is_fixed_expense: true, recurrence_id: loanId, category_id: cat.id, account_id: null,
    });
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Loans")}</h1>
        <button className="pf-chip" onClick={() => setEditing({})}>
          <Plus size={14} /> {t("Add loan")}
        </button>
      </header>
      {error && <div className="pf-close-note">{error}</div>}

      {balanceDebts.length > 0 && (
        <section style={{ display: "grid", gap: 8 }}>
          <h2 className="pf-section-title" style={{ margin: 0 }}>{t("Other debts on your balance sheet")}</h2>
          <div className="pf-card">
            {balanceDebts.map((b) => (
              <div key={b.id} className="pf-row" style={{ gap: 12 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontWeight: 600 }}>{b.name}</b>
                  <small style={{ display: "block", fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>{t("No rate or payment yet — the amount only changes when you update it")}</small>
                </span>
                <span className="pf-rounded" style={{ fontWeight: 600 }}>{money(b.value, currency)}</span>
                <button type="button" className="pf-chip" onClick={() => setEditing({ from: b })}>{t("Make it a loan")}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {loans.length === 0 ? (
        <section className="pf-card pf-loan-empty">
          <span className="pf-loan-empty-icons">
            {LOAN_KINDS.slice(0, 4).map((k, i) => {
              const S = LOAN_STYLE[k];
              return <span key={k} style={{ ["--c" as string]: S.color, ["--i" as string]: i }}><S.Icon size={18} /></span>;
            })}
          </span>
          <p>{t("No loans yet. Add your student loan, car loan or anything else you pay off — the debt goes down by itself every month.")}</p>
          <button className="pf-button" onClick={() => setEditing({})}><Plus size={15} /> {t("Add loan")}</button>
        </section>
      ) : (
        <>
          <section className="pf-card pf-loan-hero">
            <div className="pf-loan-figures">
              <Figure label={t("Still owed")} value={money(owed, currency)} big />
              <Figure label={t("Per month")} value={money(monthly, currency)} />
              <Figure label={t("Debt-free")} value={free ? monthYear(free) : never ? "—" : t("Now")} />
              <Figure label={t("Interest still to pay")} value={money(interestLeft, currency)} />
            </div>
            <div className="pf-ins-bar">
              {rows.filter((r) => r.at.balance > 0.005).map((r, i) => (
                <span key={r.l.id} title={`${r.l.name || t(LOAN_STYLE[r.l.kind].label)} ${money(r.at.balance, currency)}`} style={{ flex: r.at.balance, background: LOAN_STYLE[r.l.kind].color, animationDelay: `${i * 0.06}s` }} />
              ))}
            </div>
          </section>

          <DebtChart loans={loans} now={now} currency={currency} />

          <div className="pf-loan-grid">
            {rows.map(({ l, at, end }, i) => {
              const S = LOAN_STYLE[l.kind];
              const start = num(l.balance);
              const paidShare = start > 0 ? Math.min(Math.max(1 - at.balance / start, 0), 1) : 1;
              return (
                <button key={l.id} type="button" className="pf-card pf-loan-card pf-tap" style={{ ["--c" as string]: S.color, animationDelay: `${i * 0.05}s` }} onClick={() => setEditing({ row: l })}>
                  <span className="pf-loan-head">
                    <span className="pf-loan-icon"><S.Icon size={18} /></span>
                    <span style={{ minWidth: 0 }}>
                      <b>{l.name || t(S.label)}</b>
                      <small>{t(S.label)}</small>
                    </span>
                  </span>
                  <span className="pf-rounded pf-loan-left">{money(at.balance, currency)}</span>
                  <span className="pf-loan-track"><span style={{ transform: `scaleX(${paidShare})` }} /></span>
                  <span className="pf-loan-meta">
                    {t("{pct}% paid off", { pct: Math.round(paidShare * 100) })} · {t("{amount} a month", { amount: money(num(l.monthly), currency) })} · {num(l.rate).toLocaleString(intlLocale(), { maximumFractionDigits: 2 })}%
                  </span>
                  <span className="pf-loan-meta" data-warn={!end && at.balance > 0.005 ? true : undefined}>
                    {at.balance <= 0.005
                      ? t("Paid off")
                      : end
                        ? t("Paid off in {month} · {amount} interest to go", { month: monthYear(end.date), amount: money(end.interestLeft, currency) })
                        : num(l.monthly) > 0
                          ? t("Not paid off at this payment — it doesn't cover the interest.")
                          : t("No payment yet — the debt stays as it is.")}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} label={editing?.row ? t("Edit loan") : editing?.from ? t("Make it a loan") : t("Add loan")}>
        {editing && (
          <LoanForm
            key={editing.row?.id ?? editing.from?.id ?? "new"}
            row={editing.row}
            from={editing.from}
            now={now}
            currency={currency}
            next={loans.length}
            onCancel={() => setEditing(null)}
            onSave={async (d, book) => {
              try {
                const id = await saveLoan(d);
                if (book && num(d.monthly) > 0) await bookPayment(id, d);
                // Made from a balance-sheet post: the post goes, the loan takes over.
                if (editing.from) await deleteBalanceItem(editing.from.id);
                // A changed payment: this month's booking follows (the next
                // months copy it).
                const booked = live(data.transactions).find((x) => x.recurrence_id === id && !x.spread_of && new Date(x.date).getMonth() === now.getMonth() && new Date(x.date).getFullYear() === now.getFullYear());
                if (booked && num(booked.amount) !== num(d.monthly)) {
                  const { id: _i, updated_at: _u, deleted_at: _d, ...rest } = booked;
                  void _i; void _u; void _d;
                  await updateTransaction(booked.id, { ...rest, amount: num(d.monthly).toFixed(2) });
                }
                setEditing(null);
                setError(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
            onDelete={editing.row ? () => deleteLoan(editing.row!.id).then(() => setEditing(null)) : undefined}
          />
        )}
      </Sheet>
    </div>
  );
}

function Figure({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--pf-ink-2)" }}>{label}</span>
      <b className="pf-rounded pf-readout" style={{ fontSize: big ? "2.4rem" : "1.25rem", fontWeight: big ? 800 : 700 }}>{value}</b>
    </div>
  );
}

/** The debt going down: one stacked band per loan, from now until the last
 *  one is paid off (at most 100 years). Point at it to read a month. */
function DebtChart({ loans, now, currency }: { loans: Loan[]; now: Date; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const series = useMemo(() => {
    const horizon = Math.min(
      Math.max(...loans.map((l) => { const s = loanSchedule(l); return s.length ? s.length : 1; }), 12),
      1200,
    );
    // Long loans (a low DUO payment runs for decades): at most ~360 points.
    const step = Math.ceil(horizon / 360);
    const months = Array.from({ length: Math.floor(horizon / step) + 1 }, (_, i) => new Date(now.getFullYear(), now.getMonth() + i * step, 1, 12));
    return { months, bands: loans.map((l) => ({ l, values: months.map((m, i) => (i === 0 ? loanAt(l, now).balance : loanAt(l, m).balance)) })) };
  }, [loans, now]);
  const W = 1000, H = 200;
  const n = series.months.length;
  const totals = series.months.map((_, i) => series.bands.reduce((s, b) => s + b.values[i], 0));
  const max = Math.max(1, ...totals);
  const x = (i: number) => (i / Math.max(n - 1, 1)) * W;
  const y = (v: number) => H - (v / max) * (H - 8);
  // Each band sits on the ones before it.
  const areas = series.bands.map((b, k) => {
    const below = series.months.map((_, i) => series.bands.slice(0, k).reduce((s, x2) => s + x2.values[i], 0));
    const top = below.map((v, i) => v + b.values[i]);
    const d = `M${top.map((v, i) => `${x(i)},${y(v)}`).join(" L")} L${below.map((v, i) => `${x(i)},${y(v)}`).reverse().join(" L")} Z`;
    return { b, d };
  });
  const shown = hover ?? 0;
  // Year labels: every 1, 2, 5 or 10 years, so about five fit.
  const years = (series.months[n - 1].getFullYear() - series.months[0].getFullYear()) || 1;
  const every = [1, 2, 5, 10, 20].find((k) => years / k <= 6) ?? 25;
  const xTicks = [{ i: 0, label: monthYear(series.months[0]) }];
  series.months.forEach((m, i) => {
    if (i > 0 && i < n - 1 && m.getMonth() === 0 && m.getFullYear() % every === 0 && x(i) / W > 0.16 && x(i) / W < 0.8) {
      if (!xTicks.some((tk) => tk.label === String(m.getFullYear()))) xTicks.push({ i, label: String(m.getFullYear()) });
    }
  });
  if (n > 1) xTicks.push({ i: n - 1, label: monthYear(series.months[n - 1]) });
  return (
    <section className="pf-card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
        <span>{t("Debt over time")}</span>
        <span key={shown} className="pf-readout"><b style={{ color: "var(--pf-ink)" }}>{monthYear(series.months[shown])}</b> · {money(totals[shown], currency)}</span>
      </div>
      <WithYAxis height={H} currency={currency} ticks={[0, 0.5, 1].map((f) => ({ value: max * f, at: (f * (H - 8)) / H }))}>
      <div
        style={{ position: "relative", height: H, cursor: "crosshair", touchAction: "pan-y" }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.min(Math.max(Math.round(((e.clientX - r.left) / r.width) * (n - 1)), 0), n - 1));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block" }} aria-hidden>
          <defs>
            {areas.map(({ b }) => (
              <linearGradient key={b.l.id} id={`pf-loan-${b.l.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={LOAN_STYLE[b.l.kind].color} stopOpacity="0.75" />
                <stop offset="1" stopColor={LOAN_STYLE[b.l.kind].color} stopOpacity="0.25" />
              </linearGradient>
            ))}
          </defs>
          {/* Gridlines at the axis values. */}
          {[0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />)}
          <g className="pf-tsl-draw">
            {areas.map(({ b, d }) => <path key={b.l.id} d={d} fill={`url(#pf-loan-${b.l.id})`} stroke={LOAN_STYLE[b.l.kind].color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
          </g>
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
      </div>
      <div style={{ position: "relative", height: 14, fontSize: "0.68rem", color: "var(--pf-ink-3)" }}>
        {/* The first and last month, and a year in between every few years. */}
        {xTicks.map(({ i, label }) => (
          <span key={i} style={{ position: "absolute", left: `${(x(i) / W) * 100}%`, transform: i === 0 ? "none" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)", whiteSpace: "nowrap" }}>{label}</span>
        ))}
      </div>
      </WithYAxis>
    </section>
  );
}

function LoanForm({ row, from, now, currency, next, onSave, onCancel, onDelete }: {
  row?: Loan;
  /** A balance-sheet post to turn into this loan (its name and amount). */
  from?: BalanceDebt;
  now: Date;
  currency: string;
  next: number;
  onSave: (d: Draft, book: boolean) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const left = row ? loanAt(row, now).balance : 0;
  const [kind, setKind] = useState<LoanKind>(row?.kind ?? (from ? guessKind(from.name) : "student"));
  const [name, setName] = useState(row?.name ?? from?.name ?? "");
  const [balance, setBalance] = useState(row ? String(left) : from ? from.value.toFixed(2) : "");
  const [rate, setRate] = useState(row ? String(num(row.rate)) : "");
  const [monthly, setMonthly] = useState(row ? String(num(row.monthly)) : "");
  const [book, setBook] = useState(!row);
  const [confirm, setConfirm] = useState(false);
  const n = (s: string) => Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // Saving takes today's stand: what's left now, from here on at this rate
  // and payment.
  const draft: Draft = { id: row?.id, kind, name: name.trim(), balance: n(balance).toFixed(2), rate: n(rate).toFixed(2), monthly: n(monthly).toFixed(2), start_date: today, sort_order: row?.sort_order ?? next };
  const end = payoff(draft, now);
  return (
    <form style={{ display: "grid", gap: 14 }} onSubmit={(e) => { e.preventDefault(); onSave(draft, book); }}>
      <div className="pf-ins-kinds">
        {LOAN_KINDS.map((k) => {
          const S = LOAN_STYLE[k];
          return (
            <button type="button" key={k} data-on={kind === k} style={{ ["--c" as string]: S.color }} onClick={() => setKind(k)}>
              <S.Icon size={16} /> {t(S.label)}
            </button>
          );
        })}
      </div>
      <label className="pf-field">{t("Name")}<input className="pf-input" value={name} placeholder={t(LOAN_STYLE[kind].label)} onChange={(e) => setName(e.target.value)} /></label>
      <label className="pf-field">{t("Left now")}<input className="pf-input" inputMode="decimal" placeholder={money(0, currency)} value={balance} onChange={(e) => setBalance(e.target.value)} required /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="pf-field">{t("Interest rate (%)")}<input className="pf-input" inputMode="decimal" placeholder="0" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
        <label className="pf-field">{t("Monthly payment")}<input className="pf-input" inputMode="decimal" placeholder={money(0, currency)} value={monthly} onChange={(e) => setMonthly(e.target.value)} /></label>
      </div>
      {n(balance) > 0 && (
        <p key={`${end?.months}-${n(monthly)}`} className="pf-readout pf-loan-preview" data-warn={!end ? true : undefined}>
          {end
            ? t("Paid off in {month} · {amount} interest to go", { month: monthYear(end.date), amount: money(end.interestLeft, currency) })
            : n(monthly) > 0
              ? t("Not paid off at this payment — it doesn't cover the interest.")
              : t("No payment yet — the debt stays as it is.")}
        </p>
      )}
      {!row && (
        <button type="button" className="pf-loan-book" aria-pressed={book} onClick={() => setBook((b) => !b)}>
          <span className="pf-loan-switch" />
          {t("Book the monthly payment as a fixed cost")}
        </button>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        {onDelete ? (
          <button type="button" className="pf-chip" style={{ color: confirm ? "#fff" : "var(--pf-red)", background: confirm ? "var(--pf-red)" : undefined }} onClick={() => (confirm ? onDelete() : setConfirm(true))}>
            <X size={14} /> {confirm ? t("Tap again to remove this loan") : t("Remove loan")}
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

type BalanceDebt = { id: string; name: string; value: number };

const MORTGAGE = /hypothe|mortgage|hipotec|immobilier|mutuo/i;

/** Liabilities kept as balance-sheet posts (not mortgages): today's amount —
 *  the latest month's value, else the post's own. */
function balanceDebtsOf(data: ReturnType<typeof useFinance>["data"], now: Date): BalanceDebt[] {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return live(data.balanceItems ?? [])
    .filter((b) => b.side === "liability" && !MORTGAGE.test(b.name))
    .map((b) => {
      const v = live(data.balanceValues ?? []).filter((x) => x.item_id === b.id && x.month <= key).sort((a, b2) => b2.month.localeCompare(a.month))[0];
      return { id: b.id, name: b.name, value: v ? num(v.value) : num(b.current_value) };
    })
    .filter((b) => b.value > 0.005);
}

/** A sensible kind from the post's name. */
function guessKind(name: string): LoanKind {
  if (/studie|student|duo|bafög|bafoeg|étudiant|estudiant|studen/i.test(name)) return "student";
  if (/auto|car\b|wagen|voiture|coche/i.test(name)) return "car";
  if (/creditcard|credit card|kreditkarte/i.test(name)) return "credit";
  return "personal";
}
