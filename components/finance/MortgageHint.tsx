"use client";

import { num } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import { mortgageMonth } from "@/lib/finance/mortgageCheck";
import type { Transaction } from "@/lib/finance/types";
import { t } from "@/lib/i18n";
import { useFinance } from "./FinanceProvider";

// Under a mortgage payment (the month list, Quick Add): what part of it is
// interest and what is repayment, on the parts in Real estate — or, when the
// month's booked mortgage is clearly not what the parts say, a warning
// (Bart, 25 Nov: only €1,118.86 of €2,047.22 was read from a statement).

export default function MortgageHint({ amount, date, editing }: { amount: number; date: string; editing?: Transaction }) {
  const { data } = useFinance();
  const d = new Date(date);
  const mm = mortgageMonth(data, new Date(d.getFullYear(), d.getMonth(), 1));
  if (!mm || !(amount > 0)) return null;
  // The month's booked total with this amount in it (a new one comes on top).
  const inList = !!editing && mm.payments.some((p) => p.id === editing.id);
  const booked = mm.booked - (inList ? num(editing!.amount) : 0) + amount;
  const gap = Math.abs(mm.expected - booked);
  if (gap > 25 && gap > mm.expected * 0.05)
    return (
      <span className="pf-mortgage-hint" data-off>
        {t("Your mortgage parts say {amount} this month — is a debit missing?", { amount: money(mm.expected, data.profile.currency_code) })}
      </span>
    );
  const share = Math.min(amount / mm.expected, 1);
  return (
    <span className="pf-mortgage-hint">
      {t("≈ {interest} interest · ≈ {repayment} repayment", { interest: money(mm.interest * share, data.profile.currency_code), repayment: money(mm.repayment * share, data.profile.currency_code) })}
    </span>
  );
}
