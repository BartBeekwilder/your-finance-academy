"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { num, projectedNetIncome } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import { t } from "@/lib/i18n";
import { useFinance } from "./FinanceProvider";
import { newSalary, salaryOf } from "./Payslips";

// In the Income page's Payday tile, once payday has come: tick it off when
// the salary is in. Ticking books the expected net pay on payday, on the
// current account; the tick stays as long as the month has a salary.
// Unticking undoes only a salary this tick booked.

export default function PaydayCheck() {
  const { data, now, addTransaction, deleteTransaction } = useFinance();
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState(false);
  const payday = data.profile.payday_day;
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const salary = salaryOf(data, month);
  const day = payday ? Math.min(payday, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) : 0;
  if (!payday || (now.getDate() < day && !salary)) return null;
  const currency = data.profile.currency_code;
  const expected = projectedNetIncome(data, month);
  const gross = data.profile.expected_gross_monthly != null ? num(data.profile.expected_gross_monthly) : null;
  const done = !!salary;

  async function toggle() {
    setBusy(true);
    try {
      if (!salary) {
        await addTransaction(newSalary(data, month, expected, gross, now));
        setBooked(true);
      } else if (booked) {
        await deleteTransaction(salary.id);
        setBooked(false);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="pf-payday-check"
      data-done={done}
      disabled={busy || (done && !booked) || !(expected > 0)}
      onClick={toggle}
      title={done ? t("{amount} on day {n}", { amount: money(num(salary.amount), currency), n: new Date(salary.date).getDate() }) : t("Tick it off: books {amount} on day {n}", { amount: money(expected, currency), n: day })}
    >
      <span className="pf-payday-tick" aria-hidden>{done && <Check size={16} strokeWidth={3} />}</span>
      <span>{done ? t("Received") : t("Received?")}</span>
    </button>
  );
}
