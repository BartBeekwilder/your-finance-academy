"use client";

import InfoTip from "./InfoTip";

import { intlLocale, t } from "@/lib/i18n";
import { Bitcoin, ChartLine, Gem } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/finance/format";
import { holdingSeries, type HoldingValue, type Quotes } from "@/lib/finance/quotes";
import type { AssetType } from "@/lib/finance/types";
import { useTween } from "./charts";
import LiveAmount from "./LiveAmount";
import Segmented from "./Segmented";

// Investments, live: market prices from /api/quotes (polled while the page is
// visible), the portfolio's real value against what was put in (nominal),
// a chart per range, and per holding a sparkline, its result in green or
// red, and a detail sheet.

export const TYPE: Record<AssetType, { label: string; Icon: typeof ChartLine; color: string }> = {
  crypto: { label: "Crypto", Icon: Bitcoin, color: "#F7931A" },
  stock: { label: "Stock", Icon: ChartLine, color: "#0A84FF" },
  metal: { label: "Metal", Icon: Gem, color: "#D4AF37" },
};

export type Range = "1d" | "5d" | "1mo" | "1y" | "5y";
export const RANGES: { value: Range; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "1W" },
  { value: "1mo", label: "1M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

/** A holding's icon: the company logo for a stock (by ticker, from
 *  Financial Modeling Prep's public logo images — only the ticker is sent),
 *  else — or when the logo can't load — the asset type's symbol. */
export function AssetIcon({ symbol, type, size = 32 }: { symbol: string; type: AssetType; size?: number }) {
  const [failed, setFailed] = useState(false);
  const ty = TYPE[type];
  const radius = Math.round(size * 0.28);
  if (type === "stock" && !failed && /^[A-Z0-9.\-]{1,10}$/.test(symbol))
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="pf-pf-icon pf-pf-logo"
        src={`https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderRadius: radius }}
        onError={() => setFailed(true)}
      />
    );
  return (
    <span className="pf-pf-icon" style={{ background: ty.color, width: size, height: size, borderRadius: radius }}>
      <ty.Icon size={Math.round(size * 0.56)} color="white" strokeWidth={2.2} />
    </span>
  );
}

const UP = "var(--pf-green)";
const DOWN = "var(--pf-red)";
export const tone = (v: number | null | undefined) => (v == null ? "var(--pf-ink-2)" : v >= 0 ? UP : DOWN);
export const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** Quotes for `symbols` over `range`, refreshed every `pollMs` while the tab
 *  is visible (0 = once). Keeps the last good answer while refreshing. */
export function useQuotes(symbols: string[], range: Range, pollMs: number) {
  const key = symbols.join(",");
  const [state, setState] = useState<{ key: string; quotes: Quotes; at: number } | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = () =>
      fetch(`/api/quotes?symbols=${encodeURIComponent(key)}&range=${range}`)
        .then((r) => r.json())
        .then((j) => alive && j.quotes && setState({ key: `${key}|${range}`, quotes: j.quotes, at: Date.now() }))
        .catch(() => {});
    load();
    const id = pollMs ? setInterval(() => document.visibilityState === "visible" && load(), pollMs) : undefined;
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [key, range, pollMs]);
  return state && state.key === `${key}|${range}` ? state : null;
}

const timeLabel = (ms: number, range: Range) =>
  new Date(ms).toLocaleString(
    intlLocale(),
    range === "1d" ? { hour: "2-digit", minute: "2-digit" } : range === "5d" ? { weekday: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: range === "5y" ? "numeric" : undefined },
  );

/** Line + area of a value over time, with an optional dashed nominal line
 *  and a scrub readout. Green when the range ends at or above its start. */
export function PriceChart({
  series,
  currency,
  range,
  height = 150,
  idle,
}: {
  series: { t: number; value: number; cost?: number }[];
  currency: string;
  range: Range;
  height?: number;
  /** Readout when not scrubbing. */
  idle?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, P = 6;
  if (series.length < 2) return <div className="pf-pf-chart-empty" style={{ height }}>{t("No price history yet")}</div>;
  // Nominal only over longer periods: within a day or a week it sits far
  // from the price and would flatten the line that matters.
  const withCost = range !== "1d" && range !== "5d";
  const vals = series.flatMap((p) => (withCost && p.cost != null ? [p.value, p.cost] : [p.value]));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.002, 0.01);
  const t0 = series[0].t, t1 = series[series.length - 1].t;
  const x = (t: number) => P + ((t - t0) / Math.max(t1 - t0, 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo + span * 0.08) / (span * 1.16)) * (H - 2 * P);
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(1)},${H} L${x(t0).toFixed(1)},${H} Z`;
  const costLine = withCost && series.some((p) => p.cost != null)
    ? series.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.cost ?? p.value).toFixed(1)}`).join(" ")
    : null;
  // With a nominal line, the period's change is growth only — money put in
  // during the period isn't profit.
  const first = series[0], last = series[series.length - 1];
  const change = first.cost != null && last.cost != null ? last.value - last.cost - (first.value - first.cost) : last.value - first.value;
  const base = first.cost != null && last.cost != null ? last.cost : first.value;
  const up = change >= 0;
  const color = up ? "#30d158" : "#ff453a";
  const id = `pf-pf-fill-${up ? "up" : "down"}`;
  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const tt = t0 + ((clientX - r.left) / r.width) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < series.length; i++) if (Math.abs(series[i].t - tt) < Math.abs(series[best].t - tt)) best = i;
    setHover(best);
  };
  const h = hover != null ? series[hover] : null;

  return (
    <div className="pf-pf-chart">
      <div key={hover ?? "idle"} className="pf-readout pf-pf-readout">
        {h ? (
          <>
            {timeLabel(h.t, range)} · <b>{money(h.value, currency)}</b>
            {h.cost != null && h.cost > 0 && <span style={{ color: tone(h.value - h.cost) }}> {pct((h.value - h.cost) / h.cost)}</span>}
          </>
        ) : (
          idle ?? (
            <>
              {t("This period")} · <b style={{ color: tone(change) }}>{money(change, currency, { signed: true })}</b>{" "}
              <span style={{ color: tone(change) }}>{pct(base ? change / base : null)}</span>
            </>
          )
        )}
      </div>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="pf-pf-svg"
          style={{ height }}
          onMouseMove={(e) => pick(e.clientX, e.currentTarget)}
          onTouchMove={(e) => pick(e.touches[0].clientX, e.currentTarget)}
          onMouseLeave={() => setHover(null)}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${id})`} className="pf-eq-area" />
          {costLine && <path d={costLine} fill="none" stroke="var(--pf-ink-3)" strokeWidth="1.4" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />}
          <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="pf-eq-path" />
          {h && <line x1={x(h.t)} x2={x(h.t)} y1={0} y2={H} stroke="var(--pf-ink-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* Dots as HTML, so they stay round however the line stretches. */}
        <span className="pf-pf-dot pf-pf-dot-live" style={{ left: `${(x(t1) / W) * 100}%`, top: `${(y(series[series.length - 1].value) / H) * 100}%`, background: color }} />
        {h && <span className="pf-pf-dot" style={{ left: `${(x(h.t) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%`, background: color }} />}
      </div>
    </div>
  );
}

/** A tiny line for a row. */
export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="pf-pf-spark" />;
  const W = 90, H = 30;
  const lo = Math.min(...values), hi = Math.max(...values), span = Math.max(hi - lo, Math.abs(hi) * 0.001, 0.0001);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - lo) / span) * (H - 4)).toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg className="pf-pf-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={up ? "#30d158" : "#ff453a"} strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** "Live" with a pulsing dot while a held market is open; otherwise when the
 *  prices were last updated. */
export function LiveBadge({ open, at }: { open: boolean; at: number | null }) {
  return (
    <span className="pf-pf-live" data-open={open}>
      <i />
      {open ? t("Live") : t("Market closed")}
      {at && <span>· {new Date(at).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
    </span>
  );
}

export function PortfolioHero({
  values,
  series,
  currency,
  range,
  onRange,
  open,
  at,
}: {
  values: HoldingValue[];
  series: { t: number; value: number; cost: number }[];
  currency: string;
  range: Range;
  onRange: (r: Range) => void;
  open: boolean;
  at: number | null;
}) {
  // Holdings without a quote yet count at cost, so the total never jumps
  // from a half-loaded state.
  const real = values.reduce((s, v) => s + (v.value ?? v.cost ?? 0), 0);
  const nominal = values.reduce((s, v) => s + (v.cost ?? 0), 0);
  const day = values.reduce((s, v) => s + (v.day ?? 0), 0);
  const result = real - nominal;
  const [shown] = useTween([real], 900);
  const loaded = values.some((v) => v.quote);

  const chip = (d: number, p: number | null, text: string) => (
    <span className="pf-eq-chip" data-up={d >= 0}>
      <b className="pf-rounded">{money(d, currency, { signed: true })}</b> <b className="pf-rounded">{pct(p)}</b> {text}
    </span>
  );

  return (
    <section className="pf-card pf-pf-hero">
      <div style={{ display: "grid", gap: 10, minWidth: 0, alignContent: "start" }}>
        <div className="pf-eq-label" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {t("Investments").toUpperCase()} · {t("Real value").toUpperCase()}
          <LiveBadge open={open} at={at} />
        </div>
        <div className="pf-rounded pf-eq-value" style={{ color: loaded ? tone(result) : "var(--pf-ink)" }}>
          <LiveAmount value={shown} currency={currency} size="1em" roll={Math.abs(shown - real) < 0.005} />
        </div>
        {loaded && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {chip(day, real - day ? day / (real - day) : null, t("today"))}
            {chip(result, nominal ? result / nominal : null, t("in total"))}
          </div>
        )}
        <div className="pf-pf-nomreal">
          <span>
            {t("Nominal")} <InfoTip id="nominal" /> <b className="pf-rounded">{money(nominal, currency)}</b>
          </span>
          <span>
            {t("Real")} <InfoTip id="real" /> <b className="pf-rounded" style={{ color: loaded ? tone(result) : undefined }}>{money(real, currency)}</b>
          </span>
        </div>
      </div>
      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
        <div style={{ justifySelf: "end" }}>
          <Segmented options={RANGES.map((r) => ({ value: r.value, label: t(r.label) }))} value={range} onChange={onRange} label={t("Period")} />
        </div>
        <PriceChart series={series} currency={currency} range={range} height={140} />
        <div className="pf-pf-legend">
          <span>
            <i style={{ background: tone(result) }} /> {t("Real")}
          </span>
          <span>
            <i className="pf-pf-legend-dash" /> {t("Nominal (put in)")}
          </span>
        </div>
      </div>
    </section>
  );
}

export function HoldingRow({ v, currency, rangeQuotes, onOpen }: { v: HoldingValue; currency: string; rangeQuotes: Quotes | null; onOpen: (e: Element) => void }) {
  const h = v.holding;
  const spark = useMemo(() => (rangeQuotes ? holdingSeries(h, rangeQuotes, currency).map((p) => p.value) : []), [h, rangeQuotes, currency]);
  return (
    <button type="button" className="pf-row pf-pf-row" onClick={(e) => onOpen(e.currentTarget)}>
      <AssetIcon symbol={h.symbol} type={h.asset_type} />
      <span className="pf-pf-name">
        <span>
          {h.name}
          {v.quote?.open && <i className="pf-pf-row-live" title={t("Live")} />}
        </span>
        <span className="pf-pf-sub">
          {Number(h.quantity).toLocaleString(intlLocale(), { maximumFractionDigits: 6 })} {h.symbol}
          {v.cost != null && (
            <>
              {" · "}
              {t("Nominal")} {money(v.cost, currency)}
            </>
          )}
        </span>
      </span>
      <Spark values={spark} />
      <span className="pf-pf-right">
        <b className="pf-rounded">{v.value != null ? money(v.value, currency) : v.cost != null ? money(v.cost, currency) : "—"}</b>
        {v.result != null ? (
          <span className="pf-rounded" style={{ color: tone(v.result) }}>
            {money(v.result, currency, { signed: true })} · {pct(v.resultPct)}
          </span>
        ) : (
          <span style={{ color: "var(--pf-ink-3)" }}>{v.quote ? "" : t("No price")}</span>
        )}
      </span>
    </button>
  );
}

export function HoldingDetail({
  v,
  currency,
  rangeQuotes,
  range,
  onRange,
}: {
  v: HoldingValue;
  currency: string;
  rangeQuotes: Quotes | null;
  range: Range;
  onRange: (r: Range) => void;
}) {
  const h = v.holding;
  const ty = TYPE[h.asset_type];
  const q = v.quote;
  const series = useMemo(
    () => (rangeQuotes ? holdingSeries(h, rangeQuotes, currency).map((p) => ({ ...p, cost: v.cost ?? undefined })) : []),
    [h, rangeQuotes, currency, v.cost],
  );
  const native = (n: number | null | undefined) => (n == null || !q ? "—" : money(n, q.currency === "GBp" ? "GBP" : q.currency));
  const stat = (label: string, value: React.ReactNode, color?: string) => (
    <div className="pf-pf-stat">
      <span>{label}</span>
      <b className="pf-rounded" style={{ color }}>{value}</b>
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", paddingRight: 40 }}>
        <AssetIcon symbol={h.symbol} type={h.asset_type} size={42} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 650 }}>{h.name}</h2>
          <div style={{ fontSize: "0.78rem", color: "var(--pf-ink-2)" }}>
            {h.symbol} · {t(ty.label)}
            {q?.exchange ? ` · ${q.exchange}` : ""}
          </div>
        </div>
        <span style={{ marginLeft: "auto" }}>
          <LiveBadge open={!!q?.open} at={q ? q.time : null} />
        </span>
      </div>
      <div>
        <div className="pf-rounded" style={{ fontSize: "2rem", fontWeight: 700, color: tone(v.result) }}>
          {v.value != null ? money(v.value, currency) : "—"}
        </div>
        {v.result != null && (
          <div className="pf-rounded" style={{ color: tone(v.result), fontWeight: 600 }}>
            {money(v.result, currency, { signed: true })} · {pct(v.resultPct)} {t("in total")}
          </div>
        )}
      </div>
      <div style={{ justifySelf: "end" }}>
        <Segmented options={RANGES.map((r) => ({ value: r.value, label: t(r.label) }))} value={range} onChange={onRange} label={t("Period")} />
      </div>
      <PriceChart series={series} currency={currency} range={range} height={170} />
      <div className="pf-pf-stats">
        {stat(t("Quantity"), Number(h.quantity).toLocaleString(intlLocale(), { maximumFractionDigits: 8 }))}
        {stat(t("Price"), native(q?.price))}
        {stat(t("Real"), v.value != null ? money(v.value, currency) : "—", tone(v.result))}
        {stat(t("Nominal"), v.cost != null ? money(v.cost, currency) : "—")}
        {stat(t("Result"), v.result != null ? `${money(v.result, currency, { signed: true })} · ${pct(v.resultPct)}` : "—", tone(v.result))}
        {stat(t("Today"), v.day != null ? `${money(v.day, currency, { signed: true })} · ${pct(v.dayPct)}` : "—", tone(v.day))}
        {stat(t("52-week range"), q?.low52 != null && q.high52 != null ? `${native(q.low52)} – ${native(q.high52)}` : "—")}
        {stat(t("Since"), new Date(h.date_added).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" }))}
      </div>
      <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>{t("Prices via Yahoo Finance; they can be delayed.")}</p>
    </div>
  );
}
