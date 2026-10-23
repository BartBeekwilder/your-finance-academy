"use client";

import { intlLocale, t as tr } from "@/lib/i18n";
import { live, num } from "@/lib/finance/calc";
import { dayLabel, money, monthName } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import { editProps } from "@/lib/finance/editTransaction";
import CategoryIcon from "./CategoryIcon";

/** This month's expenses (or income), newest first, grouped by day with a
 *  subtotal. Shown on the Expenses and Income pages in Month view. */
export default function MonthTransactions({ data, month, currency, kind }: { data: FinanceData; month: Date; currency: string; kind: "expense" | "income" }) {
  const categories = new Map(data.categories.map((c) => [c.id, c]));
  const rows = live(data.transactions)
    .filter((t) => {
      const d = new Date(t.date);
      return t.type === kind && d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const days = new Map<string, typeof rows>();
  for (const t of rows) {
    const key = new Date(t.date).toDateString();
    days.set(key, [...(days.get(key) ?? []), t]);
  }
  let n = 0;

  return (
    <section key="month" className="pf-readout">
      <h2 className="pf-section-title">
        {tr("Transactions in {month}", { month: monthName(month) })}{" "}
        <span style={{ textTransform: "none", color: "var(--pf-ink-3)" }}>
          · {kind === "expense" ? (rows.length === 1 ? tr("1 expense") : tr("{n} expenses", { n: rows.length })) : rows.length === 1 ? tr("1 payment") : tr("{n} payments", { n: rows.length })}
        </span>
      </h2>
      <div className="pf-card">
        {[...days.entries()].map(([key, list]) => (
          <div key={key}>
            <div className="pf-day-head">
              <span>{dayLabel(list[0].date)}</span>
              <span className="pf-rounded">{money(list.reduce((t, x) => t + num(x.amount), 0), currency)}</span>
            </div>
            {list.map((t) => {
              const c = t.category_id ? categories.get(t.category_id) : undefined;
              return (
                <div key={t.id} className="pf-row pf-row-in" {...editProps(t)} style={{ animationDelay: `${Math.min(n++, 20) * 25}ms` }}>
                  <CategoryIcon icon={c?.icon ?? "questionmark.circle.fill"} colorHex={c?.color_hex ?? "808080"} size={32} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.95rem" }}>{t.note || c?.name || (kind === "expense" ? tr("Expense") : tr("Income"))}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
                      {c?.name ?? tr("No category")}
                      {t.is_fixed_expense && <span className="pf-fixed-tag">{tr("Fixed")}</span>}
                      {t.is_auto_income && <span className="pf-auto-tag">{tr("Automatic")}</span>}
                    </div>
                  </div>
                  <span className="pf-rounded" style={{ fontWeight: 600, color: kind === "expense" ? "var(--pf-red)" : "var(--pf-green)" }}>
                    {money(num(t.amount), currency)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="pf-row" style={{ color: "var(--pf-ink-2)" }}>{kind === "expense" ? tr("No expenses yet this month.") : tr("Nothing received yet this month.")}</div>
        )}
      </div>
    </section>
  );
}
