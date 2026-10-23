"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useCategoryAreas, useShowAxes } from "@/lib/prefs";
import CategoryAreas from "./CategoryAreas";
import { useState } from "react";
import { live, num, projectedNetIncome, yearForecast } from "@/lib/finance/calc";
import { money, monthYear, shortMonth, monthName } from "@/lib/finance/format";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import type { Mode } from "./LiveTiles";
import { useCategoryDetail } from "./CategoryDetail";
import Segmented from "./Segmented";

// Spending (or income) as stacked bars, following the page's Month / Year
// toggle:
//   Year  — January to December of this year, one bar each; the months
//           still to come are placeholders, outlined at their forecast.
//   Month — every day of this month. Spending: fixed costs are spread evenly
//           over the days (the Spent tile's rule), variable spending sits on
//           the day it happened; days ahead are empty. Income: the month's
//           expected net is spread evenly over the days (the Income tile's
//           rule) under the main source, today partly; days ahead dashed at
//           the same daily amount. Or — the "On payday" switch — income sits
//           on the day it arrived, the salary still to come dashed on payday.
// Each bar is built up from its groups in their own colours:
//   Spending — top-level categories (subcategories rolled in), in the user's
//              order, fixed-cost categories first at the bottom; no category
//              is a grey block on top.
//   Income   — income categories in the user's order, or, when everything is
//              in one category, the sources (Salary, Freelance, …).
// The bars grow up one after another on first paint and whenever the view
// switches. Pointing at a block — or a row of the breakdown — lights that
// group up in every bar and dims the rest; the readout above says what it
// is. Clicking a category opens its sheet.
//
// To the right, one tall bar sums up the whole period — this month so far
// (Month) or the year so far (Year) — stacked the same way, with the
// period's forecast as a dashed outline and each group's amount and share
// beside it; it doubles as the legend.

const H = 210;
const OTHER = "__other";
const SOURCE_COLORS = ["#30D158", "#64D2FF", "#FFD60A", "#BF5AF2", "#FF9F0A", "#5E5CE6", "#FF375F", "#AC8E68"];

type Kind = "expense" | "income";
type Group = { id: string; name: string; color: string; category: boolean };
type Bucket = {
  key: string;
  label: string;
  long: string;
  by: Map<string, number>;
  total: number;
  isNow: boolean;
  future: boolean;
  /** Forecast for the whole bucket, drawn dashed. */
  expected?: number;
};

export default function CategoryBars({
  data,
  now,
  currency,
  mode,
  kind = "expense",
}: {
  data: FinanceData;
  now: Date;
  currency: string;
  mode: Mode;
  kind?: Kind;
}) {
  const showAxes = useShowAxes();
  const areas = useCategoryAreas();
  const openCategory = useCategoryDetail();
  const [hover, setHover] = useState<{ month: number; id: string } | null>(null);
  const [ghost, setGhost] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  // Income per day: spread evenly (default) or as it arrives (on payday).
  const [spread, setSpread] = useState(true);

  const accent = kind === "expense" ? "var(--pf-red)" : "var(--pf-green)";
  const { groupOf, groups } = grouping(data, kind, now);
  const forecast = yearForecast(data, now);
  const forecastOf = (m: number) => forecast.find((f) => f.month === m)?.[kind === "expense" ? "spent" : "income"];
  // Income's main source (most received this year) carries the daily share.
  const mainIncome = (() => {
    const totals = new Map<string, number>();
    for (const t of live(data.transactions)) if (t.type === "income" && new Date(t.date).getFullYear() === now.getFullYear()) add(totals, groupOf(t), num(t.amount));
    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? groups[0]?.id ?? OTHER;
  })();
  const months = mode === "year" ? yearBuckets(data, now, kind, groupOf, forecastOf) : dayBuckets(data, now, kind, groupOf, mainIncome, spread);
  const max = niceMax(Math.max(1, ...months.map((m) => Math.max(m.total, m.expected ?? 0))));
  const stack = groups.filter((g) => months.some((m) => m.by.has(g.id)));

  const lit = hover?.id ?? focus;
  const shown = hover ? months[hover.month] : null;
  const shownGroup = hover ? stack.find((s) => s.id === hover.id) : null;
  const shownValue = hover && shown ? (shown.by.get(hover.id) ?? 0) : 0;

  // The period's summary bar.
  const periodBy = new Map<string, number>();
  for (const m of months) for (const [id, v] of m.by) periodBy.set(id, (periodBy.get(id) ?? 0) + v);
  const periodTotal = [...periodBy.values()].reduce((a, b) => a + b, 0);
  const monthExpected = forecastOf(now.getMonth()) ?? 0;
  const periodExpected = mode === "year" ? months.reduce((t, m) => t + Math.max(m.total, m.expected ?? 0), 0) : monthExpected;
  const periodTop = Math.max(periodTotal, periodExpected, 1);
  const open = (g: Group, el: Element) => g.category && openCategory(g.id, el);

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 10, ["--pf-cbar-accent" as string]: kind === "expense" ? "255, 69, 58" : "48, 209, 88" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
            {t(`${kind === "expense" ? "Spending" : "Income"} per ${mode === "year" ? "month" : "day"} by ${groups.some((g) => !g.category && g.id !== OTHER) ? "source" : "category"}`)}
          </span>
        </span>
        <span style={{ display: "grid", gap: 6, justifyItems: "end" }}>
        {kind === "income" && mode === "month" && (
          <Segmented
            size="sm"
            label={t("Income per day")}
            value={spread ? "spread" : "payday"}
            onChange={(v) => setSpread(v === "spread")}
            options={[{ value: "spread", label: t("Spread") }, { value: "payday", label: t("On payday") }]}
          />
        )}
        <span key={hover ? `${hover.month}-${hover.id}` : `${focus}-${ghost}`} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          {ghost !== null && months[ghost] ? (
            <>
              {months[ghost].long} · expected <b style={{ color: "var(--pf-ink)" }}>{money(months[ghost].expected ?? 0, currency)}</b>
              <span style={{ color: "var(--pf-ink-3)" }}>
                {` · ${kind === "expense" ? t("average of the finished months") : mode === "month" ? t("payday") : t("expected net income")}`}
              </span>
            </>
          ) : hover && shown && shownGroup ? (
            <>
              <span className="pf-cbar-swatch" style={{ background: shownGroup.color }} />
              {shownGroup.name} · {shown.long} ·{" "}
              <b style={{ color: "var(--pf-ink)" }}>{money(shownValue, currency)}</b>{" "}
              <span style={{ color: "var(--pf-ink-3)" }}>({shown.total ? Math.round((shownValue / shown.total) * 100) : 0}% of the {mode === "year" ? "month" : "day"})</span>
            </>
          ) : (
            <>
              {t("{period} so far", { period: monthYear(now) })} <b style={{ color: accent }}>{money(mode === "year" ? (months.find((m) => m.isNow)?.total ?? 0) : periodTotal, currency)}</b>
              <span style={{ color: "var(--pf-ink-3)" }}>
                {mode === "year" || kind === "income" ? ` · ${t("expected {amount}", { amount: money(monthExpected, currency) })}` : ` · ${t("fixed costs spread over the days")}`}
              </span>
            </>
          )}
        </span>
        </span>
      </div>

      <div className="pf-cbar-layout">
        <div style={{ display: "grid", gridTemplateColumns: showAxes ? "auto 1fr" : "1fr", gap: 8, minWidth: 0 }}>
          {/* Axis labels sit exactly on their grid lines. */}
          {showAxes && (
<div style={{ position: "relative", height: H, fontSize: "0.6rem", color: "var(--pf-ink-3)", textAlign: "right" }}>
            {[1, 0.5, 0].map((f) => (
              <span key={f} style={{ display: "block", position: f === 1 ? "relative" : "absolute", right: 0, bottom: f === 1 ? undefined : f * H, translate: f === 1 ? "0 -50%" : "0 50%", whiteSpace: "nowrap" }}>
                {money(max * f, currency, { compact: true })}
              </span>
            ))}
          </div>
)}
          <div style={{ position: "relative", minWidth: 0 }}>
            {areas ? (
              <CategoryAreas
                buckets={months}
                stack={stack}
                max={max}
                height={H}
                mode={mode}
                lit={lit}
                hoverIndex={hover?.month ?? null}
                onHover={setHover}
                onPick={(id, el) => {
                  const g = stack.find((s) => s.id === id);
                  if (g) open(g, el);
                }}
              />
            ) : (
            <div key={mode} className="pf-cbar-plot" data-mode={mode} style={{ height: H }} onMouseLeave={() => setHover(null)}>
              {[0, 0.5, 1].map((f) => (
                <span key={`g${f}`} className="pf-cbar-grid" style={{ bottom: f * H }} />
              ))}
              {months.map((m, i) => (
                <div
                  key={m.key}
                  className="pf-cbar-slot"
                  data-future={m.future}
                  onMouseEnter={() => m.expected && m.expected > m.total && (m.future || m.total === 0) && setGhost(i)}
                  onMouseLeave={() => setGhost(null)}
                >
                  {m.expected !== undefined && m.expected > m.total && (
                    <span
                      className="pf-cbar-expected"
                      data-lit={ghost === i}
                      style={{ height: `${(m.expected / max) * 100}%`, animationDelay: `${0.8 + i * 0.045}s` }}
                    />
                  )}
                  <div className="pf-cbar" style={{ height: `${(m.total / max) * 100}%`, animationDelay: `${i * (mode === "year" ? 45 : 18)}ms` }}>
                    {stack.map((s) => {
                      const v = m.by.get(s.id);
                      if (!v) return null;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="pf-cbar-seg"
                          aria-label={`${s.name}, ${m.long}: ${money(v, currency)}`}
                          data-dim={lit !== null && lit !== s.id}
                          data-lit={lit === s.id}
                          style={{ height: `${(v / m.total) * 100}%`, background: s.color }}
                          onMouseEnter={() => setHover({ month: i, id: s.id })}
                          onFocus={() => setHover({ month: i, id: s.id })}
                          onBlur={() => setHover(null)}
                          onClick={(e) => open(s, e.currentTarget)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            )}
            <div key={`l${mode}`} className="pf-cbar-labels pf-readout">
              {months.map((m, i) => (
                <span key={m.key} data-now={m.isNow} data-lit={hover?.month === i}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* The whole period in one bar, with its breakdown beside it. */}
        <div className="pf-cbar-summary">
          <div style={{ fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>
            {mode === "month" ? t("{v1} so far", { v1: monthName(now) }) : t("{v1} so far", { v1: now.getFullYear() })}
            <div className="pf-rounded" style={{ fontSize: "1.05rem", fontWeight: 700, color: accent }}>{money(periodTotal, currency)}</div>
            <div>{t("expected {amount}", { amount: money(periodExpected, currency) })}</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "stretch", minHeight: 0 }}>
            <div key={`s${mode}`} className="pf-cbar-total" style={{ height: H }}>
              {periodExpected > periodTotal && <span className="pf-cbar-expected" style={{ height: "100%", animationDelay: "0.9s" }} />}
              <div className="pf-cbar" style={{ height: `${(periodTotal / periodTop) * 100}%`, animationDelay: "0.25s" }}>
                {stack.map((s) => {
                  const v = periodBy.get(s.id);
                  if (!v) return null;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="pf-cbar-seg"
                      aria-label={`${s.name}: ${money(v, currency)}`}
                      data-dim={lit !== null && lit !== s.id}
                      data-lit={lit === s.id}
                      style={{ height: `${(v / periodTotal) * 100}%`, background: s.color }}
                      onMouseEnter={() => setFocus(s.id)}
                      onMouseLeave={() => setFocus(null)}
                      onClick={(e) => open(s, e.currentTarget)}
                    />
                  );
                })}
              </div>
            </div>
            {/* Top to bottom, in the bar's order. */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2, minWidth: 0, flex: 1 }}>
              {[...stack].reverse().map((s) => {
                const v = periodBy.get(s.id) ?? 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="pf-cbar-legend pf-cbar-row"
                    data-dim={lit !== null && lit !== s.id}
                    onMouseEnter={() => setFocus(s.id)}
                    onMouseLeave={() => setFocus(null)}
                    onClick={(e) => open(s, e.currentTarget)}
                  >
                    <span className="pf-cbar-swatch" style={{ background: s.color }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{s.name}</span>
                    <span className="pf-rounded" style={{ color: "var(--pf-ink)" }}>{money(v, currency)}</span>
                    <span className="pf-rounded" style={{ width: 30, textAlign: "right", color: "var(--pf-ink-3)" }}>
                      {periodTotal ? Math.round((v / periodTotal) * 100) : 0}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** How transactions are grouped into the stacks, and the groups in stack
 *  order (bottom first). */
function grouping(data: FinanceData, kind: Kind, now: Date) {
  const cats = new Map(live(data.categories).map((c) => [c.id, c]));
  const top = (id: string | null) => {
    const c = id ? cats.get(id) : undefined;
    if (!c || c.is_income_category !== (kind === "income")) return OTHER;
    return c.parent_id ?? c.id;
  };
  const year = now.getFullYear();
  const txs = live(data.transactions).filter((t) => t.type === kind && new Date(t.date).getFullYear() === year);
  const ordered = live(data.categories)
    .filter((c) => c.is_income_category === (kind === "income") && c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);
  const asGroup = (c: (typeof ordered)[number]): Group => ({ id: c.id, name: c.name, color: `#${c.color_hex}`, category: true });
  const other: Group = { id: OTHER, name: t("No category"), color: "#636366", category: false };

  if (kind === "expense") {
    // Categories with fixed costs (e.g. rent) form the base of every stack.
    const fixed = new Set(txs.filter((t) => t.is_fixed_expense).map((t) => top(t.category_id)));
    const groups = [...ordered].sort((a, b) => Number(fixed.has(b.id)) - Number(fixed.has(a.id))).map(asGroup);
    return { groupOf: (t: Transaction) => top(t.category_id), groups: [...groups, other] };
  }

  // Income: by category when several are in use, else by source (the note).
  const usedCats = new Set(txs.map((t) => top(t.category_id)).filter((id) => id !== OTHER));
  if (usedCats.size > 1) return { groupOf: (t: Transaction) => top(t.category_id), groups: [...ordered.map(asGroup), other] };
  const source = (t: Transaction) => `src:${(t.note || "Income").trim()}`;
  const totals = new Map<string, number>();
  for (const t of txs) totals.set(source(t), (totals.get(source(t)) ?? 0) + num(t.amount));
  const groups = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id], i): Group => ({ id, name: id.slice(4), color: SOURCE_COLORS[i % SOURCE_COLORS.length], category: false }));
  return { groupOf: source, groups };
}

const add = (by: Map<string, number>, id: string, v: number) => by.set(id, (by.get(id) ?? 0) + v);

/** January to December of this year; this month and later carry their forecast. */
function yearBuckets(data: FinanceData, now: Date, kind: Kind, groupOf: (t: Transaction) => string, forecastOf: (m: number) => number | undefined): Bucket[] {
  const year = now.getFullYear();
  const byMonth = Array.from({ length: 12 }, () => new Map<string, number>());
  for (const t of live(data.transactions)) {
    const d = new Date(t.date);
    if (t.type === kind && d.getFullYear() === year) add(byMonth[d.getMonth()], groupOf(t), num(t.amount));
  }
  return byMonth.map((by, m) => {
    const d = new Date(year, m, 1);
    const future = m > now.getMonth();
    return {
      key: d.toISOString(),
      label: shortMonth(d),
      long: monthYear(d),
      by: future ? new Map() : by,
      total: future ? 0 : [...by.values()].reduce((a, b) => a + b, 0),
      isNow: m === now.getMonth(),
      future,
      expected: forecastOf(m),
    };
  });
}

/** Every day of this month. Spending: variable on its day, fixed costs spread
 *  evenly over the days so far. Income: on its day, with the expected payday
 *  outlined until the money is in. */
function dayBuckets(data: FinanceData, now: Date, kind: Kind, groupOf: (t: Transaction) => string, mainIncome: string, spread: boolean): Bucket[] {
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  const days = new Date(year, month + 1, 0).getDate();
  const byDay = Array.from({ length: days + 1 }, () => new Map<string, number>());
  const fixed = new Map<string, number>();
  let received = 0;
  for (const t of live(data.transactions)) {
    const d = new Date(t.date);
    if (t.type !== kind || d.getFullYear() !== year || d.getMonth() !== month) continue;
    if (kind === "expense" && t.is_fixed_expense) add(fixed, groupOf(t), num(t.amount));
    else add(byDay[d.getDate()], groupOf(t), num(t.amount));
    received += num(t.amount);
  }
  const payday = data.profile.payday_day;
  const smear = kind === "income" && spread;
  // Spread: the month's expected net evenly — today only the part of the
  // day that has passed. On payday: what's still to come, dashed on payday.
  const perDay = smear ? projectedNetIncome(data, new Date(year, month, 1)) / days : 0;
  const stillExpected = kind === "income" && !spread && payday && payday > today ? Math.max(0, projectedNetIncome(data, new Date(year, month, 1)) - received) : 0;
  const todayShare = (now.getTime() - new Date(year, month, today).getTime()) / 86_400_000;

  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const by = smear ? new Map<string, number>() : new Map(byDay[day]);
    if (day <= today) for (const [id, v] of fixed) add(by, id, v / days);
    if (smear && day <= today) add(by, mainIncome, day < today ? perDay : perDay * Math.min(Math.max(todayShare, 0), 1));
    const d = new Date(year, month, day);
    const show = day === 1 || day === days || day === today || day === payday || (day % 5 === 0 && Math.abs(day - today) > 1 && days - day > 1);
    return {
      key: String(day),
      label: show ? String(day) : "",
      long: d.toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" }),
      by,
      total: [...by.values()].reduce((a, b) => a + b, 0),
      isNow: day === today,
      future: day > today,
      expected: smear ? (day >= today ? perDay : undefined) : day === Math.min(payday ?? 0, days) && stillExpected > 0 ? stillExpected : undefined,
    };
  });
}

/** Round the axis top up to 1, 2 or 5 × a power of ten. */
function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}
