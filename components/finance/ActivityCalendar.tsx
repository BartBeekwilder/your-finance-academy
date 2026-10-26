"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { budgetIn } from "@/lib/finance/budgetPlan";
import { live, projectedNetIncome, summarize } from "@/lib/finance/calc";
import { dayRings, longestStreak, ringStreak, type DayRing } from "@/lib/finance/dayRings";
import { monthYear } from "@/lib/finance/format";
import { SAVINGS_SHARE } from "@/lib/finance/progressModel";
import { streak } from "@/lib/finance/progress";
import type { FinanceData } from "@/lib/finance/types";
import { LAP_COLORS, RING_COLORS } from "./ProgressParts";

// The activity calendar: every day of a month with its three small rings
// (bookkeeping, budget on track, saved so far) — like a watch's activity
// history — and the streaks above it. Older months via the arrows; a day
// opens its details.

export default function ActivityCalendar({ data, now }: { data: FinanceData; now: Date }) {
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const active = useMemo(() => live(data.activityDays ?? []).map((a) => a.day.slice(0, 10)), [data.activityDays]);

  const { rings, avg } = useMemo(() => {
    // The month's allowance for variable spending: its budgets, or — without
    // any — the average of the three months before.
    const vars = live(data.categories).filter((c) => !c.is_income_category && !c.parent_id && !c.is_fixed_expense);
    const budgeted = vars.reduce((s, c) => s + (budgetIn(live(data.budgets), c.id, month) ?? 0), 0);
    const before = [1, 2, 3].map((k) => summarize(data.transactions, new Date(month.getFullYear(), month.getMonth() - k, 1)).variable);
    const average = before.reduce((a, b) => a + b, 0) / 3;
    return {
      avg: budgeted <= 0,
      rings: dayRings({
        transactions: data.transactions,
        activeDays: active,
        month,
        today: now,
        allowance: budgeted > 0 ? budgeted : average,
        savingsTarget: projectedNetIncome(data, month) * SAVINGS_SHARE,
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, active, month.getTime(), now]);

  const lead = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7; // Monday first
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(intlLocale(), { weekday: "narrow" }));
  const sel = picked != null ? rings[picked - 1] : null;
  const perfect = rings.filter((r) => r.perfect).length;

  const chips = [
    { label: t("Bookkeeping streak"), value: streak(active, now), unit: t("days"), color: RING_COLORS.tracking, icon: true },
    { label: t("Longest streak"), value: longestStreak(active), unit: t("days"), color: RING_COLORS.tracking },
    { label: t("Within budget in a row"), value: offset === 0 ? ringStreak(rings, "budget") : null, unit: t("days"), color: RING_COLORS.budget },
    // All three rings closed: their three colours.
    { label: t("Perfect days"), value: perfect, unit: t("this month"), color: [RING_COLORS.tracking[0], RING_COLORS.budget[0], RING_COLORS.saving[1]] as readonly string[] },
  ];

  return (
    <section className="pf-card pf-cal">
      <div className="pf-cal-streaks">
        {chips.map((c) => (
          <div key={c.label} className="pf-cal-chip">
            <span>{c.label}</span>
            <b className="pf-rounded">
              {c.icon && <Flame size={16} color={c.color[0]} />}
              <em className="pf-cal-num" style={{ backgroundImage: `linear-gradient(135deg, ${c.color.join(", ")})` }}>{c.value ?? "—"}</em> <small>{c.unit}</small>
            </b>
          </div>
        ))}
      </div>

      <div className="pf-cal-head">
        <button type="button" className="pf-icon-button" aria-label={t("Previous month")} onClick={() => { setOffset((o) => o - 1); setPicked(null); }}>
          <ChevronLeft size={16} />
        </button>
        <b>{monthYear(month)}</b>
        <button type="button" className="pf-icon-button" aria-label={t("Next month")} disabled={offset >= 0} onClick={() => { setOffset((o) => Math.min(o + 1, 0)); setPicked(null); }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div key={month.getTime()} className="pf-cal-grid">
        {weekdays.map((w, i) => (
          <span key={`w${i}`} className="pf-cal-wd">{w}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {rings.map((r) => (
          <button
            key={r.day}
            type="button"
            className="pf-cal-day"
            data-future={r.future || undefined}
            data-today={(offset === 0 && r.day === now.getDate()) || undefined}
            data-picked={picked === r.day || undefined}
            data-perfect={r.perfect || undefined}
            disabled={r.future}
            onClick={() => setPicked(picked === r.day ? null : r.day)}
            style={{ ["--i" as string]: r.day }}
          >
            <MiniRings r={r} />
            <span>{r.day}</span>
          </button>
        ))}
      </div>

      {sel && (
        <div key={sel.day} className="pf-cal-detail">
          <b>{sel.date.toLocaleDateString(intlLocale(), { weekday: "long", day: "numeric" })} {monthYear(month)}</b>
          <Row color={RING_COLORS.tracking[0]} label={t("Bookkeeping")} value={sel.tracking ? t("Updated") : t("Not updated")} />
          <Row color={RING_COLORS.budget[0]} label={avg ? t("Spending vs your average") : t("Budget")} value={sel.budget == null ? "—" : sel.budget >= 1 ? t("On track") : t("{pct} over so far", { pct: `${Math.round((1 / sel.budget - 1) * 100)}%` })} />
          <Row color={RING_COLORS.saving[0]} label={t("Saving")} value={sel.saving == null ? "—" : `${Math.round(sel.saving * 100)}%`} />
        </div>
      )}
      <p className="pf-cal-note">
        {avg
          ? t("Blue: you updated your books. Green: spending so far within your average so far (no budgets yet). Purple: saved so far against 20% of income.")
          : t("Blue: you updated your books. Green: spending so far within your budgets so far. Purple: saved so far against 20% of income.")}
      </p>
    </section>
  );
}

/** Three small concentric rings for one day — the same gradients as the
 *  month's big rings, and their lighter tint for a second lap. */
function MiniRings({ r }: { r: DayRing }) {
  const id = useId().replace(/:/g, "");
  const rows = [
    { key: "tracking" as const, v: r.tracking, R: 15 },
    { key: "budget" as const, v: r.budget, R: 10.5 },
    { key: "saving" as const, v: r.saving, R: 6 },
  ];
  return (
    <svg viewBox="0 0 36 36" className="pf-cal-rings" aria-hidden>
      <defs>
        {rows.map((x) => (
          <linearGradient key={x.key} id={`${id}${x.key}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={RING_COLORS[x.key][0]} />
            <stop offset="100%" stopColor={RING_COLORS[x.key][1]} />
          </linearGradient>
        ))}
      </defs>
      {rows.map((x) => {
        const len = 2 * Math.PI * x.R;
        const v = x.v ?? 0;
        return (
          <g key={x.key} transform="rotate(-90 18 18)">
            <circle cx="18" cy="18" r={x.R} fill="none" stroke={RING_COLORS[x.key][0]} strokeOpacity={x.v == null ? 0.06 : 0.16} strokeWidth="3.6" />
            {v > 0 && <circle className="pf-cal-arc" cx="18" cy="18" r={x.R} fill="none" stroke={`url(#${id}${x.key})`} strokeWidth="3.6" strokeLinecap="round" strokeDasharray={`${len * Math.min(v, 1)} ${len}`} />}
            {v > 1 && <circle className="pf-cal-arc" cx="18" cy="18" r={x.R} fill="none" stroke={LAP_COLORS[x.key]} strokeWidth="3.6" strokeLinecap="round" strokeDasharray={`${len * Math.min(v - 1, 0.999)} ${len}`} />}
          </g>
        );
      })}
    </svg>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="pf-cal-row">
      <i style={{ background: color }} />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
