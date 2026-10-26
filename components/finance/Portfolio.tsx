"use client";

import InfoTip from "./InfoTip";

import { intlLocale, t } from "@/lib/i18n";
import { Bitcoin, ChartLine, Gem, ZoomIn, ZoomOut } from "lucide-react";
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

export const timeLabel = (ms: number, range: Range) =>
  new Date(ms).toLocaleString(
    intlLocale(),
    range === "1d" ? { hour: "2-digit", minute: "2-digit" } : range === "5d" ? { weekday: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: range === "5y" ? "numeric" : undefined },
  );

/** A small preference kept in this browser (falls back to `initial`). */
export function usePref<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {}
  }, [key]);
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  };
  return [value, set] as const;
}

/** Click-and-drag across a chart to select a stretch of time — it shows the
 *  change between the two ends (like the Stocks app) and stays selected
 *  after letting go; "Zoom in" magnifies it, a click clears it. Double-click
 *  or "Zoom out" goes back. The visible window glides between ranges. */
export function useDragZoom(t0: number, t1: number, resetKey: string) {
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<{ a: number; b: number; x0: number; moved: boolean } | null>(null);
  // The stretch selected by the last drag, kept until a click or a zoom.
  const [picked, setPicked] = useState<[number, number] | null>(null);
  useEffect(() => {
    setZoom(null);
    setDrag(null);
    setPicked(null);
  }, [resetKey]);
  const target = zoom ?? [t0, t1];
  // Glide only while zooming in or out; new data or a new period shows
  // straight away (else the first load would sweep in from nothing).
  const [gliding, setGliding] = useState(false);
  const tweened = useTween(target, 520);
  useEffect(() => {
    if (!gliding) return;
    const id = setTimeout(() => setGliding(false), 560);
    return () => clearTimeout(id);
  }, [gliding, zoom]);
  const [v0, v1] = gliding ? tweened : target;
  const zoomTo = (z: [number, number] | null) => {
    setGliding(true);
    setZoom(z);
    setPicked(null);
  };
  const at = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    return v0 + Math.min(Math.max((clientX - r.left) / Math.max(r.width, 1), 0), 1) * (v1 - v0);
  };
  const handlers = {
    onPointerDown: (e: React.PointerEvent<Element>) => {
      if (e.button !== 0) return;
      try {
        // Keep receiving moves when the drag leaves the chart.
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      const t = at(e.clientX, e.currentTarget);
      setDrag({ a: t, b: t, x0: e.clientX, moved: false });
    },
    onPointerMove: (e: React.PointerEvent<Element>) => {
      if (drag) setDrag({ ...drag, b: at(e.clientX, e.currentTarget), moved: drag.moved || Math.abs(e.clientX - drag.x0) > 6 });
    },
    onPointerUp: () => {
      if (drag?.moved) {
        const lo = Math.min(drag.a, drag.b), hi = Math.max(drag.a, drag.b);
        setPicked(hi - lo > (t1 - t0) / 400 ? [lo, hi] : null);
      } else if (drag) setPicked(null);
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
    onDoubleClick: () => zoom && zoomTo(null),
  };
  const selecting = drag?.moved ? ([Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)] as const) : picked;
  return { view: [v0, v1] as const, target, gliding, zoomed: zoom != null, selecting, picked: !drag && picked != null, handlers, at, reset: () => zoomTo(null), zoomIn: () => picked && zoomTo(picked) };
}

/** The point nearest a moment. */
const nearest = <P extends { t: number }>(pts: P[], t: number) => {
  let best = 0;
  for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].t - t) < Math.abs(pts[best].t - t)) best = i;
  return best;
};

/** Growth between two points: with a nominal line, money put in between
 *  isn't profit. */
const growth = (a: { value: number; cost?: number }, b: { value: number; cost?: number }) => {
  const withCost = a.cost != null && b.cost != null;
  const change = withCost ? b.value - b.cost! - (a.value - a.cost!) : b.value - a.value;
  const base = withCost ? b.cost! : a.value;
  return { change, share: base ? change / base : null };
};

export function ZoomOutChip({ onClick, zoomIn }: { onClick: () => void; zoomIn?: boolean }) {
  const Icon = zoomIn ? ZoomIn : ZoomOut;
  return (
    <button type="button" className="pf-zoom-out" onClick={onClick}>
      <Icon size={12} strokeWidth={2.4} /> {zoomIn ? t("Zoom in") : t("Zoom out")}
    </button>
  );
}

/** Line + area of a value over time, with an optional dashed nominal line
 *  and a scrub readout. Green when the range ends at or above its start.
 *  Drag across it to compare two moments and zoom in. */
export function PriceChart({
  series,
  currency,
  range,
  height = 150,
  idle,
  showCost = true,
}: {
  series: { t: number; value: number; cost?: number }[];
  currency: string;
  range: Range;
  height?: number;
  /** Draw what was put in (nominal) as a dashed line — under it means
   *  under water. */
  showCost?: boolean;
  /** Readout when not scrubbing. */
  idle?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, P = 6;
  const full0 = series[0]?.t ?? 0, full1 = series[series.length - 1]?.t ?? 1;
  const z = useDragZoom(full0, full1, range);
  // The window being shown (gliding) and the one it's heading for: the
  // y-range and colour follow the destination so they don't flicker.
  const [v0, v1] = z.view;
  const win = series.filter((p) => p.t >= z.target[0] && p.t <= z.target[1]);
  const withCost = showCost;
  // Zoomed in, the y-axis fits the price alone — magnifying is the point.
  const vals = (win.length ? win : series).flatMap((p) => (withCost && !z.zoomed && p.cost != null ? [p.value, p.cost] : [p.value]));
  const yTarget = vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 1];
  const yTweened = useTween(yTarget, 520);
  const [lo, hi] = z.gliding ? yTweened : yTarget;
  if (series.length < 2) return <div className="pf-pf-chart-empty" style={{ height }}>{t("No price history yet")}</div>;
  const span = Math.max(hi - lo, Math.abs(hi) * 0.002, 0.01);
  const x = (t: number) => P + ((t - v0) / Math.max(v1 - v0, 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo + span * 0.08) / (span * 1.16)) * (H - 2 * P);
  // Draw what's in view plus one point either side, so the line runs off
  // the edges instead of stopping short.
  const i0 = Math.max(0, series.findIndex((p) => p.t >= v0) - 1);
  const i1n = series.findIndex((p) => p.t > v1);
  const shown = series.slice(i0, i1n < 0 ? series.length : i1n + 1);
  const line = shown.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(shown[shown.length - 1].t).toFixed(1)},${H} L${x(shown[0].t).toFixed(1)},${H} Z`;
  const costLine = withCost && shown.some((p) => p.cost != null)
    ? shown.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.cost ?? p.value).toFixed(1)}`).join(" ")
    : null;
  const ends = win.length >= 2 ? win : series;
  const { change, share } = growth(ends[0], ends[ends.length - 1]);
  const up = change >= 0;
  const color = up ? "#30d158" : "#ff453a";
  const id = `pf-pf-fill-${up ? "up" : "down"}`;
  const h = hover != null && !z.selecting ? series[hover] : null;
  // While dragging: the two ends and what changed between them.
  const sel = z.selecting ? { a: series[nearest(series, z.selecting[0])], b: series[nearest(series, z.selecting[1])] } : null;
  const selGrowth = sel ? growth(sel.a, sel.b) : null;
  const last = series[series.length - 1];

  return (
    <div className="pf-pf-chart">
      <div className="pf-pf-readout-row">
        {z.picked ? <ZoomOutChip zoomIn onClick={z.zoomIn} /> : z.zoomed && !sel ? <ZoomOutChip onClick={z.reset} /> : <span />}
        <div key={sel ? "sel" : (hover ?? (z.zoomed ? "zoom" : "idle"))} className="pf-readout pf-pf-readout">
          {sel && selGrowth ? (
            <>
              {timeLabel(sel.a.t, range)} – {timeLabel(sel.b.t, range)} · <b style={{ color: tone(selGrowth.change) }}>{money(selGrowth.change, currency, { signed: true })}</b>{" "}
              <span style={{ color: tone(selGrowth.change) }}>{pct(selGrowth.share)}</span>
            </>
          ) : h ? (
            <>
              {timeLabel(h.t, range)} · <b>{money(h.value, currency)}</b>
              {h.cost != null && h.cost > 0 && <span style={{ color: tone(h.value - h.cost) }}> {pct((h.value - h.cost) / h.cost)}</span>}
            </>
          ) : z.zoomed ? (
            <>
              {timeLabel(ends[0].t, range)} – {timeLabel(ends[ends.length - 1].t, range)} · <b style={{ color: tone(change) }}>{money(change, currency, { signed: true })}</b>{" "}
              <span style={{ color: tone(change) }}>{pct(share)}</span>
            </>
          ) : (
            idle ?? (
              <>
                {t("This period")} · <b style={{ color: tone(change) }}>{money(change, currency, { signed: true })}</b>{" "}
                <span style={{ color: tone(change) }}>{pct(share)}</span>
              </>
            )
          )}
        </div>
      </div>
      <div style={{ position: "relative", overflow: "hidden" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="pf-pf-svg"
          style={{ height }}
          {...z.handlers}
          onPointerMove={(e) => {
            z.handlers.onPointerMove(e);
            setHover(nearest(series, z.at(e.clientX, e.currentTarget)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {sel && <rect x={x(sel.a.t)} width={Math.max(x(sel.b.t) - x(sel.a.t), 0)} y={0} height={H} className="pf-zoom-band" />}
          <path d={area} fill={`url(#${id})`} className="pf-eq-area" />
          {costLine && <path d={costLine} fill="none" stroke="var(--pf-ink-3)" strokeWidth="1.4" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />}
          <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="pf-eq-path" />
          {h && <line x1={x(h.t)} x2={x(h.t)} y1={0} y2={H} stroke="var(--pf-ink-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          {sel && [sel.a, sel.b].map((p, i) => <line key={i} x1={x(p.t)} x2={x(p.t)} y1={0} y2={H} stroke="var(--pf-ink-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        </svg>
        {/* Dots as HTML, so they stay round however the line stretches. */}
        {last.t <= v1 + 1 && <span className="pf-pf-dot pf-pf-dot-live" style={{ left: `${(x(last.t) / W) * 100}%`, top: `${(y(last.value) / H) * 100}%`, background: color }} />}
        {h && <span className="pf-pf-dot" style={{ left: `${(x(h.t) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%`, background: color }} />}
        {sel && [sel.a, sel.b].map((p, i) => <span key={i} className="pf-pf-dot" style={{ left: `${(x(p.t) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%`, background: selGrowth && selGrowth.change >= 0 ? "#30d158" : "#ff453a" }} />)}
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
  const [showNominal, setShowNominal] = usePref("pf-show-nominal", true);

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
        <PriceChart series={series} currency={currency} range={range} height={140} showCost={showNominal} />
        <div className="pf-pf-legend">
          <span>
            <i style={{ background: tone(result) }} /> {t("Real")}
          </span>
          <button type="button" className="pf-pf-legend-toggle" aria-pressed={showNominal} onClick={() => setShowNominal(!showNominal)} title={showNominal ? t("Hide the nominal line") : t("Show the nominal line")}>
            <i className="pf-pf-legend-dash" /> {t("Nominal (put in)")}
          </button>
        </div>
      </div>
    </section>
  );
}

/** The holdings list's own period for its sparklines (a preference). */
export type RowRange = Range | "all";
export const ROW_RANGES: { value: RowRange; label: string }[] = [...RANGES, { value: "all", label: "Since purchase" }];

export function HoldingRow({ v, currency, rangeQuotes, range, onOpen }: { v: HoldingValue; currency: string; rangeQuotes: Quotes | null; range: RowRange; onOpen: (e: Element) => void }) {
  const h = v.holding;
  const spark = useMemo(() => {
    if (!rangeQuotes) return [];
    const all = holdingSeries(h, rangeQuotes, currency);
    // Since purchase: from the day it was bought (5 years of history at most).
    const from = range === "all" ? Date.parse(h.date_added) || 0 : range === "1d" && all.length ? all[all.length - 1].t - 86_400_000 : 0;
    const kept = all.filter((p) => p.t >= from);
    return (kept.length >= 2 ? kept : all).map((p) => p.value);
  }, [h, rangeQuotes, currency, range]);
  // The line's own story: how much it moved over the chosen period.
  const moved = spark.length >= 2 && spark[0] ? spark[spark.length - 1] / spark[0] - 1 : null;
  const label = ROW_RANGES.find((r) => r.value === range)?.label ?? "";
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
      <span className="pf-pf-spark-wrap">
        <Spark values={spark} />
        {moved != null && (
          <span className="pf-pf-spark-cap pf-rounded">
            {t(label)} · <span style={{ color: tone(moved) }}>{pct(moved)}</span>
          </span>
        )}
      </span>
      <span className="pf-pf-right">
        <b className="pf-rounded">{v.value != null ? money(v.value, currency) : v.cost != null ? money(v.cost, currency) : "—"}</b>
        {v.result != null ? (
          <span className="pf-rounded" style={{ color: tone(v.result) }}>
            {money(v.result, currency, { signed: true })} · {pct(v.resultPct)} <span className="pf-pf-total">{t("total")}</span>
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
