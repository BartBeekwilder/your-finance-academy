"use client";

import { live, num, projectedNetIncome } from "@/lib/finance/calc";
import { editProps } from "@/lib/finance/editTransaction";
import { money } from "@/lib/finance/format";
import { isMortgagePayment } from "@/lib/finance/mortgageCheck";
import { upcomingFixedCosts } from "@/lib/finance/recurring";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { intlLocale, t } from "@/lib/i18n";
import CategoryIcon from "./CategoryIcon";
import MortgageHint, { LoanHint } from "./MortgageHint";

// Expenses › Month: every fixed cost of the month in one place (Bart, 25 Nov:
// "it must be clearer what's fixed per month") — paid, booked for a later
// day, or still to come (a recurring cost not booked yet), with the month's
// total, what's left to pay and the share of the net income it takes.

type Row = { tx: Transaction; state: "paid" | "planned" | "expected" };

export function fixedCostsOf(data: FinanceData, month: Date, now: Date) {
  const isThis = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const inMonth = (x: Transaction) => { const d = new Date(x.date); return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth(); };
  const rows: Row[] = [
    ...live(data.transactions).filter((x) => x.type === "expense" && x.is_fixed_expense && !x.spread_of && inMonth(x)).map((tx) => ({ tx, state: new Date(tx.date) <= now ? ("paid" as const) : ("planned" as const) })),
    ...(isThis ? upcomingFixedCosts(data, now).map((tx) => ({ tx, state: "expected" as const })) : []),
  ].sort((a, b) => new Date(a.tx.date).getDate() - new Date(b.tx.date).getDate() || num(b.tx.amount) - num(a.tx.amount));
  const total = rows.reduce((s, r) => s + num(r.tx.amount), 0);
  const paid = rows.filter((r) => r.state === "paid").reduce((s, r) => s + num(r.tx.amount), 0);
  return { rows, total, paid, toCome: total - paid };
}

export default function FixedCosts({ data, month, now, currency }: { data: FinanceData; month: Date; now: Date; currency: string }) {
  const { rows, total, paid, toCome } = fixedCostsOf(data, month, now);
  if (!rows.length) return null;
  const income = projectedNetIncome(data, month);
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const isMortgage = isMortgagePayment(data);
  const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(), { day: "numeric", month: "short" });
  return (
    <section className="pf-readout" style={{ display: "grid", gap: 8 }}>
      <h2 className="pf-section-title" style={{ margin: 0 }}>{t("Fixed costs per month")}</h2>
      <div className="pf-card pf-fixed">
        <div className="pf-fixed-head">
          <div>
            <b className="pf-rounded">{money(total, currency)}</b>
            <span>
              {toCome > 0.005 ? t("{paid} paid · {left} still to come", { paid: money(paid, currency), left: money(toCome, currency) }) : t("All paid this month")}
            </span>
          </div>
          {income > 0 && (
            <span className="pf-fixed-share">
              <b className="pf-rounded">{Math.round((total / income) * 100)}%</b>
              <small>{t("of your net income")}</small>
            </span>
          )}
        </div>
        <div className="pf-fixed-bar" aria-hidden>
          <span style={{ width: `${total > 0 ? (paid / total) * 100 : 0}%` }} />
        </div>
        {rows.map(({ tx, state }) => {
          const c = tx.category_id ? cats.get(tx.category_id) : undefined;
          return (
            <div key={tx.id} className="pf-row pf-fixed-row" data-state={state} {...(state === "expected" ? {} : editProps(tx))}>
              <CategoryIcon icon={c?.icon ?? "questionmark.circle.fill"} colorHex={c?.color_hex ?? "808080"} size={28} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "0.9rem" }}>{tx.note || c?.name || t("Expense")}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
                  {state === "paid" ? t("Paid {date}", { date: day(tx.date) }) : state === "planned" ? t("Booked for {date}", { date: day(tx.date) }) : t("Expected {date} · like last month", { date: day(tx.date) })}
                </div>
                {isMortgage(tx) ? <MortgageHint amount={num(tx.amount)} date={tx.date} editing={tx} /> : tx.recurrence_id ? <LoanHint tx={tx} /> : null}
              </div>
              <span className="pf-rounded" style={{ fontWeight: 600 }}>{money(num(tx.amount), currency)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
