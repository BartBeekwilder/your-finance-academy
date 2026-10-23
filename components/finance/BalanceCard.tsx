"use client";

import { t } from "@/lib/i18n";
import Link from "next/link";
import { balanceSheet } from "@/lib/finance/calc";
import type { FinanceData } from "@/lib/finance/types";
import { setBalanceFull, useBalanceFull } from "@/lib/prefs";
import { BalanceBars, BalanceTable } from "./BalanceSheet";
import Segmented from "./Segmented";

// The dashboard's balance sheet, today's stand: Compact (the two bars and
// equity) or Full (the two-column table, read-only). The choice is kept per
// browser; the Balance page has the editable version.

export default function BalanceCard({ data, now }: { data: FinanceData; now: Date }) {
  const full = useBalanceFull();
  const currency = data.profile.currency_code;
  const sheet = balanceSheet(data, now, now);
  const prev = balanceSheet(data, now, new Date(now.getFullYear(), now.getMonth() - 1, 1));

  return (
    <section className="pf-card" style={{ padding: 18, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Link href="/app/balance" style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.05em", color: "var(--pf-ink-2)" }}>
          {t("Balance sheet").toUpperCase()} ›
        </Link>
        <Segmented
          size="sm"
          label={t("Balance sheet view")}
          value={full ? "full" : "compact"}
          onChange={(v) => setBalanceFull(v === "full")}
          options={[
            { value: "compact", label: t("Compact") },
            { value: "full", label: t("Full") },
          ]}
        />
      </div>
      <div key={full ? "full" : "compact"} className="pf-readout">
        {full ? <BalanceTable sheet={sheet} prev={prev} currency={currency} /> : <BalanceBars sheet={sheet} prev={prev} currency={currency} label={t("today")} />}
      </div>
    </section>
  );
}
