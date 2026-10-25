"use client";

import { t } from "@/lib/i18n";
import { useState } from "react";
import { live, num } from "@/lib/finance/calc";
import { money, monthName, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import { WithYAxis } from "./YAxis";

// Gross vs net income per month this year: two lines, the band between
// them the deductions (tax, premiums). An income without a gross counts
// gross = net. Point at a month to read it.

const GROSS = "#bf5af2";
const NET = "#30d158";

/** Gross and net income per month, Jan … `upTo` (0-based). */
export function grossNetByMonth(data: FinanceData, year: number, upTo: number) {
  const months = Array.from({ length: upTo + 1 }, () => ({ gross: 0, net: 0 }));
  for (const x of live(data.transactions)) {
    if (x.type !== "income") continue;
    const d = new Date(x.date);
    if (d.getFullYear() !== year || d.getMonth() > upTo) continue;
    const net = num(x.amount);
    months[d.getMonth()].net += net;
    months[d.getMonth()].gross += x.gross_amount != null ? num(x.gross_amount) : net;
  }
  return months;
}

export default function GrossNetChart({ data, now, currency }: { data: FinanceData; now: Date; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const year = now.getFullYear(), current = now.getMonth();
  const months = grossNetByMonth(data, year, current);
  const max = niceTop(Math.max(1, ...months.map((m) => m.gross)));
  const H = 180, W = 1000;
  const n = months.length;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - 6 - (v / max) * (H - 12);
  const line = (k: "gross" | "net") => months.map((m, i) => `${i ? "L" : "M"}${x(i)},${y(m[k])}`).join(" ");
  const band = `${line("gross")} ${[...months].reverse().map((m, j) => `L${x(n - 1 - j)},${y(m.net)}`).join(" ")} Z`;
  const shown = hover ?? current;
  const m = months[shown];
  const pct = m.gross > 0 ? Math.round(((m.gross - m.net) / m.gross) * 100) : 0;
  const totals = months.reduce((a, b) => ({ gross: a.gross + b.gross, net: a.net + b.net }), { gross: 0, net: 0 });
  if (totals.gross <= 0) return null;
  // No gross entered yet: the lines would coincide — say how to fill it.
  if (totals.gross - totals.net < 0.005) {
    return (
      <section className="pf-card" style={{ padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: GROSS, boxShadow: `0 0 10px ${GROSS}` }} />
        <span style={{ flex: 1, fontSize: "0.85rem", color: "var(--pf-ink-2)" }}>
          {t("Add the gross amount when you enter income (Quick Add) to see gross and net side by side, and what goes to tax and premiums.")}
        </span>
        <button type="button" className="pf-chip" onClick={() => window.dispatchEvent(new Event("pf-quick-add"))}>{t("Add income")}</button>
      </section>
    );
  }

  return (
    <section className="pf-card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{t("Gross and net per month — {year}", { year })}</span>
        <span key={shown} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          <b style={{ color: "var(--pf-ink)" }}>{monthName(new Date(year, shown, 1))}</b> · <span style={{ color: GROSS }}>{t("gross")} {money(m.gross, currency)}</span> ·{" "}
          <span style={{ color: NET }}>{t("net")} {money(m.net, currency)}</span> · {t("deductions {amount} ({pct}%)", { amount: money(m.gross - m.net, currency), pct })}
        </span>
      </div>
      <WithYAxis height={H} currency={currency} ticks={[0, 0.5, 1].map((f) => ({ value: max * f, at: (6 + f * (H - 12)) / H }))}>
        <div style={{ position: "relative", height: H }} onMouseLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(n === 1 ? 0 : Math.min(Math.max(Math.round(((e.clientX - r.left) / r.width) * (n - 1)), 0), n - 1));
          }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block", overflow: "visible" }} aria-hidden>
            {[0, 0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--pf-line)" vectorEffect="non-scaling-stroke" />)}
            <g className="pf-tsl-draw">
              <path d={band} fill={GROSS} fillOpacity={0.14} />
              <path d={line("gross")} fill="none" stroke={GROSS} strokeWidth={2.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path d={line("net")} fill="none" stroke={NET} strokeWidth={2.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
            <line x1={x(shown)} x2={x(shown)} y1={0} y2={H} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </svg>
          {(["gross", "net"] as const).map((k) => (
            <span key={k} className="pf-tsl-pick" style={{ left: `${(x(shown) / W) * 100}%`, top: y(m[k]), ["--dot" as string]: k === "gross" ? GROSS : NET }} />
          ))}
        </div>
      </WithYAxis>
      <div className="pf-tsl-x" aria-hidden style={{ marginLeft: 0 }}>
        {months.map((_, i) => (
          <span key={i} data-lit={i === shown} style={{ left: `${(x(i) / W) * 100}%`, ["--dot" as string]: "var(--pf-ink)" }}>{shortMonth(new Date(year, i, 1))}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.7rem", color: "var(--pf-ink-2)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2.5, background: GROSS }} />{t("Gross")}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2.5, background: NET }} />{t("Net")}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: GROSS, opacity: 0.25 }} />{t("Deductions (tax, premiums)")}</span>
      </div>
    </section>
  );
}

function niceTop(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 1.2, 1.5, 2, 3, 4, 5, 6, 8, 10].find((k) => k * p >= v) ?? 10) * p;
}
