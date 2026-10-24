"use client";

import { t } from "@/lib/i18n";
import { useState } from "react";
import { money } from "@/lib/finance/format";
import { useTickerNow } from "@/lib/motion";
import { useTween } from "./charts";
import LiveAmount from "./LiveAmount";
import { EQUITY } from "./BalanceSheet";

// The Balance page's headline: equity — what is truly yours — big, with how
// it moved (since last month, since 1 January), the share of what you own
// that is yours, and a small line of its month-end values this year,
// carried on as a dotted forecast to December. The dots are the months:
// clicking one picks that month on the page.

type Point = { label: string; full: string; value: number; forecast?: boolean };

export default function EquityHero({
  points,
  sel,
  onSelect,
  totalAssets,
  label,
  currency,
  liveDelta,
  current,
}: {
  /** Equity per month, January … now (today), then forecast months. */
  points: Point[];
  sel: number;
  onSelect: (i: number) => void;
  totalAssets: number;
  label: string;
  currency: string;
  /** Today's month: how much equity has moved since the page loaded (ms →
   *  amount), so the headline ticks live like the other live amounts. */
  liveDelta?: (at: number) => number;
  /** Index of this month in `points`. */
  current?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const value = points[sel]?.value ?? 0;
  const [shown] = useTween([value], 650);
  const isLive = !!liveDelta && sel === current;
  const tick = useTickerNow(isLive);
  const tweening = Math.abs(shown - value) > 0.005;
  const liveValue = shown + (isLive ? liveDelta!(tick) : 0);
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
  const done = points.filter((p) => !p.forecast).length;
  const line = points.slice(0, done).map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(done - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const ahead = points
    .slice(done - 1)
    .map((p, k) => `${k ? "L" : "M"}${x(done - 1 + k).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
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
          {isLive ? <LiveAmount value={liveValue} currency={currency} size="1em" roll={!tweening} /> : money(shown, currency)}
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
          {done < points.length && (
            <path d={ahead} fill="none" stroke={EQUITY} strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" opacity={0.6} vectorEffect="non-scaling-stroke" className="pf-eq-forecast" />
          )}
        </svg>
        {/* Dots as HTML over the line, so they stay round however it stretches. */}
        <div className="pf-eq-dots">
          {points.map((p, i) => (
            <button
              key={p.full}
              type="button"
              aria-label={`${p.full}: ${money(p.value, currency)}`}
              data-sel={i === sel}
              data-forecast={!!p.forecast}
              style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => !p.forecast && onSelect(i)}
            />
          ))}
        </div>
        <div className="pf-eq-months">
          {points.map((p, i) => (
            <span key={p.full} data-sel={i === sel} data-forecast={!!p.forecast} style={{ left: `${(x(i) / W) * 100}%` }}>
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
