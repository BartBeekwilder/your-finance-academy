"use client";

import { useState } from "react";
import { BalanceBars, BalanceTable } from "@/components/finance/BalanceSheet";
import { useFinance } from "@/components/finance/FinanceProvider";
import StepSlider from "@/components/finance/StepSlider";
import { balanceSheet } from "@/lib/finance/calc";

// Balance sheet — the finances as a company's books: what you own (your own
// posts like a home, plus accounts, investments, prepaid costs and income
// still to receive, which are calculated) against what you owe (mortgage,
// loans) and the difference, equity. A slider picks the month: the current
// month shows today's stand, earlier months their month-end stand. Your own
// posts are edited in place; editing an earlier month changes only that
// month, editing this month also sets the current value. A month with no
// stand of its own carries the latest earlier one forward.

export default function BalancePage() {
  const { data, now, setBalanceValue, renameBalanceItem, deleteBalanceItem, addBalanceItem } = useFinance();
  const currency = data.profile.currency_code;
  const [sel, setSel] = useState(now.getMonth());
  const month = new Date(now.getFullYear(), sel, 1);
  const sheet = balanceSheet(data, now, month);
  const prev = balanceSheet(data, now, new Date(now.getFullYear(), sel - 1, 1));
  const name = month.toLocaleDateString("en-GB", { month: "long" });
  const label = sheet.isCurrent ? `today` : `end of ${name}`;
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<void>) => p.then(() => setError(null)).catch((e: Error) => setError(e.message));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Balance sheet</h1>
        <span style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>
          {name} {now.getFullYear()} · {sheet.isCurrent ? "current stand" : "month-end stand"}
        </span>
      </header>

      <div className="pf-card" style={{ padding: 16 }}>
        <StepSlider
          label="Month"
          animKey="balance-months"
          value={sel}
          steps={Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), i, 1);
            const n = d.toLocaleDateString("en-GB", { month: "long" });
            return { label: n.slice(0, 3), short: n[0], full: `${n} ${now.getFullYear()}`, disabled: i > now.getMonth() };
          })}
          onChange={setSel}
        />
      </div>

      <section key={`bars${sel}`} className="pf-card" style={{ padding: 18 }}>
        <BalanceBars sheet={sheet} prev={prev} currency={currency} label={label} />
      </section>

      <section className="pf-card" style={{ padding: "18px 34px 18px 18px" }}>
        <BalanceTable
          key={sel}
          sheet={sheet}
          prev={prev}
          currency={currency}
          edit={{
            onValue: (id, v) => run(setBalanceValue(id, month, v)),
            onRename: (id, n) => run(renameBalanceItem(id, n)),
            onDelete: (id) => {
              const line = [...sheet.assets, ...sheet.liabilities].find((l) => l.id === id);
              if (confirm(`Remove “${line?.name}” from the balance sheet, including its history?`)) run(deleteBalanceItem(id));
            },
            onAdd: (side) => run(addBalanceItem({ name: "New post", side, value: 0 })),
          }}
        />
        {error && <p style={{ color: "var(--pf-red)", fontSize: "0.8rem", marginTop: 10 }}>{error}</p>}
      </section>

      <p style={{ fontSize: "0.75rem", color: "var(--pf-ink-3)", lineHeight: 1.5, maxWidth: 720 }}>
        Posts marked <em>auto</em> follow from your accounts, transactions and holdings. <b>Accounts</b>: balances on 1 January plus what each month added.{" "}
        <b>Investments</b>: holdings at cost. In the current month, <b>Prepaid</b> is the part of this month&apos;s fixed costs that covers the days ahead, and{" "}
        <b>Receivable</b> the income earned so far that hasn&apos;t come in yet. Your own posts: this month&apos;s value is the current stand; earlier months keep
        their own month-end value.
      </p>
    </div>
  );
}
