"use client";

import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { useMemo } from "react";
import { t } from "@/lib/i18n";
import { useFinance } from "@/components/finance/FinanceProvider";
import { Rings, StreakFlame } from "@/components/finance/ProgressParts";
import { monthYear } from "@/lib/finance/format";
import { progressModel } from "@/lib/finance/progressModel";

/** Dashboard glance at progress: this month's rings, streak and level, and a
 *  nudge when last month can be closed. Tapping goes to Progress. */
export default function ProgressStrip() {
  const { data, now } = useFinance();
  const m = useMemo(() => progressModel(data, now), [data, now]);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {m.closable && (
        <Link href="/app/close" className="pf-close-banner">
          <CalendarCheck size={22} />
          <span>
            <b>{t("Close {month}", { month: monthYear(m.closable) })}</b>
            <span>{t("Five short steps: check the month, enter month-end balances, collect your points.")}</span>
          </span>
          <em>→</em>
        </Link>
      )}
      <Link href="/app/progress" className="pf-card pf-progress-strip">
        <Rings {...m.rings} size={56} />
        <span style={{ flex: 1, display: "grid", gap: 2 }}>
          <b>{t(m.level.name)}</b>
          <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-3)" }}>
            {m.level.next ? t("{points} points to {level}", { points: m.level.toNext.toLocaleString(), level: t(m.level.next) }) : t("Top level reached")}
          </span>
        </span>
        <StreakFlame days={m.streak} />
      </Link>
    </div>
  );
}
