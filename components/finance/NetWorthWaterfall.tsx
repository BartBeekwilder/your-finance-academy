"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useShowAxes } from "@/lib/prefs";
import { useMemo, useState } from "react";
import { live, netWorthFigures, num } from "@/lib/finance/calc";
import { money, monthYear, shortMonth, monthName } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import type { Mode } from "./LiveTiles";

// How net worth got where it is, as a waterfall following Month / Year:
//   Year  — the start of the year, then a floating bar per month: up green
//           (saved), down red (more out than in) — finished months as
//           entered, this month live so far, the months ahead dashed at
//           their forecast — ending in the expected year-end total.
//   Month — the start of the month, then a bar per day on the live rules
//           (income accrues evenly, fixed costs spread, variable spending on
//           its day); the days ahead dashed at their expected pace.
// Bars float from the level before to the level after, grow out of that
// line one after another, and the axis is fitted to the levels (not to
// zero), so the changes are big enough to read. Pointing at a bar says
// what it is.

const H = 210;
const TEAL = "#40c8e0";
type Step = { key: string; label: string; long: string; from: number; to: number; kind: "total" | "change" | "forecast" | "end"; isNow?: boolean };

export default function NetWorthWaterfall({ data, now, currency, mode }: { data: FinanceData; now: Date; currency: string; mode: Mode }) {
  const showAxes = useShowAxes();
  const nw = useMemo(() => netWorthFigures(data, now), [data, now]);
  const [hover, setHover] = useState<number | null>(null);
  const steps = mode === "year" ? yearSteps(nw, now) : daySteps(nw, data, now);

  const levels = steps.flatMap((s) => [s.from, s.to]);
  const lo0 = Math.min(...levels), hi0 = Math.max(...levels);
  const pad = Math.max((hi0 - lo0) * 0.15, 1);
  const step = niceStep(hi0 - lo0 + 2 * pad);
  const lo = Math.max(Math.floor((lo0 - pad) / step) * step, lo0 >= 0 ? 0 : -Infinity), hi = Math.ceil((hi0 + pad) / step) * step;
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100; // % from the bottom
  const shown = hover !== null ? steps[hover] : null;

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{mode === "year" ? t("How your liquidity moved per month") : t("How your liquidity moved per day")}</span>
        <span key={hover ?? "idle"} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          {shown ? (
            shown.kind === "total" || shown.kind === "end" ? (
              <>
                {shown.long} · <b style={{ color: TEAL }}>{money(shown.to, currency)}</b>
              </>
            ) : (
              <>
                {shown.long} ·{" "}
                <b style={{ color: shown.to >= shown.from ? "var(--pf-green)" : "var(--pf-red)" }}>{money(shown.to - shown.from, currency, { signed: true })}</b>{" "}
                → {money(shown.to, currency)}
                {shown.kind === "forecast" && <span style={{ color: "var(--pf-ink-3)" }}> {t("· forecast")}</span>}
              </>
            )
          ) : (
            <>
              {mode === "year" ? t("Start of the year") : t("Start of the month")} {money(steps[0].to, currency)} →{" "}
              <b style={{ color: TEAL }}>{money(steps[steps.length - 1].to, currency)}</b> {t("expected")}
            </>
          )}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showAxes ? "auto 1fr" : "1fr", gap: 8 }}>
        {showAxes && (
<div style={{ position: "relative", height: H, fontSize: "0.6rem", color: "var(--pf-ink-3)", textAlign: "right" }}>
          {[1, 0.5, 0].map((f) => (
            <span key={f} style={{ display: "block", position: f === 1 ? "relative" : "absolute", right: 0, bottom: f === 1 ? undefined : f * H, translate: f === 1 ? "0 -50%" : "0 50%", whiteSpace: "nowrap" }}>
              {money(lo + (hi - lo) * f, currency, { compact: true })}
            </span>
          ))}
        </div>
)}
        <div style={{ minWidth: 0 }}>
          <div key={mode} className="pf-wf-plot" data-mode={mode} style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {[0, 0.5, 1].map((f) => (
              <span key={`g${f}`} className="pf-cbar-grid" style={{ bottom: f * H }} />
            ))}
            {steps.map((s, i) => {
              const total = s.kind === "total" || s.kind === "end";
              const a = total ? lo : Math.min(s.from, s.to), b = total ? s.to : Math.max(s.from, s.to);
              const up = s.to >= s.from;
              return (
                <div key={s.key} className="pf-wf-slot" data-lit={hover === i} onMouseEnter={() => setHover(i)}>
                  <span
                    className="pf-wf-bar"
                    data-kind={s.kind}
                    data-up={up}
                    style={{
                      bottom: `${y(a)}%`,
                      height: `max(${y(b) - y(a)}%, 2px)`,
                      transformOrigin: total ? "bottom" : up ? "bottom" : "top",
                      animationDelay: `${i * (mode === "year" ? 45 : 16)}ms`,
                    }}
                  />
                  {/* The level the next bar continues from. */}
                  {i < steps.length - 1 && !total && <span className="pf-wf-link" style={{ bottom: `${y(s.to)}%` }} />}
                </div>
              );
            })}
          </div>
          <div key={`l${mode}`} className="pf-cbar-labels pf-readout" style={mode === "month" ? { gap: "clamp(1px, 0.35vw, 4px)" } : undefined}>
            {steps.map((s, i) => (
              <span key={s.key} data-now={!!s.isNow} data-lit={hover === i}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function yearSteps(nw: ReturnType<typeof netWorthFigures>, now: Date): Step[] {
  const year = now.getFullYear(), current = now.getMonth();
  const steps: Step[] = [{ key: "start", label: t("Start"), long: t("1 January {year}", { year }), from: nw.startOfYear, to: nw.startOfYear, kind: "total" }];
  let level = nw.startOfYear;
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1);
    const change = m < current ? nw.finished[m] : m === current ? nw.liveChange(now.getTime()) : (nw.forecast.find((f) => f.month === m)?.change ?? 0);
    steps.push({ key: `m${m}`, label: shortMonth(d), long: `${monthYear(d)}${m === current ? " · so far" : ""}`, from: level, to: level + change, kind: m > current ? "forecast" : "change", isNow: m === current });
    level += change;
  }
  // This month's remaining forecast joins the year-end total.
  const rest = (nw.forecast[0]?.change ?? 0) - nw.liveChange(now.getTime());
  const end = level + rest;
  steps.push({ key: "end", label: t("End"), long: t("Expected on 31 December {year}", { year }), from: end, to: end, kind: "end" });
  return steps;
}

function daySteps(nw: ReturnType<typeof netWorthFigures>, data: FinanceData, now: Date): Step[] {
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate(), days = nw.days;
  const variableByDay = new Array(days + 1).fill(0);
  for (const t of live(data.transactions)) {
    const d = new Date(t.date);
    if (t.type === "expense" && !t.is_fixed_expense && d.getFullYear() === year && d.getMonth() === month) variableByDay[d.getDate()] += num(t.amount);
  }
  const perDay = (nw.projected - nw.thisMonth.fixed) / days;
  const soFar = nw.liveChange(now.getTime());
  const ahead = days - today;
  const restPerDay = ahead > 0 ? ((nw.forecast[0]?.change ?? soFar) - soFar) / ahead : 0;
  const steps: Step[] = [{ key: "start", label: "1", long: t("Start of {month}", { month: monthName(now) }), from: nw.base, to: nw.base, kind: "total" }];
  steps[0].label = t("Start");
  let level = nw.base;
  for (let day = 1; day <= days; day++) {
    const d = new Date(year, month, day);
    const change = day < today ? perDay - variableByDay[day] : day === today ? nw.base + soFar - level : restPerDay;
    const show = day === 1 || day === days || day === today || (day % 5 === 0 && Math.abs(day - today) > 1 && days - day > 1);
    steps.push({
      key: `d${day}`,
      label: show ? String(day) : "",
      long: d.toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" }) + (day === today ? ` · ${t("live")}` : ""),
      from: level,
      to: level + change,
      kind: day > today ? "forecast" : "change",
      isNow: day === today,
    });
    level += change;
  }
  steps.push({ key: "end", label: t("End"), long: t("Expected at the end of {month}", { month: monthName(now) }), from: level, to: level, kind: "end" });
  return steps;
}

/** A round step giving about four gridlines over `span`. */
function niceStep(span: number) {
  const raw = Math.max(span, 1) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].find((m) => m * p >= raw) ?? 10) * p;
}
