"use client";

import { t } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/finance/format";
import { holdingSeries, type Quotes } from "@/lib/finance/quotes";
import type { Holding } from "@/lib/finance/types";
import { RANGES, timeLabel, useDragZoom, ZoomOutChip, type Range } from "./Portfolio";
import Segmented from "./Segmented";
import { WithYAxis } from "./YAxis";
import { useTween } from "./charts";

// Investments › value per holding: every holding's real value over the
// chosen period, stacked (Amount) or as shares of the whole (Share), with
// the mix as a bar and a list on the right — at "now", or at the moment
// pointed at. Like the Expenses chart, and like the chart above, drag across
// it to select a stretch and zoom in. A name in the list switches that
// holding off or on; the stack reshapes smoothly (remembered per browser).

// Neutral colours — no red or green, which would read as loss or gain.
// Bitcoin keeps its orange and gold its gold.
const PALETTE = ["#0a84ff", "#bf5af2", "#64d2ff", "#5e5ce6", "#66d4cf", "#da8fff", "#409cff", "#a2845e", "#7d7aff", "#5ac8fa"];
const MAX_POINTS = 240;

export default function PortfolioMix({ holdings, quotes, currency, range, onRange }: { holdings: Holding[]; quotes: Quotes; currency: string; range: Range; onRange: (r: Range) => void }) {
  const [mode, setMode] = useState<"amount" | "share">("amount");
  const [hover, setHover] = useState<number | null>(null);
  const [lit, setLit] = useState<string | null>(null);

  // One shared timeline: every moment any price moved (24 h for 1D, thinned
  // out to a few hundred), each holding at its last price by then — nothing
  // before it was bought; at cost without a price.
  const model = useMemo(() => {
    const rows = holdings.map((h) => ({ h, s: holdingSeries(h, quotes, currency), from: Date.parse(h.date_added) || 0, cost: Number(h.cost_basis) || 0 }));
    let times = [...new Set(rows.flatMap((r) => r.s.map((p) => p.t)))].sort((a, b) => a - b);
    if (range === "1d" && times.length) times = times.filter((x) => x >= times[times.length - 1] - 86_400_000);
    if (times.length > MAX_POINTS) {
      const step = (times.length - 1) / (MAX_POINTS - 1);
      times = Array.from({ length: MAX_POINTS }, (_, i) => times[Math.round(i * step)]);
    }
    const lines = rows.map((r) => {
      let j = 0;
      const values = times.map((x) => {
        if (x < r.from) return 0;
        if (!r.s.length) return r.cost;
        while (j + 1 < r.s.length && r.s[j + 1].t <= x) j++;
        return r.s[j].value;
      });
      return { id: r.h.id, name: r.h.name, symbol: r.h.symbol, values };
    });
    // Biggest now at the bottom of the stack.
    lines.sort((a, b) => (b.values[b.values.length - 1] ?? 0) - (a.values[a.values.length - 1] ?? 0));
    let next = 0;
    const colored = lines.map((l) => ({ ...l, color: /^BTC/i.test(l.symbol) ? "#f7931a" : /^(XAU|GC=F)/i.test(l.symbol) ? "#d4af37" : PALETTE[next++ % PALETTE.length] }));
    return { times, lines: colored };
  }, [holdings, quotes, currency, range]);

  const { times, lines } = model;
  const t0 = times[0] ?? 0, t1 = times[times.length - 1] ?? 1;
  const z = useDragZoom(t0, t1, `${range}|${mode}`);

  // Holdings switched off (by id), remembered in this browser. Each line's
  // weight glides between 1 and 0, so the stack reshapes instead of jumping.
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("pf-mix-hidden") ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("pf-mix-hidden", JSON.stringify([...hidden]));
    } catch {}
  }, [hidden]);
  const toggle = (id: string) => setHidden((h) => {
    const next = new Set(h);
    if (next.has(id)) next.delete(id);
    else if (lines.some((l) => l.id !== id && !next.has(l.id))) next.add(id); // keep one on
    return next;
  });
  const targetW = lines.map((l) => (hidden.has(l.id) ? 0 : 1));
  const weights = useTween(targetW, 480);
  const wOf = (i: number) => weights[i] ?? targetW[i];
  const totals = times.map((_, k) => lines.reduce((s, l, i) => s + l.values[k] * wOf(i), 0));
  const targetTotals = times.map((_, k) => lines.reduce((s, l, i) => s + l.values[k] * targetW[i], 0));

  // The chart is as tall as the list beside it (wide screens).
  const side = useRef<HTMLDivElement>(null);
  const [sideH, setSideH] = useState(0);
  useEffect(() => {
    const el = side.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSideH(window.matchMedia("(max-width: 860px)").matches ? 0 : el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inWin = times.map((x, k) => (x >= z.target[0] && x <= z.target[1] ? k : -1)).filter((k) => k >= 0);
  const peak = Math.max(1, ...(inWin.length ? inWin : times.map((_, k) => k)).map((k) => targetTotals[k] ?? 0));
  const [max] = useTween([mode === "share" ? 1 : niceMax(peak)], 480);
  if (times.length < 2) return null;

  const [v0, v1] = z.view;
  const W = 600, H = Math.max(220, sideH - 22);
  const x = (tt: number) => ((tt - v0) / Math.max(v1 - v0, 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const value = (l: (typeof lines)[number], k: number) => {
    const v = l.values[k] * wOf(lines.indexOf(l));
    return mode === "share" ? (totals[k] ? v / totals[k] : 0) : v;
  };

  // Stacked bands, bottom up.
  const k0 = Math.max(0, times.findIndex((tt) => tt >= v0) - 1);
  const k1n = times.findIndex((tt) => tt > v1);
  const ks = Array.from({ length: (k1n < 0 ? times.length : k1n + 1) - k0 }, (_, i) => k0 + i);
  const below = ks.map(() => 0);
  const bands = lines.map((l) => {
    const lower = [...below];
    const upper = ks.map((k, i) => (below[i] += value(l, k)));
    const top = ks.map((k, i) => `${i ? "L" : "M"}${x(times[k]).toFixed(1)},${y(upper[i]).toFixed(1)}`).join(" ");
    const bottom = ks.map((k, i) => `L${x(times[k]).toFixed(1)},${y(lower[i]).toFixed(1)}`).reverse().join(" ");
    return { l, area: `${top} ${bottom} Z`, top };
  });

  const at = hover ?? times.length - 1;
  const total = totals[at];
  const label = hover != null ? timeLabel(times[hover], range) : t("Now");
  const rangeLabel = t(RANGES.find((r) => r.value === range)?.label ?? "");
  const ticks = [0, 0.5, 1].map((f) => ({ value: max * f, at: f }));
  const xLabels = Array.from({ length: 5 }, (_, i) => v0 + ((i + 0.5) / 5) * (v1 - v0));
  const sel = z.selecting;

  const chart = (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pf-pf-svg"
        style={{ height: H }}
        {...z.handlers}
        onPointerMove={(e) => {
          z.handlers.onPointerMove(e);
          const tt = z.at(e.clientX, e.currentTarget);
          let best = 0;
          for (let k = 1; k < times.length; k++) if (Math.abs(times[k] - tt) < Math.abs(times[best] - tt)) best = k;
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((tk, i) => <line key={i} x1={0} x2={W} y1={y(tk.value)} y2={y(tk.value)} className="pf-mix-grid" vectorEffect="non-scaling-stroke" />)}
        {sel && <rect x={x(sel[0])} width={Math.max(x(sel[1]) - x(sel[0]), 0)} y={0} height={H} className="pf-zoom-band" />}
        {bands.map(({ l, area, top }) => (
          <g key={l.id} className="pf-mix-band" data-dim={lit != null && lit !== l.id}>
            <path d={area} fill={l.color} opacity={0.55} />
            <path d={top} fill="none" stroke={l.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {hover != null && <line x1={x(times[hover])} x2={x(times[hover])} y1={0} y2={H} stroke="var(--pf-ink-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="pf-mix-x" aria-hidden>
        {xLabels.map((tt, i) => (
          <span key={i} style={{ left: `${(i + 0.5) * 20}%` }}>
            {timeLabel(tt, range)}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <section className="pf-card pf-mix" style={{ padding: 18, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.9rem", color: "var(--pf-ink-2)" }}>{t("Value per holding")}</span>
          <Segmented options={[{ value: "amount", label: t("Amount") }, { value: "share", label: t("Share") }]} value={mode} onChange={setMode} label={t("Show")} />
          {z.picked ? <ZoomOutChip zoomIn onClick={z.zoomIn} /> : z.zoomed && <ZoomOutChip onClick={z.reset} />}
        </div>
        <Segmented options={RANGES.map((r) => ({ value: r.value, label: t(r.label) }))} value={range} onChange={onRange} label={t("Period")} />
      </div>
      <div className="pf-mix-layout">
        {mode === "amount" ? (
          <WithYAxis height={H} currency={currency} ticks={ticks}>
            {chart}
          </WithYAxis>
        ) : (
          chart
        )}
        <div className="pf-mix-side" ref={side}>
          <div key={label} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
            {hover == null ? `${rangeLabel} · ${label}` : label}
          </div>
          <b className="pf-rounded" style={{ fontSize: "1.5rem" }}>{money(total, currency)}</b>
          <div className="pf-mix-body">
            <div className="pf-mix-bar" aria-hidden>
              {[...lines].reverse().map((l) => (
                <span key={l.id} style={{ flexGrow: total ? (l.values[at] * wOf(lines.indexOf(l))) / total : 0, background: l.color }} data-dim={lit != null && lit !== l.id} />
              ))}
            </div>
            <div className="pf-mix-list">
              {lines.map((l) => {
                const off = hidden.has(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    className="pf-mix-row"
                    aria-pressed={!off}
                    title={off ? t("Show {name}", { name: l.name }) : t("Hide {name}", { name: l.name })}
                    data-off={off || undefined}
                    data-dim={lit != null && lit !== l.id}
                    onClick={() => toggle(l.id)}
                    onMouseEnter={() => setLit(off ? null : l.id)}
                    onMouseLeave={() => setLit(null)}
                  >
                    <i style={{ background: off ? "transparent" : l.color, borderColor: l.color }} />
                    <span className="pf-mix-name">{l.name}</span>
                    <b className="pf-rounded">{money(l.values[at], currency)}</b>
                    <span className="pf-rounded pf-mix-pct">{off ? "—" : `${total ? Math.round((l.values[at] / total) * 100) : 0}%`}</span>
                  </button>
                );
              })}
              {hidden.size > 0 && (
                <button type="button" className="pf-zoom-out pf-mix-all" onClick={() => setHidden(new Set())}>
                  {t("Show all")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A round axis top: 1 / 1.2 / 1.5 / 2 / 3 / 4 / 5 / 6 / 8 × 10ⁿ. */
function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return ([1, 1.2, 1.5, 2, 3, 4, 5, 6, 8, 10].find((m) => m * p >= v) ?? 10) * p;
}
