"use client";

import { t } from "@/lib/i18n";
import { WithYAxis } from "./YAxis";
import Segmented from "./Segmented";
import { useNow } from "@/lib/motion";
import { useState } from "react";
import { summarize } from "@/lib/finance/calc";
import { money, monthYear, shortMonth } from "@/lib/finance/format";
import type { Transaction } from "@/lib/finance/types";

// "Savings": how much you kept each month — over the last 12 months, or this
// year (January–December, the months ahead dashed at their forecast and
// the running total carrying on dotted to December).
//   - One bar per month: income − spent. Green above the zero line when you
//     saved, red below it when you spent more than came in.
//   - The current month is live, using the same figures as the Balance tile
//     (income accruing, fixed costs spread), outlined because it's not over.
//   - A teal line is the running total saved, on its own scale, labelled at
//     its end so it's clear what it is.
// Bars grow out of the zero line on load; hovering lifts a bar, dims the
// others and shows that month's income, spent and saved.

const GREEN = "#30d158";
const RED = "#ff453a";
const TEAL = "#00c2a8";
const H = 180;

type Month = { month: Date; income: number; spent: number; saved: number; live: boolean; future?: boolean };

export default function SavingsChart({
  transactions,
  now,
  monthlyIncome,
  currency,
  forecast = [],
}: {
  transactions: Transaction[];
  now: Date;
  /** This month's projected net income (the live Balance tile accrues it). */
  monthlyIncome: number;
  currency: string;
  /** This month and the rest of the year (yearForecast), for "This year". */
  forecast?: { month: number; income: number; spent: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [period, setPeriod] = useState<"12m" | "year">("12m");
  const tick = useNow(1000);

  const liveIndex = period === "12m" ? 11 : now.getMonth();
  const months: Month[] = Array.from({ length: 12 }, (_, i) => {
    const month = period === "12m" ? new Date(now.getFullYear(), now.getMonth() - (11 - i), 1) : new Date(now.getFullYear(), i, 1);
    if (i > liveIndex) {
      const f = forecast.find((x) => x.month === i);
      const income = f?.income ?? 0, spent = f?.spent ?? 0;
      return { month, income, spent, saved: income - spent, live: false, future: true };
    }
    const s = summarize(transactions, month);
    if (i < liveIndex) return { month, income: s.income, spent: s.spent, saved: s.income - s.spent, live: false };
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const f = Math.min(1, Math.max(0, (tick - month.getTime()) / (days * 86_400_000)));
    const income = monthlyIncome * f;
    const spent = s.fixed * f + s.variable;
    return { month, income, spent, saved: income - spent, live: true };
  });

  const total = months.filter((m) => !m.future).reduce((s, m) => s + m.saved, 0);
  // Running total through every month (forecast included) — drawn solid up to
  // this month, dotted beyond it.
  const cum = months.map((_, i) => months.slice(0, i + 1).reduce((s, m) => s + m.saved, 0));
  const finished = months.filter((m) => !m.live && !m.future && (m.income || m.spent));
  const average = finished.length ? finished.reduce((s, m) => s + m.saved, 0) / finished.length : 0;

  // Bar scale: zero line placed so both the best and worst month fit.
  const top = Math.max(1, ...months.map((m) => m.saved));
  const bottom = Math.min(0, ...months.map((m) => m.saved));
  const zero = (top / (top - bottom)) * H; // px from the top
  const px = (v: number) => (Math.abs(v) / (top - bottom)) * H;

  // Running-total line on its own scale (0 … max of the cumulative sum).
  const cMax = Math.max(1, ...cum), cMin = Math.min(0, ...cum);
  // Top 30px kept free so the "Total" label sits inside the chart.
  const cy = (v: number) => H - ((v - cMin) / (cMax - cMin)) * (H - 38) - 8;
  const cx = (i: number) => ((i + 0.5) / 12) * 100;

  const shown = hover ?? liveIndex;
  const m = months[shown];

  return (
    <div className="pf-card" style={{ padding: 18, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <span key={period} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
            {period === "12m" ? t("Saved in the last 12 months") : t("Saved in {v1} so far", { v1: now.getFullYear() })}
          </span>
          <div className="pf-rounded" style={{ fontSize: "1.9rem", fontWeight: 700, color: total >= 0 ? GREEN : RED, lineHeight: 1.15 }}>
            {money(total, currency, { signed: true })}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>
            {t("Average {amount} per month", { amount: money(average, currency, { signed: true }) })}
            {period === "year" && ` · ${t("{amount} expected by December", { amount: money(cum[11], currency, { signed: true }) })}`}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
        <Segmented
          size="sm"
          label={t("Savings period")}
          value={period}
          onChange={(p) => { setPeriod(p); setHover(null); }}
          options={[{ value: "12m", label: t("12 months") }, { value: "year", label: t("This year") }]}
        />
        <div key={shown} className="pf-readout" style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--pf-ink-2)", display: "grid", gap: 2 }}>
          <strong style={{ color: "var(--pf-ink)", fontWeight: 600 }}>
            {monthYear(m.month)}
            {m.live ? ` · ${t("live")}` : m.future ? ` · ${t("forecast")}` : ""}
          </strong>
          <span>
            {t("Income")} <b className="pf-rounded" style={{ color: GREEN }}>{money(m.income, currency)}</b> − {t("Spent")}{" "}
            <b className="pf-rounded" style={{ color: RED }}>{money(m.spent, currency)}</b>
          </span>
          <span>
            {m.saved >= 0 ? t("Saved") : t("Overspent")}{" "}
            <b className="pf-rounded" style={{ color: m.saved >= 0 ? GREEN : RED, fontSize: "0.95rem" }}>{money(Math.abs(m.saved), currency)}</b>
          </span>
        </div>
        </div>
      </div>

      <WithYAxis height={H} currency={currency} ticks={[{ value: top, at: 1 }, { value: 0, at: -bottom / (top - bottom) }, ...(bottom < 0 ? [{ value: bottom, at: 0 }] : [])]}>
<div style={{ position: "relative", height: H }} onMouseLeave={() => setHover(null)}>
        {/* Zero line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: zero, borderTop: "1px solid var(--pf-line)" }} />

        {/* Bars */}
        <div key={period} style={{ position: "absolute", inset: 0, display: "flex", gap: "1.2%" }}>
          {months.map((mo, i) => {
            const up = mo.saved >= 0;
            const h = Math.max(mo.income || mo.spent ? 3 : 0, px(mo.saved));
            const active = hover === i;
            return (
              <div
                key={i}
                className="pf-sbar-col"
                data-dim={hover !== null && !active}
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(hover === i ? null : i)}
                role="img"
                aria-label={`${monthYear(mo.month)}: ${up ? "saved" : "overspent"} ${money(Math.abs(mo.saved), currency)}`}
              >
                <div
                  className="pf-sbar"
                  data-up={up}
                  data-live={mo.live || !!mo.future}
                  data-future={!!mo.future}
                  data-active={active}
                  style={{
                    top: up ? zero - h : zero,
                    height: h,
                    animationDelay: `${i * 45}ms`,
                    ["--bar" as string]: up ? GREEN : RED,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Running total */}
        <svg className="pf-sline" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} aria-hidden>
          <path
            key={period}
            d={cum.slice(0, liveIndex + 1).map((v, i) => `${i ? "L" : "M"}${cx(i)},${cy(v)}`).join(" ")}
            fill="none"
            stroke={TEAL}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {liveIndex < 11 && (
            <path
              className="pf-tsl-forecast"
              d={cum.slice(liveIndex).map((v, i) => `${i ? "L" : "M"}${cx(liveIndex + i)},${cy(v)}`).join(" ")}
              fill="none"
              stroke={TEAL}
              strokeWidth={2}
              strokeDasharray="2 5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div
          className="pf-sline-label pf-rounded"
          style={{ left: `${cx(liveIndex)}%`, top: cy(cum[liveIndex]) }}
        >
          {t("Total")} {money(cum[liveIndex], currency)}
        </div>
      </div>
</WithYAxis>

      {/* Month labels */}
      <div style={{ display: "flex", gap: "1.2%", marginTop: -6 }}>
        {months.map((mo, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "0.62rem",
              color: i === shown ? "var(--pf-ink)" : "var(--pf-ink-3)",
              fontWeight: mo.live ? 700 : 400,
              opacity: mo.future ? 0.5 : 1,
              transition: "color 0.2s",
            }}
          >
            {shortMonth(mo.month)}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.68rem", color: "var(--pf-ink-2)" }}>
        <Legend swatch={<span style={{ width: 10, height: 10, borderRadius: 3, background: GREEN }} />} label={t("Saved that month")} />
        <Legend swatch={<span style={{ width: 10, height: 10, borderRadius: 3, background: RED }} />} label={t("Spent more than earned")} />
        <Legend swatch={<span style={{ width: 14, height: 2.5, borderRadius: 2, background: TEAL }} />} label={t("Total saved so far")} />
        <Legend swatch={<span style={{ width: 10, height: 10, borderRadius: 3, border: `1.5px dashed ${GREEN}` }} />} label={period === "year" ? t("This month, live · ahead, forecast") : t("This month, live")} />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {swatch}
      {label}
    </span>
  );
}
