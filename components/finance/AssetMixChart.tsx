"use client";

import { t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { balanceSheet, live, num } from "@/lib/finance/calc";
import { money, monthName, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import { useTween } from "./charts";
import Segmented from "./Segmented";

// Asset mix over time: what your assets are made of at the end of each month
// this year (this month: today), as stacked areas — Share (each band its % of
// all assets, the bands fill the height) or Amount (the bands in money).
// Built from the balance sheet of each month: accounts (with prepaid and
// receivable folded in), investments split by kind (crypto, stocks, precious
// metals — at market value), homes and the user's own asset posts. Largest band at
// the bottom. Switching Share ↔ Amount morphs the bands; pointing at a month
// shows its split; pointing at a legend entry lifts that band.

const H = 220;
const W = 1000;
const KIND_COLORS: Record<string, string> = {
  accounts: "#40c8e0",
  crypto: "#F7931A",
  stock: "#0A84FF",
  metal: "#D4AF37",
};
const OTHER_COLORS = ["#30d158", "#bf5af2", "#ff375f", "#8e8e93", "#64d2ff", "#5e5ce6", "#66d4cf", "#ffd60a"];

export type Series = { id: string; name: string; color: string; values: number[] };

export default function AssetMixChart({ data, now, currency }: { data: FinanceData; now: Date; currency: string }) {
  const year = now.getFullYear();
  const current = now.getMonth();

  const series = useMemo(() => {
    const kindName: Record<string, string> = { crypto: t("Crypto"), stock: t("Stocks"), metal: t("Precious metals") };

    const map = new Map<string, Series>();
    const add = (id: string, name: string, m: number, v: number) => {
      if (!map.has(id)) map.set(id, { id, name, color: "", values: new Array(current + 1).fill(0) });
      map.get(id)!.values[m] += Math.max(v, 0);
    };
    for (let m = 0; m <= current; m++) {
      const sheet = balanceSheet(data, now, m === current ? now : new Date(year, m, 1));
      for (const l of sheet.assets) {
        if (l.id === "accounts" || l.id === "prepaid" || l.id === "receivable" || l.id === "pending") add("accounts", t("Accounts"), m, l.value);
        else if (l.id === "investments") {
          // Per kind at that month's market value (the balance line's parts).
          if (l.parts?.length) for (const p of l.parts) add(p.id.replace("kind-", ""), kindName[p.id.replace("kind-", "")] ?? p.name, m, p.value);
          else add("investments", t("Investments"), m, l.value);
        } else add(l.id, l.name, m, l.value);
      }
    }
    // Largest (today) at the bottom; colours fixed per kind, the rest in turn.
    const list = [...map.values()].filter((s) => s.values.some((v) => v > 0.005)).sort((a, b) => b.values[current] - a.values[current]);
    let o = 0;
    for (const s of list) s.color = KIND_COLORS[s.id] ?? OTHER_COLORS[o++ % OTHER_COLORS.length];
    return list;
  }, [data, now, currency, year, current]);

  return <StackedMix series={series} now={now} currency={currency} note={t("End of each month this year (this month: today). Investments at market value.")} />;
}

/** The stacked-areas chart itself (shared with the Balance page's 2D view):
 *  one band per series over Jan … this month, Share (100%) or Amount, a
 *  month read-out on hover and a legend that lifts one band. `lit` can be
 *  controlled from outside (clicking a balance bar picks a post); `extra`
 *  sits next to the Share | Amount switch. */
export function StackedMix({
  series,
  now,
  currency,
  note,
  lit: litProp,
  onLit,
  extra,
  lowerIsBetter,
}: {
  series: Series[];
  now: Date;
  currency: string;
  note?: string;
  lit?: string | null;
  onLit?: (id: string | null) => void;
  extra?: React.ReactNode;
  /** Series where going down is good (debts): their change shows green. */
  lowerIsBetter?: (id: string) => boolean;
}) {
  const [mode, setMode] = useState<"share" | "amount">("share");
  const [hover, setHover] = useState<number | null>(null);
  const [litOwn, setLitOwn] = useState<string | null>(null);
  // Picked from outside (sticky) wins; hovering the legend previews another.
  const lit = litOwn ?? litProp ?? null;
  const setLit = (id: string | null) => setLitOwn(id);
  const year = now.getFullYear();
  const current = now.getMonth();
  const months = current + 1;
  const totals = Array.from({ length: months }, (_, m) => series.reduce((t, s) => t + s.values[m], 0));
  const maxTotal = Math.max(...totals, 1);
  // Heights as a share of the plot: per month's total (Share) or of the
  // largest total (Amount). Tweened, so the switch morphs.
  const target = series.flatMap((s) => s.values.map((v, m) => (mode === "share" ? (totals[m] ? v / totals[m] : 0) : v / maxTotal)));
  const shown = useTween(target, 700);
  const h = (si: number, m: number) => shown[si * months + m] ?? 0;

  // One month draws as a flat band across the width.
  const xs = months === 1 ? [0, W] : Array.from({ length: months }, (_, m) => (m / (months - 1)) * W);
  const at = (m: number) => (months === 1 ? 0 : m);
  const y = (f: number) => H - f * H;

  const bands = series.map((s, si) => {
    const lower = xs.map((_, i) => series.slice(0, si).reduce((t, _s, sj) => t + h(sj, at(i)), 0));
    const upper = lower.map((l, i) => l + h(si, at(i)));
    const top = xs.map((x, i) => `${x},${y(upper[i])}`);
    const bottom = xs.map((x, i) => `${x},${y(lower[i])}`).reverse();
    return { s, d: `M${top.join(" L")} L${bottom.join(" L")} Z`, line: `M${top.join(" L")}` };
  });

  const ticks = mode === "share" ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
  const tickLabel = (f: number) => (mode === "share" ? `${Math.round(f * 100)}%` : money(f * maxTotal, currency, { compact: true }));

  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    setHover(months === 1 ? 0 : Math.min(Math.max(Math.round(f * (months - 1)), 0), months - 1));
  };
  const hx = hover === null ? 0 : months === 1 ? 50 : (hover / (months - 1)) * 100;

  if (series.length === 0) {
    return <div className="pf-card" style={{ padding: 16, color: "var(--pf-ink-2)" }}>{t("Add an account balance or an investment to see where your money sits.")}</div>;
  }

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="pf-mix-legend">
          {series.map((s) => (
            <button
              key={s.id}
              type="button"
              data-dim={lit !== null && lit !== s.id}
              onMouseEnter={() => setLit(s.id)}
              onMouseLeave={() => setLit(null)}
              onFocus={() => setLit(s.id)}
              onBlur={() => setLit(null)}
              onClick={() => onLit?.(litProp === s.id ? null : s.id)}
              data-picked={litProp === s.id}
            >
              <span className="pf-cbar-swatch" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {extra}
        <Segmented
          size="sm"
          label={t("Asset mix view")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "share", label: t("Share") },
            { value: "amount", label: t("Amount") },
          ]}
        />
        </div>
      </div>
      {litProp && (() => {
        // The picked post through the year: its value now and its range.
        const s = series.find((x) => x.id === litProp);
        if (!s) return null;
        const now_ = s.values[current];
        const first = s.values.find((v) => v > 0) ?? 0;
        return (
          <div key={s.id} className="pf-mix-picked pf-readout" style={{ ["--c" as string]: s.color }}>
            <span className="pf-cbar-swatch" style={{ background: s.color }} />
            <b>{s.name}</b>
            <span className="pf-rounded">{money(now_, currency)}</span>
            <span style={{ color: "var(--pf-ink-3)" }}>· {pctLabel(now_ / (totals[current] || 1))} {t("today")}</span>
            {first > 0 && Math.abs(now_ - first) > 0.005 && (
              <span style={{ color: (now_ >= first) !== !!lowerIsBetter?.(s.id) ? "var(--pf-green)" : "var(--pf-red)" }}>
                {money(now_ - first, currency, { signed: true })} {t("this year")}
              </span>
            )}
            <button type="button" className="pf-link" onClick={() => onLit?.(null)} style={{ marginLeft: "auto" }}>{t("Show all")}</button>
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 8 }}>
        <div style={{ position: "relative", height: H, fontSize: "0.6rem", color: "var(--pf-ink-3)", textAlign: "right", minWidth: 34 }} aria-hidden>
          {ticks.map((f) => (
            <span key={`${mode}${f}`} className="pf-readout" style={{ position: "absolute", right: 0, bottom: `${f * 100}%`, translate: "0 50%", whiteSpace: "nowrap" }}>
              {tickLabel(f)}
            </span>
          ))}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ position: "relative", height: H, touchAction: "pan-y", cursor: "crosshair" }} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block", overflow: "visible" }} role="img" aria-label={t("Asset mix over time")}>
              {ticks.map((f) => (
                <line key={f} x1={0} x2={W} y1={y(f)} y2={y(f)} stroke="var(--pf-line)" vectorEffect="non-scaling-stroke" />
              ))}
              <g className="pf-tsl-draw">
                {bands.map(({ s, d, line }) => (
                  <g key={s.id} className="pf-mix-band" data-dim={lit !== null && lit !== s.id} onClick={() => onLit?.(litProp === s.id ? null : s.id)} style={{ cursor: onLit ? "pointer" : undefined }}>
                    <path d={d} fill={s.color} fillOpacity={0.82} />
                    <path d={line} fill="none" stroke={s.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  </g>
                ))}
              </g>
              {hover !== null && <line x1={(hx / 100) * W} x2={(hx / 100) * W} y1={0} y2={H} stroke="rgba(255,255,255,0.55)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
            </svg>
            {hover !== null && (
              <div
                key={hover}
                className="pf-mix-tip"
                style={{ left: `${hx}%`, translate: `-${hx}% 0` }}
              >
                <b>
                  {monthName(new Date(year, hover, 1))} {year}
                  {hover === current ? ` · ${t("today")}` : ""}
                </b>
                {[...series].reverse().map((s) => {
                  const v = s.values[hover];
                  if (v <= 0.005) return null;
                  return (
                    <span key={s.id}>
                      <span className="pf-cbar-swatch" style={{ background: s.color }} />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span className="pf-rounded">{pctLabel(v / (totals[hover] || 1))}</span>
                      <span className="pf-rounded" style={{ color: "var(--pf-ink-3)" }}>{money(v, currency, { compact: true })}</span>
                    </span>
                  );
                })}
                <span style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 4 }}>
                  <span style={{ flex: 1 }}>{t("Total")}</span>
                  <span className="pf-rounded">{money(totals[hover], currency, { compact: true })}</span>
                </span>
              </div>
            )}
          </div>
          <div className="pf-tsl-x" aria-hidden>
            {Array.from({ length: months }, (_, m) => (
              <span key={m} data-lit={m === current} style={{ left: `${months === 1 ? 50 : (m / (months - 1)) * 100}%`, ["--dot" as string]: "var(--pf-ink)" }}>
                {shortMonth(new Date(year, m, 1))}
              </span>
            ))}
          </div>
        </div>
      </div>
      {note && <div style={{ fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>{note}</div>}
    </div>
  );
}

/** Whole percent, with "<1%" for a sliver that would round to nothing. */
function pctLabel(f: number) {
  return f > 0 && f < 0.005 ? "<1%" : `${Math.round(f * 100)}%`;
}
