"use client";

import Link from "next/link";
import { CalendarCheck, CircleCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Sheet from "@/components/finance/Sheet";
import CheckinCard, { useCheckin } from "@/components/finance/CheckinCard";
import { ListChecks } from "lucide-react";
import { intlLocale, t } from "@/lib/i18n";
import { useFinance } from "@/components/finance/FinanceProvider";
import { RING_COLORS, Rings, StreakFlame } from "@/components/finance/ProgressParts";
import { money, monthYear } from "@/lib/finance/format";
import { SAVINGS_SHARE, progressModel } from "@/lib/finance/progressModel";

/** Dashboard glance at progress: this month's rings (with a bar per ring),
 *  streak and level with the way to the next one, and a nudge when last
 *  month can be closed (a quiet tick once it is). Tapping goes to Progress. */
export default function ProgressStrip() {
  const { data, now } = useFinance();
  const m = useMemo(() => progressModel(data, now), [data, now]);
  const checkin = useCheckin();
  const currency = data.profile.currency_code;
  // Whole amounts for the budget bar (€ 1.236 / € 1.111).
  const whole = (v: number) => new Intl.NumberFormat(intlLocale(), { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const [sheet, setSheet] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  // The dashboard's "Up to date through" pill opens the checklist here.
  useEffect(() => {
    const show = () => { setSheet(null); setOpen(true); };
    window.addEventListener("pf-checkin", show);
    return () => window.removeEventListener("pf-checkin", show);
  }, []);
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
          ["budget", t("Budget (forecast)"), m.rings.budget],
          ["saving", t("Saving (forecast)"), m.rings.saving],
        ] as const).map(([key, label, v], i) => {
          // Saving: the share of income the forecast expects to be saved by
          // month end, on a bar running to twice the goal with the goal (20%)
          // ticked in the middle — past the tick is past the goal.
          const saving = key === "saving";
          const rate = v * SAVINGS_SHARE;
          // Budget: all budgets together — the month-end forecast against
          // the total budget (ticked), on a bar with room past it; red once
          // the forecast goes over.
          const bt = key === "budget" ? m.budgetTotal : null;
          const scale = bt ? Math.max(bt.budget * 1.25, bt.forecast, 1) : 1;
          const over = !!bt && bt.forecast > bt.budget + 0.005;
          const fill = bt ? bt.forecast / scale : Math.min(saving ? v / 2 : v, 1);
          const tick = bt ? bt.budget / scale : saving ? 0.5 : null;
          return (
            <span
              key={key}
              className={`pf-progress-bar${bt ? " pf-progress-bar-wide" : ""}`}
              title={saving ? t("{rate}% of your income saved by month end (forecast) · goal {goal}%", { rate: Math.round(rate * 100), goal: Math.round(SAVINGS_SHARE * 100) }) : bt ? t("Expected {forecast} of {budget} budget at month end", { forecast: money(bt.forecast, currency), budget: money(bt.budget, currency) }) : undefined}
              style={{ ["--c0" as string]: over ? "#ff453a" : RING_COLORS[key][0], ["--c1" as string]: over ? "#ff8a80" : RING_COLORS[key][1], ["--v" as string]: Math.min(fill, 1), animationDelay: `${i * 90}ms` }}
            >
              <span>{label}</span>
              <i>
                <b />
                {tick !== null && <s className="pf-progress-goal" style={{ left: `${tick * 100}%` }} />}
              </i>
              <em className="pf-rounded">{bt ? `${whole(bt.forecast)} / ${whole(bt.budget)}` : `${Math.round((saving ? rate : v) * 100)}%`}</em>
            </span>
          );
        })}
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
      ) : !checkin.done ? (
        <button type="button" className="pf-close-mini pf-checkin-mini" onClick={(e) => { setSheet(e.currentTarget); setOpen(true); }}>
          <ListChecks size={16} />
          <span>{t("Bring your books up to date")}</span>
          <em>→</em>
        </button>
      ) : (
        <span className="pf-close-done">
          <CircleCheck size={15} />
          {t("Books up to date")} · {t("{month} closed", { month: monthYear(new Date(now.getFullYear(), now.getMonth() - 1, 1)) })}
        </span>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} origin={sheet} label={t("Bring your books up to date")}>
        <CheckinCard key={String(open)} onDone={() => setOpen(false)} />
      </Sheet>
    </section>
  );
}
