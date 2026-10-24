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
    <section className="pf-card pf-progress-mini">
      <Link href="/app/progress" className="pf-progress-strip">
        <Rings {...m.rings} size={64} />
        <span style={{ flex: 1, display: "grid", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.05em", color: "var(--pf-ink-2)" }}>{t("Progress").toUpperCase()} ›</span>
          <b>{t(m.level.name)}</b>
          <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>
            {m.level.next ? t("{points} points to {level}", { points: m.level.toNext.toLocaleString(), level: t(m.level.next) }) : t("Top level reached")}
          </span>
        </span>
        <StreakFlame days={m.streak} />
      </Link>
      {m.closable && (
        <Link href="/app/close" className="pf-close-mini">
          <CalendarCheck size={16} />
          <span>{t("Close {month}", { month: monthYear(m.closable) })}</span>
          <em>→</em>
        </Link>
      )}
    </section>
  );
}
