"use client";

import { Check, Pencil } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { num, projectedNetIncome } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import { t } from "@/lib/i18n";
import { openTransactionEditor } from "@/lib/finance/editTransaction";
import { useFinance } from "./FinanceProvider";
import { newSalary, salaryOf } from "./Payslips";

// In the Income page's Payday tile, once payday has come: tick it off when
// the salary is in. Ticking books the expected net pay on payday, on the
// current account; the tick stays as long as the month has a salary. Once
// ticked, tapping it opens that salary in the editor (amount, gross, date,
// category — or delete it there to untick).

export default function PaydayCheck() {
  const { data, now, addTransaction } = useFinance();
  const [busy, setBusy] = useState(false);
  const payday = data.profile.payday_day;
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const salary = salaryOf(data, month);
  const day = payday ? Math.min(payday, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) : 0;
  if (!payday || (now.getDate() < day && !salary)) return null;
  const currency = data.profile.currency_code;
  const expected = projectedNetIncome(data, month);
  const gross = data.profile.expected_gross_monthly != null ? num(data.profile.expected_gross_monthly) : null;
  const done = !!salary;

  async function toggle(e: MouseEvent<HTMLButtonElement>) {
    if (salary) return openTransactionEditor(salary, e.currentTarget);
    setBusy(true);
    try {
      await addTransaction(newSalary(data, month, expected, gross, now));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="pf-payday-check"
      data-done={done}
      disabled={busy || (!done && !(expected > 0))}
      onClick={toggle}
      aria-label={done ? t("Adjust salary") : t("Tick it off: books {amount} on day {n}", { amount: money(expected, currency), n: day })}
      title={done ? t("{amount} on day {n}", { amount: money(num(salary.amount), currency), n: new Date(salary.date).getDate() }) + " · " + t("Adjust salary") : t("Tick it off: books {amount} on day {n}", { amount: money(expected, currency), n: day })}
    >
      <span className="pf-payday-tick" aria-hidden>{done && <Check size={16} strokeWidth={3} />}</span>
      <span className="pf-payday-label">
        <span>{done ? t("Received") : t("Received?")}</span>
        {done && <span className="pf-payday-edit"><Pencil size={10} strokeWidth={2.6} /> {t("Adjust")}</span>}
      </span>
    </button>
  );
}
