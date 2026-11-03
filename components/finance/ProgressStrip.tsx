"use client";

import Link from "next/link";
import { CalendarCheck, CircleCheck } from "lucide-react";
import { useMemo } from "react";
import { t } from "@/lib/i18n";
import { useFinance } from "@/components/finance/FinanceProvider";
import { RING_COLORS, Rings, StreakFlame } from "@/components/finance/ProgressParts";
import { monthYear } from "@/lib/finance/format";
import { progressModel } from "@/lib/finance/progressModel";

/** Dashboard glance at progress: this month's rings (with a bar per ring),
 *  streak and level with the way to the next one, and a nudge when last
 *  month can be closed (a quiet tick once it is). Tapping goes to Progress. */
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
      <Link href="/app/progress" className="pf-progress-bars">
        {([
          ["tracking", t("Tracking"), m.rings.tracking],
          ["budget", t("Budget"), m.rings.budget],
          ["saving", t("Saving"), m.rings.saving],
        ] as const).map(([key, label, v], i) => (
          <span key={key} className="pf-progress-bar" style={{ ["--c0" as string]: RING_COLORS[key][0], ["--c1" as string]: RING_COLORS[key][1], ["--v" as string]: Math.min(v, 1), animationDelay: `${i * 90}ms` }}>
            <span>{label}</span>
            <i><b /></i>
            <em className="pf-rounded">{Math.round(v * 100)}%</em>
          </span>
        ))}
        {m.level.next && (
          <span className="pf-progress-bar pf-progress-level" style={{ ["--c0" as string]: "#6c5ce7", ["--c1" as string]: "#00c2a8", ["--v" as string]: m.level.progress, animationDelay: "270ms" }}>
            <span>{t(m.level.next)}</span>
            <i><b /></i>
            <em className="pf-rounded">{Math.round(m.level.progress * 100)}%</em>
          </span>
        )}
      </Link>
      {m.closable ? (
        <Link href="/app/close" className="pf-close-mini">
          <CalendarCheck size={16} />
          <span>{t("Close {month}", { month: monthYear(m.closable) })}</span>
          <em>→</em>
        </Link>
      ) : (
        <span className="pf-close-done">
          <CircleCheck size={15} />
          {t("{month} closed", { month: monthYear(new Date(now.getFullYear(), now.getMonth() - 1, 1)) })}
        </span>
      )}
    </section>
  );
}
