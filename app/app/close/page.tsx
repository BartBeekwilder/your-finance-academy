"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
import BudgetBar from "@/components/finance/BudgetBar";
import CategoryIcon from "@/components/finance/CategoryIcon";
import { useFinance } from "@/components/finance/FinanceProvider";
import { Celebration, Rings } from "@/components/finance/ProgressParts";
import { parseAmount } from "@/components/finance/BalanceSheet";
import { balanceSheet, live, num, projectedNetIncome, spendByCategory } from "@/lib/finance/calc";
import { dayLabel, money, monthName, monthYear } from "@/lib/finance/format";
import { budgetPlan, withGoal, type PlanRow } from "@/lib/finance/budgetPlan";
import { BADGES, POINTS, newBadges } from "@/lib/finance/progress";
import { monthRings, monthSummary, progressModel } from "@/lib/finance/progressModel";
import { t } from "@/lib/i18n";
import { openTransactionEditor } from "@/lib/finance/editTransaction";
import type { Transaction } from "@/lib/finance/types";

// Close the month — five short steps, then the month is in the books:
//   1. Income: what came in against what was expected.
//   2. Fixed costs: this month's fixed costs, and any from last month that
//      are missing (forgotten to enter?).
//   3. Budgets: how each budget ended, and next month's: the ones set carry
//      on; without one, the 3-month average is proposed. A goal per
//      category or for all ("10% less") lowers it. Saved on closing.
//   4. Month-end balances: your own balance-sheet posts (savings, loans…)
//      as they stood on the last day; homes and mortgages fill themselves.
//   5. Summary: saved, savings rate, equity, the rings — then "Close" stores
//      the snapshot, the points and any new badges, with a celebration.

const STEPS = ["Income", "Fixed costs", "Budgets", "Month-end balances", "Summary"] as const;
const GOALS = [0, 0.05, 0.1, 0.2];

export default function ClosePage() {
  const router = useRouter();
  const { data, now, closeMonth, setBalanceValue, setBudget } = useFinance();
  const currency = data.profile.currency_code;
  const model = useMemo(() => progressModel(data, now), [data, now]);
  // Pinned while closing: once stored, the model moves on to the next month
  // (or none), but the celebration is still about this one.
  const [closing, setClosing] = useState<Date | null>(null);
  const month = closing ?? model.closable;
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ points: number; badges: typeof BADGES } | null>(null);
  // Next month's budgets: per category on/off and amount (unset = proposal).
  // goal: the button last picked (null once an amount is typed).
  const [plan, setPlan] = useState<Record<string, { on: boolean; amount: string; goal: number | null }>>({});
  const planRows = useMemo(() => (closing ?? model.closable ? budgetPlan(data, (closing ?? model.closable)!) : []), [data, closing, model.closable]);

  if (!month) {
    return (
      <div className="pf-card" style={{ padding: 32, textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
        <Check size={36} color="#30d158" />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{t("All months are closed")}</h1>
        <p style={{ color: "var(--pf-ink-2)" }}>{t("The next one can be closed on the 1st of next month.")}</p>
        <button className="pf-button" onClick={() => router.push("/app/progress")}>{t("Back to Progress")}</button>
      </div>
    );
  }

  const summary = monthSummary(data, month, now);
  const ringValues = monthRings(data, month);
  const income = live(data.transactions).filter((x) => x.type === "income" && sameMonth(x.date, month));
  const expected = projectedNetIncome(data, month);
  const fixed = live(data.transactions).filter((x) => x.type === "expense" && x.is_fixed_expense && sameMonth(x.date, month));
  const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const prevFixed = live(data.transactions).filter((x) => x.type === "expense" && x.is_fixed_expense && sameMonth(x.date, prevMonth));
  const missing = prevFixed.filter((p) => !fixed.some((f) => (f.recurrence_id && f.recurrence_id === p.recurrence_id) || (f.note === p.note && f.category_id === p.category_id)));
  const budgets = spendByCategory(data, month).filter((e) => e.budget !== null);
  const sheet = balanceSheet(data, now, month);
  const own = [...sheet.assets, ...sheet.liabilities].filter((l) => l.kind === "manual");
  const category = (id: string | null) => data.categories.find((c) => c.id === id);
  const points = POINTS.monthClose + POINTS.ring * summary.rings;
  const rowPlan = (r: PlanRow) => plan[r.category.id] ?? { on: r.current != null, amount: String(r.suggested), goal: 0 };
  const setRow = (r: PlanRow, patch: Partial<{ on: boolean; amount: string; goal: number | null }>) => setPlan((p) => ({ ...p, [r.category.id]: { ...rowPlan(r), ...patch } }));
  const anyBudget = planRows.some((r) => r.current != null);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const go = (d: 1 | -1) => {
    setDir(d);
    setStep((s) => Math.min(Math.max(s + d, 0), STEPS.length - 1));
  };

  async function finish() {
    if (!month) return;
    setClosing(month);
    setBusy(true);
    // Month-end balances first, so the snapshot includes them.
    for (const [id, text] of Object.entries(values)) {
      const v = parseAmount(text);
      if (v !== null) await setBalanceValue(id, month, v);
    }
    // Next month's budgets: changed ones from next month on; switched off = ended.
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    for (const r of planRows) {
      const p = rowPlan(r);
      const amount = p.on ? parseAmount(p.amount) ?? 0 : 0;
      if (Math.abs(amount - (r.current ?? 0)) > 0.004) await setBudget(r.category.id, next, amount);
    }
    const ctx = { ...model.context, closes: model.context.closes + 1, closed: [...model.context.closed, { saved: summary.saved, savingsRate: summary.savingsRate, allBudgetsKept: summary.allBudgetsKept }] };
    const badges = newBadges(ctx, model.have);
    await closeMonth(month, summary, points, badges.map((b) => ({ code: b.code, points: b.points })));
    setDone({ points, badges });
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 760 }}>
      <header style={{ display: "grid", gap: 6 }}>
        <span className="pf-eq-label">{t("CLOSE THE MONTH")}</span>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{monthYear(month)}</h1>
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
        {step === 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            <h2>{t("Did everything come in?")}</h2>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Figure label={t("Received")} value={money(summary.income, currency)} color="var(--pf-green)" />
              <Figure label={t("Expected")} value={money(expected, currency)} />
            </div>
            {summary.income < expected * 0.98 && <p className="pf-close-note">{t("Less than expected came in. Missing a payment? Add it with + before closing.")}</p>}
            <List rows={income.map((x) => ({ tx: x, id: x.id, icon: category(x.category_id), title: x.note || category(x.category_id)?.name || t("Income"), sub: dayLabel(x.date), amount: money(num(x.amount), currency), color: "var(--pf-green)" }))} empty={t("No income entered this month.")} />
          </div>
        )}

        {step === 1 && (
          <div style={{ display: "grid", gap: 12 }}>
            <h2>{t("Are the fixed costs complete?")}</h2>
            <Figure label={t("Fixed costs this month")} value={money(fixed.reduce((s, x) => s + num(x.amount), 0), currency)} />
            {missing.length > 0 && (
              <div className="pf-close-note">
                {t("Last month also had these — not entered this month:")}
                <ul>{missing.map((x) => <li key={x.id}>{x.note || category(x.category_id)?.name} · {money(num(x.amount), currency)}</li>)}</ul>
              </div>
            )}
            <List rows={fixed.map((x) => ({ tx: x, id: x.id, icon: category(x.category_id), title: x.note || category(x.category_id)?.name || t("Expense"), sub: dayLabel(x.date), amount: money(num(x.amount), currency), color: "var(--pf-red)" }))} empty={t("No fixed costs this month.")} />
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: 14 }}>
            <h2>{summary.allBudgetsKept ? t("Every budget kept — well done!") : t("How the budgets ended")}</h2>
            {budgets.map((e) => (
              <div key={e.category.id} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CategoryIcon icon={e.category.icon} colorHex={e.category.color_hex} size={26} />
                  <span style={{ flex: 1 }}>{e.category.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-3)" }}>{money(e.budget ?? 0, currency)}</span>
                </div>
                <BudgetBar spent={e.spent} budget={e.budget ?? 0} color={`#${e.category.color_hex}`} currency={currency} />
              </div>
            ))}
            {budgets.length === 0 && <p style={{ color: "var(--pf-ink-2)" }}>{t("No budgets set for this month.")}</p>}

            {planRows.length > 0 && (
              <div className="pf-plan">
                <div className="pf-plan-head">
                  <div>
                    <h3>{t("Budgets for {month}", { month: monthName(nextMonth) })}</h3>
                    <p>
                      {anyBudget
                        ? t("Your budgets carry on. Set a goal to spend less, or change one.")
                        : t("Proposal: what you spent on average over the last three months. Switch on what you want to keep an eye on.")}
                    </p>
                  </div>
                  <div className="pf-plan-goals">
                    {!anyBudget && (
                      <button type="button" className="pf-chip" onClick={() => setPlan(Object.fromEntries(planRows.map((r) => [r.category.id, { ...rowPlan(r), on: true }])))}>
                        {t("Use the proposal")}
                      </button>
                    )}
                    {GOALS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className="pf-chip pf-chip-sm"
                        onClick={() => setPlan(Object.fromEntries(planRows.map((r) => [r.category.id, { ...rowPlan(r), amount: String(withGoal(r.current ?? r.suggested, g)).replace(".", ","), goal: g }])))}
                      >
                        {g ? t("All {pct} less", { pct: `${g * 100}%` }) : t("All as they are")}
                      </button>
                    ))}
                  </div>
                </div>
                {planRows.map((r) => {
                  const p = rowPlan(r);
                  const base = r.current ?? r.suggested;
                  const amount = parseAmount(p.amount) ?? 0;
                  const vs = r.average > 0 ? amount / r.average - 1 : null;
                  return (
                    <div key={r.category.id} className="pf-plan-row" data-off={!p.on || undefined}>
                      <button type="button" className="pf-plan-switch" role="switch" aria-checked={p.on} aria-label={r.category.name} onClick={() => setRow(r, { on: !p.on })}>
                        <i />
                      </button>
                      <CategoryIcon icon={r.category.icon} colorHex={r.category.color_hex} size={26} />
                      <span className="pf-plan-name">
                        {r.category.name}
                        <small>
                          {t("avg {amount}", { amount: money(r.average, currency) })} · {monthName(month)} {money(r.spent, currency)}
                        </small>
                      </span>
                      <span className="pf-plan-chips">
                        {GOALS.map((g) => {
                          const v = withGoal(base, g);
                          return (
                            <button key={g} type="button" disabled={!p.on} aria-pressed={p.on && p.goal === g} onClick={() => setRow(r, { amount: String(v).replace(".", ","), goal: g })}>
                              {g ? `−${g * 100}%` : "="}
                            </button>
                          );
                        })}
                      </span>
                      <input className="pf-input pf-rounded pf-plan-input" inputMode="decimal" disabled={!p.on} aria-label={t("Budget for {name}", { name: r.category.name })} value={p.amount} onChange={(e) => setRow(r, { amount: e.target.value, goal: null })} />
                      <span className="pf-plan-vs pf-rounded" title={t("Compared with your average")} style={{ color: vs == null || !p.on ? "var(--pf-ink-3)" : Math.round(vs * 100) < 0 ? "var(--pf-green)" : "var(--pf-ink-2)" }}>
                        {p.on && vs != null ? (Math.round(vs * 100) === 0 ? "0%" : `${vs > 0 ? "+" : "−"}${Math.abs(Math.round(vs * 100))}%`) : ""}
                      </span>
                    </div>
                  );
                })}
                <p className="pf-plan-foot">{t("Saved when you close the month. Fixed costs aren't budgeted here.")}</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: 12 }}>
            <h2>{t("Balances on the last day of {month}", { month: monthYear(month) })}</h2>
            <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("Check your own posts against your bank and loan statements. Homes, mortgages and accounts fill themselves.")}</p>
            {own.map((l) => (
              <label key={l.id} className="pf-ob-line pf-ob-labeled">
                <span>{l.name}</span>
                <input className="pf-input pf-ob-amount" inputMode="decimal" value={values[l.id] ?? String(Math.round(l.value * 100) / 100).replace(".", ",")} onChange={(e) => setValues({ ...values, [l.id]: e.target.value })} />
              </label>
            ))}
            {own.length === 0 && <p style={{ color: "var(--pf-ink-3)" }}>{t("No own posts on your balance sheet — nothing to check.")}</p>}
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, alignItems: "center" }}>
            <div style={{ display: "grid", gap: 14 }}>
              <h2>{t("{month} in short", { month: monthYear(month) })}</h2>
              <Figure label={t("Saved")} value={money(summary.saved, currency, { signed: true })} color={summary.saved >= 0 ? "var(--pf-green)" : "var(--pf-red)"} />
              <Figure label={t("Savings rate")} value={`${Math.round(summary.savingsRate * 100)}%`} />
              <Figure label={t("Equity at month end")} value={money(summary.equity, currency)} color="#40c8e0" />
              <Figure label={t("Points for this close")} value={`+${points}`} color="#ffd60a" />
            </div>
            <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
              <Rings {...ringValues} size={190} />
              <span style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>{t("{n} of 3 rings closed", { n: summary.rings })}</span>
            </div>
          </div>
        )}
      </section>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {step > 0 ? <button className="pf-link" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => go(-1)}><ArrowLeft size={15} /> {t("Back")}</button> : <span />}
        {step < STEPS.length - 1 ? (
          <button className="pf-button" style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }} onClick={() => go(1)}>{t("Continue")} <ArrowRight size={16} /></button>
        ) : (
          <button className="pf-button" disabled={busy} onClick={finish}>{busy ? t("Closing…") : t("Close {month}", { month: monthYear(month) })}</button>
        )}
      </div>

      {done && (
        <Celebration
          title={t("{month} is in the books!", { month: monthYear(month) })}
          lines={[{ icon: "calendar-check", text: t("Month closed"), points: POINTS.monthClose }, ...(summary.rings ? [{ icon: "target", text: t("{n} of 3 rings closed", { n: summary.rings }), points: POINTS.ring * summary.rings }] : []), ...done.badges.map((b) => ({ icon: b.icon, text: t(b.title), points: b.points }))]}
          onClose={() => router.push("/app/progress")}
        />
      )}
    </div>
  );
}

const sameMonth = (iso: string, m: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
};

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{label}</div>
      <div className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

/** The month's lines; each opens in the editor to correct or delete it. */
function List({ rows, empty }: { rows: { tx: Transaction; id: string; icon?: { icon: string; color_hex: string }; title: string; sub: string; amount: string; color: string }[]; empty: string }) {
  if (!rows.length) return <p style={{ color: "var(--pf-ink-3)" }}>{empty}</p>;
  return (
    <div className="pf-card" style={{ background: "var(--pf-card-2)" }}>
      {rows.map((r) => (
        <button key={r.id} type="button" className="pf-row pf-close-line" onClick={(e) => openTransactionEditor(r.tx, e.currentTarget)}>
          <CategoryIcon icon={r.icon?.icon ?? "questionmark.circle.fill"} colorHex={r.icon?.color_hex ?? "808080"} size={28} />
          <div style={{ flex: 1, textAlign: "left" }}>
            <div>{r.title}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
              {r.sub}
              {r.tx.type === "income" && !r.tx.account_id && <span className="pf-close-pending"> · {t("Still to receive")}</span>}
            </div>
          </div>
          <span className="pf-rounded" style={{ color: r.color, fontWeight: 600 }}>{r.amount}</span>
          <ChevronRight size={16} className="pf-close-chev" />
        </button>
      ))}
    </div>
  );
}
