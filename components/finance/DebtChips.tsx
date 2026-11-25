"use client";

import { Home, Landmark } from "lucide-react";
import { liveLoans, loanAt } from "@/lib/finance/loans";
import { money } from "@/lib/finance/format";
import { summarize as summarizePart } from "@/lib/finance/mortgage";
import { homes } from "@/lib/finance/realEstate";
import type { FinanceData } from "@/lib/finance/types";
import { t } from "@/lib/i18n";

// The debts a payment can repay (Bart, 25 Nov): every mortgage part (Real
// estate) and every loan (Loans), with what's left on it — for Quick Add and
// reading a bank statement with AI.

/** `interest`: this month's interest on it (the part of a payment that's a cost). */
export type Debt = { id: string; name: string; kind: "mortgage" | "loan"; left: number; interest: number };

export function debtsOf(data: FinanceData, now: Date): Debt[] {
  const parts = homes(data).flatMap((h) =>
    h.parts.map((p) => ({ id: p.id, name: h.parts.length > 1 ? `${p.name || t("Mortgage")} · ${h.property.name || t("Home")}` : p.name || t("Mortgage"), kind: "mortgage" as const, left: summarizePart(p, now).balance, interest: summarizePart(p, now).thisMonth?.interest ?? 0 })),
  );
  const loans = liveLoans(data).map((l) => {
    const left = loanAt(l, now).balance;
    return { id: l.id, name: l.name || t("Loan"), kind: "loan" as const, left, interest: Math.round(left * (Number(l.rate) || 0) / 12) / 100 };
  });
  return [...parts, ...loans].filter((d) => d.left > 0.005);
}

/** One chip per debt; the picked one is lit. */
export default function DebtChips({ debts, value, onChange, currency }: { debts: Debt[]; value: string | null; onChange: (id: string) => void; currency: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {debts.map((d) => {
        const Icon = d.kind === "mortgage" ? Home : Landmark;
        return (
          <button key={d.id} type="button" className="pf-chip pf-acct-chip" aria-pressed={value === d.id} onClick={() => onChange(d.id)} title={t("{amount} left", { amount: money(d.left, currency) })}>
            <span className="pf-acct-icon" style={{ background: "#bf5af2" }}>
              <Icon size={12} strokeWidth={2.4} />
            </span>
            {d.name}
          </button>
        );
      })}
    </div>
  );
}
