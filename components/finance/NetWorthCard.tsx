"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { money } from "@/lib/finance/format";

// The iOS NetWorthTicker: a live figure that creeps forward at the user's
// recent monthly pace (income − expenses), plus This Day / Month / Year
// deltas. The spinning thousandths are purely visual, as on iOS.

export default function NetWorthCard({
  base,
  monthlyPace,
  monthDelta,
  yearDelta,
  currency,
}: {
  base: number;
  monthlyPace: number;
  monthDelta: number;
  yearDelta: number;
  currency: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(t);
  }, []);

  const perMs = monthlyPace / (30.44 * 24 * 3600 * 1000);
  const d = new Date(now);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const live = base + (now - startOfMonth) * perMs;
  const dayDelta = (now - startOfDay) * perMs;
  const up = monthlyPace >= 0;
  const micro = String(Math.floor((now / 7) % 1000)).padStart(3, "0");

  return (
    <section
      className="pf-card"
      style={{
        padding: 18,
        borderRadius: 18,
        background: `linear-gradient(135deg, ${up ? "rgba(48,209,88,.20)" : "rgba(255,159,10,.20)"}, rgba(10,132,255,.06)), var(--pf-card)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.05em", color: "var(--pf-ink-2)" }}>
        <span className="pf-pulse" /> NET WORTH · LIVE
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
        <span className="pf-rounded" style={{ display: "inline-flex", alignItems: "baseline", gap: 1 }}>
          <span style={{ fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.15 }}>{money(live, currency)}</span>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--pf-ink-2)" }}>.{micro}</span>
        </span>
        {up ? (
          <ArrowUpRight size={16} strokeWidth={3} color="var(--pf-green)" style={{ marginTop: 8 }} />
        ) : (
          <ArrowDownRight size={16} strokeWidth={3} color="var(--pf-orange)" style={{ marginTop: 8 }} />
        )}
        <div style={{ marginLeft: "auto", display: "grid", gap: 3, textAlign: "right", fontSize: "0.72rem", paddingTop: 4 }}>
          <Stat label="This Day" value={dayDelta} currency={currency} />
          <Stat label="This Month" value={monthDelta} currency={currency} />
          <Stat label="This Year" value={yearDelta} currency={currency} />
        </div>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: "0.68rem", color: "var(--pf-ink-3)" }}>
        Estimated live pace, based on your recent months
      </p>
    </section>
  );
}

function Stat({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div>
      <span style={{ color: "var(--pf-ink-2)" }}>{label} </span>
      <span className="pf-rounded" style={{ fontWeight: 600, color: value >= 0 ? "var(--pf-green)" : "var(--pf-orange)" }}>
        {money(value, currency, { signed: true })}
      </span>
    </div>
  );
}
