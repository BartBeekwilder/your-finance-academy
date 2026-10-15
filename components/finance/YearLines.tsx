"use client";

import { useEffect, useState } from "react";
import { summarize } from "@/lib/finance/calc";
import { money, monthYear, shortMonth } from "@/lib/finance/format";
import type { Transaction } from "@/lib/finance/types";

// Income and spending per month for this calendar year, as two lines. The
// current month is still running: its point uses the same live figures as the
// dashboard tiles (projected income accruing over the month; fixed costs
// spread over the month plus variable spending in full), drawn dashed and
// ticking. Hover (or drag on touch) to read any month.

const GREEN = "#30d158";
const RED = "#ff453a";

export default function YearLines({
  transactions,
  now,
  currency,
  monthlyIncome,
}: {
  transactions: Transaction[];
  now: Date;
  currency: string;
  /** This month's projected net income, which the live point accrues toward. */
  monthlyIncome: number;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const current = now.getMonth();
  const year = now.getFullYear();
  const days = new Date(year, current + 1, 0).getDate();
  const fraction = Math.min(Math.max((tick - new Date(year, current, 1).getTime()) / (days * 86_400_000), 0), 1);
  const points = Array.from({ length: current + 1 }, (_, m) => {
    const s = summarize(transactions, new Date(year, m, 1));
    return m === current
      ? { month: new Date(year, m, 1), income: monthlyIncome * fraction, spent: s.fixed * fraction + s.variable }
      : { month: new Date(year, m, 1), income: s.income, spent: s.spent };
  });

  const W = 480, H = 150, PAD = 6;
  const max = niceMax(Math.max(1, ...points.flatMap((p) => [p.income, p.spent])));
  const x = (i: number) => (i / 11) * W;
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const path = (key: "income" | "spent", from: number, to: number) =>
    points.slice(from, to + 1).map((p, i) => `${i ? "L" : "M"}${x(from + i)},${y(p[key])}`).join(" ");
  const done = current - 1; // last complete month

  const shown = sel ?? current;
  const p = points[shown];
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSel(Math.max(0, Math.min(current, Math.round(((e.clientX - r.left) / r.width) * 11))));
  };

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>Income vs Spent — {now.getFullYear()}</span>
        <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>
          {monthYear(p.month)}
          {shown === current && " · live"} · <span style={{ color: GREEN, fontWeight: 600 }}>{money(p.income, currency)}</span> ·{" "}
          <span style={{ color: RED, fontWeight: 600 }}>{money(p.spent, currency)}</span>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: "0.58rem", color: "var(--pf-ink-3)", textAlign: "right", height: H }}>
          <span>{money(max, currency, { compact: true })}</span>
          <span>{money(max / 2, currency, { compact: true })}</span>
          <span>{money(0, currency, { compact: true })}</span>
        </div>
        <div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            preserveAspectRatio="none"
            style={{ display: "block", touchAction: "none", cursor: "crosshair", overflow: "visible" }}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setSel(null)}
            role="img"
            aria-label={`Income and spending per month in ${now.getFullYear()}`}
          >
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--pf-line)" vectorEffect="non-scaling-stroke" />
            ))}
            {(["income", "spent"] as const).map((key) => {
              const c = key === "income" ? GREEN : RED;
              return (
                <g key={key}>
                  {done >= 0 && <path d={path(key, 0, done)} fill="none" stroke={c} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                  {current > 0 && (
                    <path d={path(key, done, current)} fill="none" stroke={c} strokeWidth={2.5} strokeDasharray="5 5" opacity={0.7} vectorEffect="non-scaling-stroke" />
                  )}
                </g>
              );
            })}
            <line x1={x(shown)} x2={x(shown)} y1={0} y2={H} stroke="var(--pf-ink-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Dots in HTML so they stay round despite the stretched SVG. */}
          <div style={{ position: "relative", height: 0 }}>
            {(["income", "spent"] as const).map((key) => (
              <span
                key={key}
                style={{
                  position: "absolute",
                  left: `${(shown / 11) * 100}%`,
                  top: y(p[key]) - H,
                  width: 8,
                  height: 8,
                  marginLeft: -4,
                  marginTop: -4,
                  borderRadius: "50%",
                  background: key === "income" ? GREEN : RED,
                  border: "2px solid #1c1c1e",
                  pointerEvents: "none",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {Array.from({ length: 12 }, (_, m) => (
              <span key={m} style={{ width: 0, display: "flex", justifyContent: "center", fontSize: "0.56rem", color: m === shown ? "var(--pf-ink)" : "var(--pf-ink-3)", fontWeight: m === current ? 700 : 400 }}>
                {shortMonth(new Date(now.getFullYear(), m, 1)).slice(0, 1)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, fontSize: "0.68rem", color: "var(--pf-ink-2)" }}>
        <Key color={GREEN} label="Income" />
        <Key color={RED} label="Spent" />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 14, borderTop: "2px dashed var(--pf-ink-2)" }} /> This month, live
        </span>
      </div>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 14, height: 2.5, borderRadius: 2, background: color }} /> {label}
    </span>
  );
}

/** Round the axis top up to 1, 2 or 5 × a power of ten, so labels read cleanly. */
function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}
