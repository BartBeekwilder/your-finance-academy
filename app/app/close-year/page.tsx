"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import YearWrapped from "@/components/finance/YearWrapped";
import CategoryIcon from "@/components/finance/CategoryIcon";
import Segmented from "@/components/finance/Segmented";
import { useFinance } from "@/components/finance/FinanceProvider";
import { Celebration } from "@/components/finance/ProgressParts";
import { parseAmount } from "@/components/finance/BalanceSheet";
import { dayLabel, money } from "@/lib/finance/format";
import { nextYearGoals } from "@/lib/finance/yearWrapped";
import { YEAR_CLOSE_POINTS, YEAR_CLOSE_PREFIX, closableYear, yearCloseData } from "@/lib/finance/yearCloseModel";
import { t } from "@/lib/i18n";

// Close the year — after December is closed, six short steps:
//   1. Your year: Year Wrapped — the year's savings, month by month, where
//      it went, investments, equity and the year in facts.
//   2. For your tax return: the balance sheet on the last day (the stand on
//      1 January), mortgage interest paid, gross and net income, payslips.
//   3. Yearly costs: fixed costs against the year before, and the insurance
//      policies that renew in the coming year (with their cancel-by date).
//   4. Opening balances: each account's balance for the new year — the start
//      of this year plus what the year added, to check against the bank.
//   5. Next year: a savings goal (this year's savings, or 10% / 20% more).
//   6. Summary — "Close" moves the accounts on to the new year, keeps the
//      start balances with the close, saves the goal and gives the points.
// Any other year (the running one, or one already closed) shows its Year
// Wrapped only.

const STEPS = ["Your year", "For your tax return", "Yearly costs", "Opening balances", "Next year", "Summary"] as const;

export default function CloseYearPage() {
  return (
    <Suspense>
      <CloseYear />
    </Suspense>
  );
}

function CloseYear() {
  const router = useRouter();
  const params = useSearchParams();
  const asked = Number(params.get("year")) || null;
  // Dev only: walk through all the steps of a year that can't be closed yet
  // (the Close button stays off).
  const preview = process.env.NODE_ENV === "development" && params.get("preview") === "1";
  const { data, now, updateProfile, saveAccount, saveGoal, awardBadges } = useFinance();
  const currency = data.profile.currency_code;
  const closable = closableYear(data, now);
  // Pinned once closing starts: after the close the year is no longer closable.
  const [closing, setClosing] = useState<number | null>(null);
  const year = closing ?? asked ?? closable ?? now.getFullYear();
  const canClose = closing != null || year === closable || preview;
  const y = useMemo(() => yearCloseData(data, year, now), [data, year, now]);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const goals = nextYearGoals(y.wrap.saved);
  const [goal, setGoal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const goalAmount = goal == null ? null : parseAmount(goal);

  const go = (d: 1 | -1) => {
    setDir(d);
    setStep((s) => Math.min(Math.max(s + d, 0), STEPS.length - 1));
  };

  async function finish() {
    setClosing(year);
    setBusy(true);
    const start = Object.fromEntries(y.accounts.map((a) => [a.account.id, a.start]));
    // The new year's opening balances (what was typed, else the proposal).
    for (const a of y.accounts) {
      const v = parseAmount(balances[a.account.id] ?? "") ?? a.proposed;
      if (Math.abs(v - a.start) > 0.004) await saveAccount({ id: a.account.id, name: a.account.name, type: a.account.type, balance: Math.round(v * 100) / 100 });
    }
    if (goalAmount && goalAmount > 0) {
      await saveGoal({ kind: "save", name: t("Save in {year}", { year: String(year + 1) }), target: String(goalAmount), start_value: "0", target_date: `${year + 1}-12-31`, category_id: null, achieved_at: null, sort_order: data.goals.length, created_at: new Date(year + 1, 0, 1).toISOString() });
    }
    const w = y.wrap;
    await updateProfile({
      year_closes: [
        ...(data.profile.year_closes ?? []).filter((c) => c.year !== year),
        { year, closed_at: new Date().toISOString(), accounts_start: start, summary: { income: w.income, spent: w.spent, saved: w.saved, savingsRate: w.savingsRate, equity: w.equityEnd }, points: YEAR_CLOSE_POINTS },
      ],
    });
    await awardBadges([{ code: `${YEAR_CLOSE_PREFIX}${year}`, points: YEAR_CLOSE_POINTS }]);
    setBusy(false);
    setDone(true);
  }

  if (!canClose) {
    return (
      <div style={{ display: "grid", gap: 20, maxWidth: 760 }}>
        <header style={{ display: "grid", gap: 6 }}>
          <span className="pf-eq-label">{y.closed ? t("YEAR CLOSED") : t("YOUR YEAR SO FAR")}</span>
          <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{year}</h1>
          <p style={{ color: "var(--pf-ink-2)" }}>
            {y.closed
              ? t("Closed on {date}.", { date: dayLabel(y.closed.closed_at) })
              : year === now.getFullYear()
                ? t("You can close {year} once December is closed, in January.", { year: String(year) })
                : t("Close December {year} first; then the year can be closed.", { year: String(year) })}
          </p>
        </header>
        <YearWrapped w={y.wrap} data={data} currency={currency} />
      </div>
    );
  }

  const nextYear = year + 1;
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 760 }}>
      <header style={{ display: "grid", gap: 6 }}>
        <span className="pf-eq-label">{t("CLOSE THE YEAR")}</span>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{year}</h1>
        <div className="pf-close-steps">
          {STEPS.map((s, i) => (
            <button key={s} data-state={i < step ? "done" : i === step ? "now" : "next"} onClick={() => { setDir(i > step ? 1 : -1); setStep(i); }}>
              <span>{i < step ? <Check size={12} /> : i + 1}</span>
              {t(s)}
            </button>
          ))}
        </div>
      </header>

      <section key={step} className="pf-card pf-close-step" data-dir={dir}>
        {step === 0 && <YearWrapped w={y.wrap} data={data} currency={currency} />}

        {step === 1 && (
          <div style={{ display: "grid", gap: 14 }}>
            <h2>{t("For your tax return")}</h2>
            <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("What you own and owe on 31 December {year} — the stand on 1 January that the tax return asks for. Not tax advice: check it against your bank's annual statements.", { year: String(year) })}</p>
            <div className="pf-yc-cols">
              <Lines title={t("You own")} rows={y.tax.assets} total={y.tax.totalAssets} currency={currency} />
              <Lines title={t("You owe")} rows={y.tax.liabilities} total={y.tax.totalDebt} currency={currency} />
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <Figure label={t("Equity on 31 December")} value={money(y.tax.equity, currency)} color="#40c8e0" />
              {y.tax.hasHome && <Figure label={t("Mortgage interest paid")} value={money(y.tax.mortgageInterest, currency)} />}
              <Figure label={t("Net income")} value={money(y.tax.net, currency)} color="var(--pf-green)" />
              {y.tax.grossKnown && <Figure label={t("Gross income")} value={money(y.tax.gross, currency)} />}
            </div>
            <p className="pf-close-note">
              {y.tax.payslips >= 12
                ? t("All twelve payslips of {year} are kept. Add your annual salary statement too when it arrives.", { year: String(year) })
                : t("{n} of 12 payslips of {year} kept. Your employer's annual salary statement has the official totals.", { n: y.tax.payslips, year: String(year) })}
            </p>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: 14 }}>
            <h2>{t("Yearly costs")}</h2>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <Figure label={t("Fixed costs in {year}", { year: String(year) })} value={money(y.costs.fixedTotal, currency)} color="var(--pf-red)" />
              {y.costs.fixedBeforeTotal != null && <Figure label={t("The year before")} value={money(y.costs.fixedBeforeTotal, currency)} />}
              {y.costs.insurancePerYear > 0 && <Figure label={t("Insurance per year")} value={money(y.costs.insurancePerYear, currency)} />}
            </div>
            {y.costs.fixed.length > 0 && (
              <div className="pf-card" style={{ background: "var(--pf-card-2)" }}>
                {y.costs.fixed.map((r) => {
                  const change = r.before ? r.spent / r.before - 1 : null;
                  return (
                    <div key={r.category?.id ?? "none"} className="pf-row">
                      <CategoryIcon icon={r.category?.icon ?? "questionmark.circle.fill"} colorHex={r.category?.color_hex ?? "808080"} size={28} />
                      <span style={{ flex: 1 }}>{r.category?.name ?? t("No category")}</span>
                      {change != null && Math.abs(change) >= 0.005 && (
                        <span className="pf-rounded" style={{ fontSize: "0.78rem", color: change > 0 ? "var(--pf-red)" : "var(--pf-green)" }}>{change > 0 ? "+" : "−"}{Math.abs(Math.round(change * 100))}%</span>
                      )}
                      <span className="pf-rounded" style={{ fontWeight: 600, minWidth: 96, textAlign: "right" }}>{money(r.spent, currency)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {y.costs.renewals.length > 0 && (
              <>
                <h3 style={{ fontSize: "1rem" }}>{t("Renewing in the next 12 months")}</h3>
                <div className="pf-card" style={{ background: "var(--pf-card-2)" }}>
                  {y.costs.renewals.map(({ policy, r }) => (
                    <div key={policy.id} className="pf-row">
                      <span style={{ flex: 1 }}>
                        {policy.name || policy.insurer}
                        <small style={{ display: "block", fontSize: "0.72rem", color: r.canStillCancel ? "var(--pf-ink-2)" : "var(--pf-ink-3)" }}>
                          {r.canStillCancel ? t("Cancel by {date}", { date: dayLabel(r.cancelBy.toISOString()) }) : t("Too late to cancel this time")}
                        </small>
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>{dayLabel(r.next.toISOString())}</span>
                    </div>
                  ))}
                </div>
                <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("A good moment to compare: switching before the cancel-by date often saves money.")}</p>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: 12 }}>
            <h2>{t("Opening balances for {year}", { year: String(nextYear) })}</h2>
            <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("Each account starts {year} with what it had at the start of {last} plus what {last} added. Check it against your bank on 31 December and correct it if needed.", { year: String(nextYear), last: String(year) })}</p>
            {y.accounts.map((a) => (
              <label key={a.account.id} className="pf-ob-line pf-ob-labeled">
                <span>
                  {a.account.name}
                  <small style={{ display: "block", fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>
                    {money(a.start, currency)} {a.flow >= 0 ? "+" : "−"} {money(Math.abs(a.flow), currency)}
                  </small>
                </span>
                <input className="pf-input pf-ob-amount" inputMode="decimal" value={balances[a.account.id] ?? String(Math.round(a.proposed * 100) / 100).replace(".", ",")} onChange={(e) => setBalances({ ...balances, [a.account.id]: e.target.value })} />
              </label>
            ))}
            {y.accounts.length === 0 && <p style={{ color: "var(--pf-ink-3)" }}>{t("No accounts yet — nothing to carry over.")}</p>}
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "grid", gap: 14 }}>
            <h2>{t("A goal for {year}", { year: String(nextYear) })}</h2>
            <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>
              {y.wrap.saved > 0
                ? t("In {year} you saved {amount}. How much do you want to save in {next}?", { year: String(year), amount: money(y.wrap.saved, currency), next: String(nextYear) })
                : t("How much do you want to save in {next}?", { next: String(nextYear) })}
            </p>
            <Segmented
              label={t("Savings goal")}
              value={goal == null ? "none" : goals.includes(goalAmount ?? NaN) ? String(goalAmount) : "own"}
              onChange={(v) => v !== "own" && setGoal(v === "none" ? null : v)}
              options={[
                ...goals.map((g, i) => ({ value: String(g), label: `${money(g, currency)} · ${i === 0 ? t("same") : `+${i * 10}%`}` })),
                ...(goal != null && !goals.includes(goalAmount ?? NaN) ? [{ value: "own", label: t("Own amount") }] : []),
                { value: "none", label: t("No goal") },
              ]}
            />
            <label className="pf-ob-line pf-ob-labeled">
              <span>{t("Own amount")}</span>
              <input className="pf-input pf-ob-amount" inputMode="decimal" value={goal ?? ""} placeholder="0" onChange={(e) => setGoal(e.target.value || null)} />
            </label>
            {goalAmount != null && goalAmount > 0 && <p className="pf-close-note">{t("That's {amount} a month. You'll find the goal under Progress.", { amount: money(goalAmount / 12, currency) })}</p>}
          </div>
        )}

        {step === 5 && (
          <div style={{ display: "grid", gap: 14 }}>
            <h2>{t("{year} in short", { year: String(year) })}</h2>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <Figure label={t("Saved")} value={money(y.wrap.saved, currency, { signed: true })} color={y.wrap.saved >= 0 ? "var(--pf-green)" : "var(--pf-red)"} />
              <Figure label={t("Savings rate")} value={`${Math.round(y.wrap.savingsRate * 100)}%`} />
              <Figure label={t("Equity at year end")} value={money(y.wrap.equityEnd, currency)} color="#40c8e0" />
              <Figure label={t("Points for this close")} value={`+${YEAR_CLOSE_POINTS}`} color="#ffd60a" />
            </div>
            <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("Closing moves your accounts on to {year}. Year Wrapped stays available under Progress.", { year: String(nextYear) })}</p>
          </div>
        )}
      </section>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {step > 0 ? <button className="pf-link" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => go(-1)}><ArrowLeft size={15} /> {t("Back")}</button> : <span />}
        {step < STEPS.length - 1 ? (
          <button className="pf-button" style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }} onClick={() => go(1)}>{t("Continue")} <ArrowRight size={16} /></button>
        ) : (
          <button className="pf-button" disabled={busy || done || (preview && year !== closable)} onClick={finish}>{busy ? t("Closing…") : t("Close {year}", { year: String(year) })}</button>
        )}
      </div>

      {done && (
        <Celebration
          title={t("{year} is in the books!", { year: String(year) })}
          lines={[{ icon: "trophy", text: t("Year closed"), points: YEAR_CLOSE_POINTS }, ...(goalAmount && goalAmount > 0 ? [{ icon: "flag", text: t("Goal for {year}: {amount}", { year: String(nextYear), amount: money(goalAmount, currency) }) }] : [])]}
          onClose={() => router.push("/app/progress")}
        />
      )}
    </div>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{label}</div>
      <div className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Lines({ title, rows, total, currency }: { title: string; rows: { id: string; name: string; value: number }[]; total: number; currency: string }) {
  return (
    <div className="pf-card" style={{ background: "var(--pf-card-2)" }}>
      <div className="pf-row" style={{ fontWeight: 700 }}>
        <span style={{ flex: 1 }}>{title}</span>
        <span className="pf-rounded">{money(total, currency)}</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="pf-row" style={{ fontSize: "0.9rem" }}>
          <span style={{ flex: 1, color: "var(--pf-ink-2)" }}>{r.name}</span>
          <span className="pf-rounded">{money(r.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}
