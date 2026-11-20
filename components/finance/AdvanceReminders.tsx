"use client";

import { HandCoins } from "lucide-react";
import { t } from "@/lib/i18n";
import { money } from "@/lib/finance/format";
import { openTransactionEditor } from "@/lib/finance/editTransaction";
import { useFinance } from "./FinanceProvider";

// Advances that should come back soon (Bart, 20 Nov: "een notificatie
// wanneer we een voorgeschoten bedrag terug gaan krijgen"): from three days
// before the expected date until it's marked paid back.

const DAY = 86_400_000;

export default function AdvanceReminders() {
  const { data, updateTransaction } = useFinance();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = (data.advances ?? [])
    .filter((a) => !a.repaid_at && a.expected_back && new Date(a.expected_back).getTime() - today.getTime() <= 3 * DAY)
    .sort((a, b) => a.expected_back!.localeCompare(b.expected_back!));
  if (!due.length) return null;
  const currency = data.profile.currency_code;
  const when = (iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    const days = Math.round((d.getTime() - today.getTime()) / DAY);
    const date = d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
    return days < 0 ? t("was due on {date}", { date }) : days === 0 ? t("due back today") : t("due back on {date}", { date });
  };
  const paidBack = (id: string) => {
    const a = data.advances?.find((x) => x.id === id);
    if (!a) return;
    const { id: _id, updated_at: _u, deleted_at: _d, ...rest } = a;
    void _id; void _u; void _d;
    void updateTransaction(id, { ...rest, repaid_at: (today < new Date(a.date) ? new Date(a.date) : today).toISOString() });
  };
  return (
    <section className="pf-card pf-advance-due" aria-label={t("Advances to get back")}>
      {due.map((a) => (
        <div key={a.id} className="pf-advance-due-row" data-late={new Date(a.expected_back!) < today || undefined}>
          <span className="pf-acct-icon"><HandCoins size={14} strokeWidth={2.4} /></span>
          <span className="pf-advance-due-text">
            <b className="pf-rounded">{money(Number(a.amount), currency)}</b> {a.note || t("Advance")} · {when(a.expected_back!)}
          </span>
          <button type="button" className="pf-chip" onClick={(e) => openTransactionEditor(a, e.currentTarget)}>{t("Change")}</button>
          <button type="button" className="pf-button pf-advance-due-done" onClick={() => paidBack(a.id)}>{t("Paid back")}</button>
        </div>
      ))}
    </section>
  );
}
