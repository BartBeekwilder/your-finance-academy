"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useState } from "react";
import { money } from "@/lib/finance/format";

// Years side by side, for Liquidity and Balance sheet (their Years view):
// bars per year for the chart metrics with the headline metric as a line of
// dots over them, two years picked and compared metric by metric (the
// difference in € and %, green when it went the good way), and a table of
// every year with its change against the year before. Generic: any number of
// years and metrics; the caller says which way is better for each.

export type YearMetric = {
  label: string;
  color: string;
  /** Which way is good (spending, debt: down). */
  better: "up" | "down";
  /** A percentage (e.g. savings rate) rather than an amount. */
  pct?: boolean;
};
export type YearValues = {
  year: number;
  values: number[];
  /** This year: still running (values are expected / today's). */
  live?: boolean;
  /** What a year's figure is based on, e.g. "year total" or "expected". */
  note?: string;
};

export default function YearsCompare({
  years,
  metrics,
  bars,
  line,
  currency,
  empty,
}: {
  years: YearValues[];
  metrics: YearMetric[];
  /** Metric indexes drawn as bars. */
  bars: number[];
  /** The headline metric, drawn as dots over the bars and in the table. */
  line: number;
  currency: string;
  empty: string;
}) {
  const last = years.length - 1;
  const [a, setA] = useState(Math.max(last - 1, 0));
  const [b, setB] = useState(last);
  const [hover, setHover] = useState<number | null>(null);
  if (years.length === 0) return <div className="pf-card" style={{ padding: 18, color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{empty}</div>;

  const fmt = (m: YearMetric, v: number, signed = false) =>
    m.pct ? `${signed && v > 0 ? "+" : ""}${(v * 100).toLocaleString(intlLocale(), { maximumFractionDigits: 1 })}${signed ? " pp" : "%"}` : money(v, currency, { signed });
  const pctChange = (from: number, to: number) =>
    Math.abs(from) > 0.005 ? `${to >= from ? "+" : ""}${(((to - from) / Math.abs(from)) * 100).toLocaleString(intlLocale(), { maximumFractionDigits: 1 })}%` : "";
  const tone = (m: YearMetric, d: number) => (Math.abs(d) < 0.005 ? "var(--pf-ink-3)" : (d > 0) === (m.better === "up") ? "var(--pf-green)" : "var(--pf-red)");

  // Scale: bars and the line share one axis; negative values hang below zero.
  const all = years.flatMap((y) => [...bars.map((i) => y.values[i]), y.values[line]]);
  const top = Math.max(1, ...all), bottom = Math.min(0, ...all);
  const span = top - bottom;
  const H = 180;
  const yOf = (v: number) => ((top - v) / span) * H;
  const sel = hover ?? b;
  const lm = metrics[line];
  const pick = (i: number) => {
    // Clicking a year makes it the right-hand side; the old right moves left.
    if (i === b) return;
    setA(b);
    setB(i);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="pf-card pf-yc" style={{ padding: 18, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
            {[...bars, line].map((i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i className={i === line ? "pf-yc-key-dot" : "pf-yc-key"} style={{ background: metrics[i].color }} /> {metrics[i].label}
              </span>
            ))}
          </div>
          <span key={sel} className="pf-readout" style={{ fontSize: "0.78rem" }}>
            <b>{years[sel].year}</b>{" "}
            <span className="pf-rounded" style={{ color: years[sel].values[line] < 0 ? "var(--pf-red)" : lm.color, fontWeight: 600 }}>{fmt(lm, years[sel].values[line])}</span>
            {years[sel].note && <span style={{ color: "var(--pf-ink-3)" }}> · {years[sel].note}</span>}
          </span>
        </div>

        <div className="pf-yc-chart" style={{ height: H + 22 }} onMouseLeave={() => setHover(null)}>
          <svg className="pf-yc-line" viewBox={`0 0 ${years.length * 10} ${H}`} preserveAspectRatio="none" style={{ height: H }} aria-hidden>
            <line x1={0} x2={years.length * 10} y1={yOf(0)} y2={yOf(0)} stroke="var(--pf-line)" vectorEffect="non-scaling-stroke" />
            <polyline
              points={years.map((y, i) => `${i * 10 + 5},${yOf(y.values[line])}`).join(" ")}
              fill="none"
              stroke={lm.color}
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity={0.85}
            />
          </svg>
          {years.map((y, i) => (
            <button
              key={y.year}
              type="button"
              className="pf-yc-col"
              data-on={i === a || i === b}
              data-dim={hover !== null && hover !== i}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => pick(i)}
              aria-label={`${y.year}: ${fmt(lm, y.values[line])}`}
            >
              <span className="pf-yc-bars" style={{ height: H }}>
                {bars.map((k, j) => {
                  const v = y.values[k];
                  const from = yOf(Math.max(v, 0)), to = yOf(Math.min(v, 0));
                  return (
                    <span
                      key={k}
                      className="pf-yc-bar"
                      data-live={y.live}
                      style={{ top: from, height: Math.max(to - from, v ? 1 : 0), left: `${(j * 100) / bars.length}%`, width: `calc(${100 / bars.length}% - 3px)`, background: metrics[k].color, animationDelay: `${i * 40}ms` }}
                    />
                  );
                })}
                {/* Below zero (negative equity, a loss year): red. */}
                <span className="pf-yc-dot" style={{ top: yOf(y.values[line]), background: y.values[line] < 0 ? "#ff453a" : lm.color }} />
              </span>
              <span className="pf-yc-year">{y.year}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--pf-ink-3)" }}>{t("Click a year to compare it with the one selected before.")}</div>
      </section>

      <section className="pf-card" style={{ padding: 18, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 className="pf-section-title" style={{ margin: 0, flex: 1 }}>{t("Compare years")}</h2>
          <select className="pf-input pf-cmp-select" value={a} onChange={(e) => setA(Number(e.target.value))} aria-label={t("First year")}>
            {years.map((y, i) => <option key={y.year} value={i}>{y.year}</option>)}
          </select>
          <span style={{ color: "var(--pf-ink-3)", fontSize: "0.8rem" }}>{t("vs")}</span>
          <select className="pf-input pf-cmp-select" value={b} onChange={(e) => setB(Number(e.target.value))} aria-label={t("Second year")}>
            {years.map((y, i) => <option key={y.year} value={i}>{y.year}</option>)}
          </select>
        </div>
        <div key={`${a}-${b}`} className="pf-readout pf-yc-cmp">
          <span />
          <span className="pf-yc-h">{years[a].year}{years[a].live ? " *" : ""}</span>
          <span className="pf-yc-h">{years[b].year}{years[b].live ? " *" : ""}</span>
          <span className="pf-yc-h">{t("Difference")}</span>
          {metrics.map((m, i) => {
            const va = years[a].values[i], vb = years[b].values[i], d = vb - va;
            return (
              <div key={i} className="pf-yc-cmprow">
                <span><i className="pf-yc-key" style={{ background: m.color }} /> {m.label}</span>
                <span className="pf-rounded">{fmt(m, va)}</span>
                <span className="pf-rounded" style={{ fontWeight: 600 }}>{fmt(m, vb)}</span>
                <span className="pf-rounded" style={{ color: tone(m, d) }}>
                  {fmt(m, d, true)}
                  {!m.pct && <em> {pctChange(va, vb)}</em>}
                </span>
              </div>
            );
          })}
        </div>
        {(years[a].live || years[b].live) && (
          <div style={{ fontSize: "0.68rem", color: "var(--pf-ink-3)" }}>* {years[years[b].live ? b : a].note}</div>
        )}
      </section>

      <section className="pf-card pf-readout pf-yc-table" style={{ ["--cols" as string]: metrics.length }}>
        <div className="pf-row pf-yc-trow pf-yc-thead">
          <span>{t("Year")}</span>
          {metrics.map((m, i) => <span key={i}>{m.label}</span>)}
          <span>{t("vs year before")}</span>
        </div>
        {[...years].reverse().map((y) => {
          const i = years.indexOf(y);
          const prev = years[i - 1];
          const d = prev ? y.values[line] - prev.values[line] : null;
          return (
            <button key={y.year} type="button" className="pf-row pf-yc-trow" data-on={i === a || i === b} onClick={() => pick(i)}>
              <span style={{ fontWeight: 600 }}>{y.year}{y.live ? " *" : ""}</span>
              {metrics.map((m, k) => <span key={k} className="pf-rounded" style={k === line ? { color: y.values[k] < 0 ? "var(--pf-red)" : m.color, fontWeight: 600 } : y.values[k] < 0 ? { color: "var(--pf-red)" } : undefined}>{fmt(m, y.values[k])}</span>)}
              <span className="pf-rounded" style={{ color: d === null ? "var(--pf-ink-3)" : tone(lm, d) }}>{d === null ? "—" : fmt(lm, d, true)}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
