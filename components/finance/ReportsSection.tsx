"use client";

import Link from "next/link";
import { Crown, FileText } from "lucide-react";
import { t } from "@/lib/i18n";
import { monthYear } from "@/lib/finance/format";
import { useFinance } from "./FinanceProvider";
import { usePremium } from "./usePremium";

// Settings › Reports (Premium): last month and this year (or last year in
// January) as a PDF; the report page has a picker for any other month.
export default function ReportsSection() {
  const { now } = useFinance();
  const premium = usePremium();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const key = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return (
    <section className="pf-card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 650, flex: 1 }}>{t("Reports")}</h2>
        {premium === false && (
          <span className="pf-chip" style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "4px 10px", fontSize: "0.75rem" }}>
            <Crown size={13} color="#ffd60a" /> Premium
          </span>
        )}
      </div>
      <p style={{ fontSize: "0.8rem", color: "var(--pf-ink-3)" }}>{t("Your month and your year as a beautiful PDF — to keep, print or share with your partner or accountant.")}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/app/report?month=${key}`} className="pf-chip" style={{ padding: "8px 14px", display: "inline-flex", gap: 8, alignItems: "center", textDecoration: "none" }}>
          <FileText size={15} /> {t("Monthly report")} · {monthYear(last)}
        </Link>
        <Link href={`/app/report?year=${year}`} className="pf-chip" style={{ padding: "8px 14px", display: "inline-flex", gap: 8, alignItems: "center", textDecoration: "none" }}>
          <FileText size={15} /> {t("Annual report")} · {year}
        </Link>
      </div>
    </section>
  );
}
