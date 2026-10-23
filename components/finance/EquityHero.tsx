"use client";

import { t } from "@/lib/i18n";
import { useState } from "react";
import { money } from "@/lib/finance/format";
import { useTween } from "./charts";
import { EQUITY } from "./BalanceSheet";

// The Balance page's headline: equity — what is truly yours — big, with how
// it moved (since last month, since 1 January), the share of what you own
// that is yours, and a small line of its month-end values this year. The
// dots are the months: clicking one picks that month on the page.

type Point = { label: string; full: string; value: number };

export default function EquityHero({
  points,
  sel,
  onSelect,
  totalAssets,
  label,
  currency,
}: {
  /** Equity per month, January … now (the last one is today). */
  points: Point[];
  sel: number;
  onSelect: (i: number) => void;
  totalAssets: number;
  label: string;
  currency: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const value = points[sel]?.value ?? 0;
  const [shown] = useTween([value], 650);
  const prev = sel > 0 ? points[sel - 1].value : null;
  const first = points[0]?.value ?? value;
  const share = totalAssets > 0 ? Math.max(0, Math.min(1, value / totalAssets)) : 0;
  const neg = value < 0;

  // Line: fitted to the values with some air, so the movement reads.
  const W = 320, H = 96, P = 8;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.01, 1);
  const x = (i: number) => (points.length === 1 ? W / 2 : P + (i / (points.length - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - ((v - lo + span * 0.15) / (span * 1.3)) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const tip = hover ?? null;

  const chip = (d: number, text: string) => (
    <span className="pf-eq-chip" data-up={d >= 0}>
      <b className="pf-rounded">{money(d, currency, { signed: true })}</b> {text}
    </span>
  );

  return (
    <section className="pf-card pf-eq-hero">
      <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
        <div className="pf-eq-label">{t("Equity").toUpperCase()} · {label.toUpperCase()}</div>
        <div className="pf-rounded pf-eq-value" style={{ color: neg ? "var(--pf-red)" : EQUITY }}>
          {money(shown, currency)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {prev !== null && chip(value - prev, t("since last month"))}
          {sel > 0 && chip(value - first, t("since January"))}
        </div>
        <div style={{ display: "grid", gap: 5, maxWidth: 360, marginTop: 4 }}>
          <div className="pf-eq-share">
            <span style={{ width: `${share * 100}%` }} />
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
            <b className="pf-rounded" style={{ color: "var(--pf-ink)" }}>{Math.round(share * 100)}%</b> {t("of what you own is yours · the rest is financed")}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 4, alignContent: "end", minWidth: 0 }}>
        <div key={tip ?? "idle"} className="pf-readout" style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)", textAlign: "right", minHeight: 16 }}>
          {tip !== null ? (
            <>
              {points[tip].full} · <b style={{ color: "var(--pf-ink)" }}>{money(points[tip].value, currency)}</b>
            </>
          ) : (
            t("Equity this year")
          )}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="pf-eq-line" preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="pf-eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EQUITY} stopOpacity="0.35" />
              <stop offset="100%" stopColor={EQUITY} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#pf-eq-fill)" className="pf-eq-area" />
          <path d={line} fill="none" stroke={EQUITY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="pf-eq-path" />
        </svg>
        {/* Dots as HTML over the line, so they stay round however it stretches. */}
        <div className="pf-eq-dots">
          {points.map((p, i) => (
            <button
              key={p.full}
              type="button"
              aria-label={`${p.full}: ${money(p.value, currency)}`}
              data-sel={i === sel}
              style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(i)}
            />
          ))}
        </div>
        <div className="pf-eq-months">
          {points.map((p, i) => (
            <span key={p.full} data-sel={i === sel} style={{ left: `${(x(i) / W) * 100}%` }}>
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
