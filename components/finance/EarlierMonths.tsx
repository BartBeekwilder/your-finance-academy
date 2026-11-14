"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, PencilLine, Sparkles, Wand2 } from "lucide-react";
import { intlLocale, t } from "@/lib/i18n";
import { money, monthName, monthYear } from "@/lib/finance/format";
import { evalAmount } from "@/lib/finance/amountExpr";
import { CONFIRM_POINTS, CONFIRM_PREFIX, emptyMonthsSince, estimateMonth, estimatedMonths, type EstimateRow } from "@/lib/finance/estimate";
import { useFinance } from "./FinanceProvider";
import ReadWithAI from "./ReadWithAI";

// Earlier months (Bart, 14 Nov): an empty month can be filled three ways —
// read a bank statement, quick totals, or the estimate — and estimated
// months wait on the dashboard to be confirmed ("Klopt", points) or
// corrected. The setup's "From 1 January" fills the year with the estimate.

/** Set by the setup (sessionStorage): fill the empty months since then. */
export const ESTIMATE_FROM = "pf-estimate-from";
const fromKey = (k: string) => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1);

/** An empty earlier month: fill it in. */
export function FillMonth({ month }: { month: Date }) {
  const { data, now, categories, addTransactions } = useFillContext();
  const currency = data.profile.currency_code;
  const estimate = useMemo(() => estimateMonth(data, month, now), [data, month, now]);
  const [quick, setQuick] = useState(false);
  const [amounts, setAmounts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const label = (r: EstimateRow) =>
    r.type === "income" ? t("Income") : r.note || categories.get(r.category_id ?? "")?.name || t("Expenses");

  async function add(rows: EstimateRow[]) {
    setBusy(true);
    try {
      await addTransactions(rows);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pf-card pf-fill">
      <div className="pf-fill-head">
        <b>{t("{month} is still empty", { month: monthYear(month) })}</b>
        <span>{t("Fill it in, so your year adds up. Choose how:")}</span>
      </div>
      {!quick ? (
        <div className="pf-fill-ways">
          <span className="pf-fill-way">
            <ReadWithAI kind="bank" />
            <small>{t("The AI books every payment on its own date.")}</small>
          </span>
          <button type="button" className="pf-fill-way pf-chip" disabled={!estimate.length} onClick={() => { setAmounts(estimate.map((r) => new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(Number(r.amount)))); setQuick(true); }}>
            <PencilLine size={15} /> {t("Quick totals")}
            <small>{t("One amount for your pay, each fixed cost and each category.")}</small>
          </button>
          <button type="button" className="pf-fill-way pf-chip" disabled={!estimate.length || busy} onClick={() => void add(estimate)}>
            <Wand2 size={15} /> {t("Use the estimate")}
            <small>{estimate.length ? t("Your pay, fixed costs and budgets — marked as estimated until you confirm.") : t("Set your expected pay or budgets first.")}</small>
          </button>
        </div>
      ) : (
        <div className="pf-fill-quick">
          {estimate.map((r, i) => (
            <label key={i} className="pf-fill-row">
              <span>{label(r)}</span>
              <input
                className="pf-input"
                inputMode="decimal"
                value={amounts[i] ?? ""}
                aria-label={label(r)}
                onChange={(e) => setAmounts(amounts.map((a, j) => (j === i ? e.target.value : a)))}
                style={{ color: r.type === "income" ? "var(--pf-green)" : undefined }}
              />
            </label>
          ))}
          <div className="pf-fill-actions">
            <button type="button" className="pf-link" onClick={() => setQuick(false)}>{t("Back")}</button>
            <button
              type="button"
              className="pf-button"
              disabled={busy}
              onClick={() =>
                void add(
                  estimate
                    .map((r, i) => ({ ...r, amount: (evalAmount(amounts[i] ?? "")?.value ?? 0).toFixed(2), estimated: null }))
                    .filter((r) => Number(r.amount) > 0),
                )
              }
            >
              <Check size={15} /> {t("Save {month}", { month: monthName(month) })}
            </button>
          </div>
          <small className="pf-fill-note">{t("Amounts in {currency}; you can type 12,50+30.", { currency })}</small>
        </div>
      )}
    </section>
  );
}

function useFillContext() {
  const { data, now, addTransactions } = useFinance();
  const categories = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  return { data, now, categories, addTransactions };
}

/** Dashboard: the estimated months, to confirm one by one (points) or open
 *  to correct. Hidden when there are none. */
export function ConfirmMonths() {
  const { data, rewrite, awardBadges } = useFinance();
  const months = estimatedMonths(data);
  if (!months.length) return null;
  const currency = data.profile.currency_code;
  const totals = (k: string) => {
    let income = 0, spent = 0;
    for (const x of data.transactions) {
      if (x.deleted_at || x.date.slice(0, 7) !== k) continue;
      if (x.type === "income") income += Number(x.amount);
      else if (x.type === "expense" && !x.advance) spent += Number(x.amount);
    }
    return { income, spent };
  };
  async function confirm(k: string) {
    const stamp = new Date().toISOString();
    rewrite((d) => ({ ...d, transactions: d.transactions.map((x) => (x.estimated && x.date.slice(0, 7) === k ? { ...x, estimated: null, updated_at: stamp } : x)) }));
    await awardBadges([{ code: `${CONFIRM_PREFIX}${k}`, points: CONFIRM_POINTS }]);
  }
  return (
    <section className="pf-card pf-confirm">
      <div className="pf-fill-head">
        <b><Sparkles size={15} /> {t("Confirm your months")}</b>
        <span>{t("These months hold an estimate. Check each one: right, or correct it. +{points} points per month.", { points: CONFIRM_POINTS })}</span>
      </div>
      <ul className="pf-confirm-list">
        {months.map((k) => {
          const m = fromKey(k), s = totals(k);
          return (
            <li key={k}>
              <span className="pf-confirm-month">
                <b>{monthYear(m)}</b>
                <small>
                  <span style={{ color: "var(--pf-green)" }}>{money(s.income, currency)}</span> · <span style={{ color: "var(--pf-red)" }}>{money(s.spent, currency)}</span>
                </small>
              </span>
              <Link className="pf-chip" href={`/app/expenses?month=${k}`}>{t("Correct")}</Link>
              <button type="button" className="pf-button pf-confirm-ok" onClick={() => void confirm(k)}>
                <Check size={14} /> {t("Right")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** After the setup's "From 1 January": the empty months since then get the
 *  estimate, once. Renders nothing. */
export function EstimateHistory() {
  const { data, now, source, addTransactions } = useFinance();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || source === "demo") return;
    let from: string | null = null;
    try {
      from = sessionStorage.getItem(ESTIMATE_FROM);
    } catch {}
    if (!from) return;
    ran.current = true;
    try {
      sessionStorage.removeItem(ESTIMATE_FROM);
    } catch {}
    const rows = emptyMonthsSince(data, fromKey(from), now).flatMap((m) => estimateMonth(data, m, now));
    if (rows.length) void addTransactions(rows);
  }, [data, now, source, addTransactions]);
  return null;
}

/** The month a page should open on: ?month=YYYY-MM (from Confirm your
 *  months), else this month. */
export function monthFromUrl(thisMonth: Date): Date {
  try {
    const k = new URLSearchParams(location.search).get("month");
    if (k && /^\d{4}-\d{2}$/.test(k)) {
      const m = fromKey(k);
      if (m <= thisMonth) return m;
    }
  } catch {}
  return thisMonth;
}

