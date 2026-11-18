"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Crown, Download } from "lucide-react";
import { isRtl, t } from "@/lib/i18n";
import { monthYear } from "@/lib/finance/format";
import { live, summarize } from "@/lib/finance/calc";
import { monthReport } from "@/lib/finance/monthReport";
import { yearCloseData } from "@/lib/finance/yearCloseModel";
import { useFinance } from "@/components/finance/FinanceProvider";
import { usePremium } from "@/components/finance/usePremium";
import { MonthSheet, YearSheets } from "@/components/finance/ReportSheets";

// Premium › reports: a month (?month=YYYY-MM, or "prev") or a year
// (?year=YYYY) as A4 sheets. "Download PDF" prints just the sheets — the
// browser saves them as a sharp PDF in any script, and nothing leaves the
// device. ?embed=1 shows only the sheet (the homepage's paper preview).
// Without Premium the sheet shows blurred behind an invitation.

type Pick = { kind: "month"; month: Date } | { kind: "year"; year: number };
const A4_PX = 794; // 210 mm at 96 dpi

export default function ReportPage() {
  const { data, now, source, email } = useFinance();
  const premium = usePremium();
  const [pick, setPick] = useState<Pick | null>(null);
  const [embed, setEmbed] = useState(false);
  const [fit, setFit] = useState(1);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const m = q.get("month"), y = q.get("year");
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the address
    setEmbed(q.get("embed") === "1");
    if (y && /^\d{4}$/.test(y)) setPick({ kind: "year", year: Number(y) });
    else if (m && /^\d{4}-\d{2}$/.test(m)) setPick({ kind: "month", month: new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1) });
    else setPick({ kind: "month", month: m === "prev" ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : thisMonth });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On a narrow screen the A4 sheet shrinks to fit.
  useEffect(() => {
    const onResize = () => setFit(Math.min(1, (window.innerWidth - (embed ? 0 : 32)) / A4_PX));
    onResize();
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, [embed]);

  // Months and years that have anything booked, newest first.
  const choices = useMemo(() => {
    const keys = new Set(live(data.transactions).map((x) => x.date.slice(0, 7)));
    const months = [...keys].sort().reverse().map((k) => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1)).filter((d) => d <= now);
    const years = [...new Set(months.map((d) => d.getFullYear()))];
    return { months, years };
  }, [data.transactions, now]);

  const who = source === "demo" ? t("Demo data") : (email ?? "");
  const sheets = useMemo(() => {
    if (!pick) return null;
    if (pick.kind === "month") return <MonthSheet r={monthReport(data, pick.month, now)} data={data} who={who} />;
    const months = Array.from({ length: 12 }, (_, m) => {
      const s = summarize(data.transactions, new Date(pick.year, m, 1));
      return { income: s.income, spent: s.spent };
    });
    return <YearSheets y={yearCloseData(data, pick.year, now)} months={months} data={data} who={who} />;
  }, [pick, data, now, who]);

  // The PDF's file name: the browser takes it from the title.
  useEffect(() => {
    if (!pick) return;
    const before = document.title;
    document.title = `Personal Finance — ${pick.kind === "month" ? monthYear(pick.month) : `${t("Annual report")} ${pick.year}`}`;
    return () => {
      document.title = before;
    };
  }, [pick]);

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists after mount
  useEffect(() => setMounted(true), []);
  if (!mounted || !pick) return null;
  const locked = premium === false;
  const value = pick.kind === "month" ? `m:${pick.month.getFullYear()}-${pick.month.getMonth()}` : `y:${pick.year}`;

  return createPortal(
    <div className="pf rp-root" data-embed={embed ? "1" : "0"} dir={isRtl() ? "rtl" : "ltr"}>
      {!embed && (
        <div className="rp-bar">
          <Link href="/app" className="pf-chip rp-back">
            <ArrowLeft size={15} /> {t("Back")}
          </Link>
          <select
            className="pf-input rp-select"
            aria-label={t("Report")}
            value={value}
            onChange={(e) => {
              const [k, v] = e.target.value.split(":");
              if (k === "y") setPick({ kind: "year", year: Number(v) });
              else setPick({ kind: "month", month: new Date(Number(v.split("-")[0]), Number(v.split("-")[1]), 1) });
            }}
          >
            <optgroup label={t("Monthly report")}>
              {choices.months.map((d) => (
                <option key={d.getTime()} value={`m:${d.getFullYear()}-${d.getMonth()}`}>{monthYear(d)}</option>
              ))}
            </optgroup>
            <optgroup label={t("Annual report")}>
              {choices.years.map((y) => (
                <option key={y} value={`y:${y}`}>{y}</option>
              ))}
            </optgroup>
          </select>
          <button type="button" className="pf-button rp-download" disabled={premium !== true} onClick={() => window.print()}>
            <Download size={16} /> {t("Download PDF")}
          </button>
        </div>
      )}
      <div className="rp-stage">
        <div className="rp-sheets" data-locked={locked ? "1" : "0"} style={{ zoom: fit }}>
          {sheets}
        </div>
        {locked && !embed && (
          <div className="rp-gate">
            <Crown size={26} color="#ffd60a" />
            <b>{t("Reports are part of Premium")}</b>
            <p>{t("Your month and your year as a beautiful PDF — to keep, print or share with your partner or accountant.")}</p>
            <Link href="/app/settings#subscription" className="pf-button">{t("Try Premium free for 7 days")}</Link>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
