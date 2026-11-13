"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useShowAxes } from "@/lib/prefs";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { live, liveFixed, netWorthFigures, num, otherIncome, spendByCategory, summarize, yearForecast } from "@/lib/finance/calc";
import { cap, money, monthYear, shortMonth, monthName } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import CategoryIcon from "./CategoryIcon";
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
// what it is. Beside the chart a panel shows one period in detail: this
// month (Year) or today (Month) until another bar is clicked (MonthPanel,
// DayPanel); clicking it again, × or Esc goes back to now.

const MIN_H = 210;
const TEAL = "#40c8e0";
type Step = { key: string; label: string; long: string; from: number; to: number; kind: "total" | "change" | "forecast" | "end"; isNow?: boolean };

export default function NetWorthWaterfall({ data, now, currency, mode }: { data: FinanceData; now: Date; currency: string; mode: Mode }) {
  const showAxes = useShowAxes();
  const nw = useMemo(() => netWorthFigures(data, now), [data, now]);
  const [hover, setHover] = useState<number | null>(null);
  // The bar shown in the side panel (its step index): the one clicked, else now.
  // (Kept per view, so switching Month / Year starts at now again.)
  const [pickedIn, setPickedIn] = useState<{ mode: Mode; i: number } | null>(null);
  const picked = pickedIn?.mode === mode ? pickedIn.i : null;
  const setPicked = (f: number | null | ((p: number | null) => number | null)) => {
    const i = typeof f === "function" ? f(picked) : f;
    setPickedIn(i === null ? null : { mode, i });
  };
  const steps = mode === "year" ? yearSteps(nw, now) : daySteps(nw, data, now);
  const nowIdx = Math.max(steps.findIndex((s) => s.isNow), 1);
  const sel = picked !== null && picked < steps.length - 1 ? picked : nowIdx;
  const pick = (i: number) => {
    if (steps[i].kind === "total" || steps[i].kind === "end") return;
    setPicked((p) => (p === i || i === nowIdx ? null : i));
  };
  useEffect(() => {
    if (picked === null) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPickedIn(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [picked]);
  // The chart is as tall as the panel beside it (wide screens).
  const side = useRef<HTMLElement>(null);
  const [sideH, setSideH] = useState(0);
  useEffect(() => {
    const el = side.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSideH(window.matchMedia("(max-width: 860px)").matches ? 0 : el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.max(MIN_H, sideH - 24);

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

      <div className="pf-wf-layout" data-open>
      <div style={{ display: "grid", gridTemplateColumns: showAxes ? "auto 1fr" : "1fr", gap: 8, minWidth: 0 }}>
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
                <div
                  key={s.key}
                  className="pf-wf-slot"
                  data-lit={hover === i || sel === i}
                  data-pick={!total ? true : undefined}
                  data-dim={!total && sel !== i ? true : undefined}
                  role={!total ? "button" : undefined}
                  tabIndex={!total ? 0 : undefined}
                  aria-label={!total ? t("Details for {month}", { month: s.long }) : undefined}
                  aria-pressed={!total ? sel === i : undefined}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => pick(i)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(i))}
                >
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
              <span key={s.key} data-now={!!s.isNow} data-lit={hover === i || sel === i}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <aside className="pf-wf-side" ref={side}>
        {mode === "year" ? (
          <MonthPanel key={`m${sel}`} data={data} now={now} currency={currency} month={sel - 1} step={steps[sel]} prev={sel > 1 ? steps[sel - 1] : null} onClose={picked !== null ? () => setPicked(null) : undefined} />
        ) : (
          <DayPanel key={`d${sel}`} data={data} now={now} currency={currency} day={sel} step={steps[sel]} onClose={picked !== null ? () => setPicked(null) : undefined} />
        )}
      </aside>
      </div>
      <div style={{ fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>{mode === "year" ? t("Click a month for its details.") : t("Click a day for its details.")}</div>
    </div>
  );
}

/** One month in detail, beside the waterfall: where liquidity started and
 *  ended, what came in and went out, the change against the month before,
 *  where the money went and the biggest expense. Finished months as
 *  entered; this month as expected, with what is booked so far; months
 *  ahead from the forecast (expected income, average spending). */
function MonthPanel({ data, now, currency, month, step, prev, onClose }: { data: FinanceData; now: Date; currency: string; month: number; step: Step; prev: Step | null; onClose?: () => void }) {
  const year = now.getFullYear(), current = now.getMonth();
  const d = new Date(year, month, 1);
  const ahead = month > current, isNow = month === current;
  const booked = summarize(data.transactions, d);
  const fc = ahead || isNow ? yearForecast(data, now).find((f) => f.month === month) : undefined;
  const income = fc ? fc.income : booked.income;
  const spent = fc ? fc.spent : booked.spent;
  const change = step.to - step.from;
  const rate = income > 0 ? (income - spent) / income : null;
  const prevChange = prev ? prev.to - prev.from : null;
  const cats = ahead ? [] : spendByCategory(data, d).slice(0, 5);
  const catMax = Math.max(1, ...cats.map((c) => c.spent));
  const biggest = ahead
    ? null
    : live(data.transactions)
        .filter((x) => x.type === "expense" && new Date(x.date).getFullYear() === year && new Date(x.date).getMonth() === month)
        .sort((a, b) => num(b.amount) - num(a.amount))[0];
  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name;
  const color = (v: number) => (v >= 0 ? "var(--pf-green)" : "var(--pf-red)");

  return (
    <div className="pf-wf-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <b style={{ fontSize: "1rem" }}>{monthYear(d)}</b>
          {(ahead || isNow) && <span className="pf-wf-tag">{ahead ? t("Forecast") : t("So far")}</span>}
        </span>
        <BackToNow onClose={onClose} />
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>{ahead ? t("Expected at month end") : isNow ? t("Now") : t("At month end")}</span>
        <b className="pf-rounded" style={{ fontSize: "1.5rem", color: "#40c8e0" }}>{money(step.to, currency)}</b>
        <span className="pf-rounded" style={{ fontSize: "0.78rem", color: "var(--pf-ink-2)" }}>
          <b style={{ color: color(change) }}>{money(change, currency, { signed: true })}</b> {t("from {amount} at the start", { amount: money(step.from, currency) })}
        </span>
        {prevChange !== null && !isNow && Math.abs(change - prevChange) >= 0.5 && (
          <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>
            {change >= prevChange
              ? t("{amount} better than {month}", { amount: money(change - prevChange, currency), month: monthName(new Date(year, month - 1, 1)) })
              : t("{amount} worse than {month}", { amount: money(prevChange - change, currency), month: monthName(new Date(year, month - 1, 1)) })}
          </span>
        )}
      </div>

      <div className="pf-wf-figs">
        <div><span>{fc ? t("Expected in") : t("In")}</span><b className="pf-rounded" style={{ color: "var(--pf-green)" }}>{money(income, currency)}</b></div>
        <div><span>{fc ? t("Expected out") : t("Out")}</span><b className="pf-rounded" style={{ color: "var(--pf-red)" }}>{money(spent, currency)}</b></div>
        <div><span>{t("Savings rate")}</span><b className="pf-rounded">{rate === null ? "—" : `${Math.round(rate * 100)}%`}</b></div>
      </div>
      {isNow && (
        <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>
          {t("Booked so far: {income} in, {spent} out.", { income: money(booked.income, currency), spent: money(booked.spent, currency) })}
        </span>
      )}

      {ahead ? (
        <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)", lineHeight: 1.5 }}>{t("A forecast: your expected income minus your average spending per month.")}</span>
      ) : cats.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>{t("Where it went")}</span>
          {cats.map((c) => (
            <div key={c.category.id} className="pf-wf-cat">
              <CategoryIcon icon={c.category.icon} colorHex={c.category.color_hex} size={22} />
              <span className="pf-wf-catname">{c.category.name}</span>
              <b className="pf-rounded">{money(c.spent, currency)}</b>
              <i style={{ gridColumn: "2 / -1" }}>
                <span style={{ width: `${(c.spent / catMax) * 100}%`, background: `#${c.category.color_hex}` }} />
              </i>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>{t("No spending booked in this month.")}</span>
      )}

      {biggest && (
        <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)", lineHeight: 1.5 }}>
          {t("Biggest expense: {name} · {amount} on {day}", {
            name: biggest.note || catName(biggest.category_id) || t("Expense"),
            amount: money(num(biggest.amount), currency),
            day: new Date(biggest.date).toLocaleDateString(intlLocale(), { day: "numeric", month: "long" }),
          })}
        </span>
      )}
    </div>
  );
}

/** Back to now (only when another bar was picked). */
function BackToNow({ onClose }: { onClose?: () => void }) {
  if (!onClose) return null;
  return (
    <button type="button" className="pf-wf-close" aria-label={t("Back to now")} title={t("Back to now")} onClick={onClose}>
      <X size={14} />
    </button>
  );
}

/** One day of this month in detail: liquidity at the end of it, the change
 *  that day and what was booked on it. Days ahead run at the expected pace. */
function DayPanel({ data, now, currency, day, step, onClose }: { data: FinanceData; now: Date; currency: string; day: number; step: Step; onClose?: () => void }) {
  const nw = useMemo(() => netWorthFigures(data, now), [data, now]);
  const d = new Date(now.getFullYear(), now.getMonth(), day);
  const today = now.getDate();
  const ahead = day > today, isNow = day === today;
  const change = step.to - step.from;
  const booked = live(data.transactions)
    .filter((x) => { const td = new Date(x.date); return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === day; })
    .sort((a, b) => num(b.amount) - num(a.amount));
  const parts = ahead ? null : dayParts(nw, data, now, day);
  const rest = parts ? change - (parts.pay + parts.other - parts.fixed - parts.variable) : 0;
  const rows = parts
    ? [
        { label: t("Pay, earned by the second"), v: parts.pay },
        { label: t("Other income"), v: parts.other },
        { label: t("Fixed costs, spread over the month"), v: -parts.fixed },
        { label: t("Spent this day"), v: -parts.variable },
        { label: t("Spending dated later this month"), v: rest },
      ].filter((x, i) => i === 0 || i === 2 || Math.abs(x.v) >= 0.005)
    : [];
  const cat = (id: string | null) => data.categories.find((c) => c.id === id);
  const color = (v: number) => (v >= 0 ? "var(--pf-green)" : "var(--pf-red)");

  return (
    <div className="pf-wf-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <b style={{ fontSize: "1rem" }}>{cap(d.toLocaleDateString(intlLocale(), { weekday: "long", day: "numeric", month: "long" }))}</b>
          {(ahead || isNow) && <span className="pf-wf-tag">{ahead ? t("Forecast") : t("Today")}</span>}
        </span>
        <BackToNow onClose={onClose} />
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>{ahead ? t("Expected at the end of the day") : isNow ? t("Now") : t("At the end of the day")}</span>
        <b className="pf-rounded" style={{ fontSize: "1.5rem", color: "#40c8e0" }}>{money(step.to, currency)}</b>
        <span className="pf-rounded" style={{ fontSize: "0.78rem", color: "var(--pf-ink-2)" }}>
          <b style={{ color: color(change) }}>{money(change, currency, { signed: true })}</b> {t("from {amount} at the start", { amount: money(step.from, currency) })}
        </span>
      </div>

      {ahead ? (
        <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)", lineHeight: 1.5 }}>{t("A forecast: the rest of the month at the expected pace.")}</span>
      ) : (
        <>
          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>{isNow ? t("How today moved, live") : t("How this day moved")}</span>
            {rows.map((x) => (
              <div key={x.label} className="pf-wf-part">
                <span>{x.label}</span>
                <b className="pf-rounded" style={{ color: x.v > 0 ? "var(--pf-green)" : x.v < 0 ? "var(--pf-red)" : undefined }}>{money(x.v, currency, { signed: true })}</b>
              </div>
            ))}
          </div>
          {nw.holdingsTotal > 0 && (
            <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)", lineHeight: 1.5 }}>
              {t("Included: {amount} in investments at today's market value; price moves change it straight away.", { amount: money(nw.holdingsTotal, currency) })}
            </span>
          )}
          {booked.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>{t("Booked this day")}</span>
              {booked.slice(0, 6).map((x) => {
                const c = cat(x.category_id);
                return (
                  <div key={x.id} className="pf-wf-cat">
                    {c ? <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={22} /> : <span />}
                    <span className="pf-wf-catname">{x.note || c?.name || t("Expense")}</span>
                    <b className="pf-rounded" style={{ color: x.type === "income" ? "var(--pf-green)" : undefined }}>{money(num(x.amount) * (x.type === "income" ? 1 : -1), currency, { signed: x.type === "income" })}</b>
                  </div>
                );
              })}
              {booked.length > 6 && <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>{t("{n} more", { n: booked.length - 6 })}</span>}
            </div>
          ) : (
            <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>{t("No transactions booked this day — your pay and fixed costs still move it.")}</span>
          )}
        </>
      )}
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
    steps.push({ key: `m${m}`, label: shortMonth(d), long: `${monthYear(d)}${m === current ? ` · ${t("so far")}` : ""}`, from: level, to: level + change, kind: m > current ? "forecast" : "change", isNow: m === current });
    level += change;
  }
  // This month's remaining forecast joins the year-end total.
  const rest = (nw.forecast[0]?.change ?? 0) - nw.liveChange(now.getTime());
  const end = level + rest;
  steps.push({ key: "end", label: t("End"), long: t("Expected on 31 December {year}", { year }), from: end, to: end, kind: "end" });
  return steps;
}

/** What moved liquidity on one day of this month, on the live Balance's
 *  rules (netWorthFigures.liveChange): the pay earned by the second, other
 *  income on the moment it was booked, fixed costs spread the same way and
 *  variable spending on its day. Today runs up to now. */
function dayParts(nw: ReturnType<typeof netWorthFigures>, data: FinanceData, now: Date, day: number) {
  const year = now.getFullYear(), month = now.getMonth();
  const monthStart = new Date(year, month, 1).getTime(), span = nw.days * 86_400_000;
  const at0 = new Date(year, month, day).getTime(), at1 = Math.min(new Date(year, month, day + 1).getTime(), now.getTime());
  const f = (at: number) => Math.min(Math.max((at - monthStart) / span, 0), 1);
  const share = Math.max(f(at1) - f(at0), 0);
  const fixedNow = liveFixed(data, now);
  let variable = 0;
  for (const x of live(data.transactions)) {
    const d = new Date(x.date);
    if (x.type === "expense" && !x.is_fixed_expense && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) variable += num(x.amount);
  }
  const m = new Date(year, month, 1);
  return { pay: nw.projected * share, other: otherIncome(data, m, at1) - otherIncome(data, m, at0 - 1), fixed: fixedNow * share, variable };
}

function daySteps(nw: ReturnType<typeof netWorthFigures>, data: FinanceData, now: Date): Step[] {
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate(), days = nw.days;
  const soFar = nw.liveChange(now.getTime());
  const ahead = days - today;
  const restPerDay = ahead > 0 ? ((nw.forecast[0]?.change ?? soFar) - soFar) / ahead : 0;
  const steps: Step[] = [{ key: "start", label: "1", long: t("Start of {month}", { month: monthName(now) }), from: nw.base, to: nw.base, kind: "total" }];
  steps[0].label = t("Start");
  let level = nw.base;
  for (let day = 1; day <= days; day++) {
    const d = new Date(year, month, day);
    const p = day <= today ? dayParts(nw, data, now, day) : null;
    // Today closes on the live number exactly (spending dated later this month counts now).
    const change = day < today && p ? p.pay + p.other - p.fixed - p.variable : day === today ? nw.base + soFar - level : restPerDay;
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
