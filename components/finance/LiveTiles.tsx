"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/finance/format";

// The iOS Dashboard's Spent / Income / Balance group (LiveSpentTile,
// LiveAccrualTile, LiveBalanceTile). Each figure ticks once a second as the
// month passes, so the tiles read "where you are now", not just what has
// been entered:
//   Income  = month's net income × fraction of month elapsed
//   Spent   = fixed costs × fraction + variable spending in full
//   Balance = live income − live spent
// The real entered totals sit underneath as "Entered so far".

const RED = "var(--pf-red)";
const GREEN = "var(--pf-green)";
const BLUE = "var(--pf-blue)";

export default function LiveTiles({
  monthStart,
  monthlyIncome,
  enteredIncome,
  fixed,
  variable,
  currency,
}: {
  monthStart: Date;
  monthlyIncome: number;
  enteredIncome: number;
  fixed: number;
  variable: number;
  currency: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = monthStart.getTime();
  const days = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const fraction = Math.min(Math.max((now - start) / (days * 86_400_000), 0), 1);
  const dayOfMonth = Math.max(1, Math.ceil(fraction * days));

  const liveIncome = monthlyIncome * fraction;
  const liveSpent = fixed * fraction + variable;
  const liveBalance = liveIncome - liveSpent;
  const spentTotal = fixed + variable;
  const balanceColor = liveBalance >= 0 ? BLUE : RED;
  const retained = liveIncome > 0 ? Math.round((liveBalance / liveIncome) * 100) : null;
  const month = monthStart.toLocaleDateString("en-GB", { month: "long" });

  return (
    <div className="pf-card" style={{ overflow: "hidden" }}>
      <Tile title="Income" value={liveIncome} color={GREEN} currency={currency}>
        <Sub label="Entered so far" value={enteredIncome} color={GREEN} currency={currency} />
        <Sub label="≈" value={monthlyIncome / days} suffix="/ day net" color={GREEN} currency={currency} />
        <Bar
          label={`${Math.round(fraction * 100)}% of month elapsed`}
          parts={[
            { share: fraction, color: GREEN },
            { share: 1 - fraction, color: "rgba(48,209,88,.25)" },
          ]}
        />
      </Tile>

      <Tile title="Spent" value={liveSpent} color={RED} currency={currency}>
        <Sub label="Entered so far" value={spentTotal} color={RED} currency={currency} />
        <Sub label="≈" value={spentTotal / dayOfMonth} suffix="/ day" color={RED} currency={currency} />
        {spentTotal > 0 && (
          <Bar
            label={`Fixed ${Math.round((fixed / spentTotal) * 100)}% · Variable ${Math.round((variable / spentTotal) * 100)}%`}
            parts={[
              { share: fixed / spentTotal, color: RED },
              { share: variable / spentTotal, color: "rgba(255,69,58,.3)" },
            ]}
          />
        )}
      </Tile>

      <Tile title={`Balance ${month}`} value={liveBalance} color={balanceColor} currency={currency} last>
        {retained !== null && (
          <Bar
            label={`${retained}% of income retained`}
            labelColor={balanceColor}
            parts={[
              { share: Math.min(Math.max(retained, 0), 100) / 100, color: balanceColor },
              { share: 1 - Math.min(Math.max(retained, 0), 100) / 100, color: liveBalance >= 0 ? "rgba(10,132,255,.25)" : "rgba(255,69,58,.25)" },
            ]}
          />
        )}
      </Tile>
    </div>
  );
}

function Tile({ title, value, color, currency, last, children }: {
  title: string; value: number; color: string; currency: string; last?: boolean; children?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "12px 14px", borderBottom: last ? 0 : "1px solid var(--pf-line)", display: "grid", gap: 4 }}>
      <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{title}</div>
      <div className="pf-rounded" style={{ fontSize: "1.45rem", fontWeight: 700, color }}>{money(value, currency)}</div>
      {children}
    </div>
  );
}

function Sub({ label, value, suffix, color, currency }: { label: string; value: number; suffix?: string; color: string; currency: string }) {
  return (
    <div style={{ fontSize: "0.68rem", color: "var(--pf-ink-2)", display: "flex", gap: 4 }}>
      {label}
      <span className="pf-rounded" style={{ fontWeight: 600, color, opacity: 0.8 }}>{money(value, currency)}</span>
      {suffix}
    </div>
  );
}

function Bar({ label, labelColor, parts }: { label: string; labelColor?: string; parts: { share: number; color: string }[] }) {
  return (
    <div style={{ display: "grid", gap: 4, marginTop: 2 }}>
      <div style={{ fontSize: "0.68rem", color: labelColor ?? "var(--pf-ink-3)", opacity: labelColor ? 0.8 : 1 }}>{label}</div>
      <div style={{ display: "flex", gap: 2, height: 4 }}>
        {parts.map((p, i) => (
          <span key={i} style={{ width: `${p.share * 100}%`, background: p.color, borderRadius: 2 }} />
        ))}
      </div>
    </div>
  );
}
