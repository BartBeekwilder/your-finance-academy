"use client";

import type { ReactNode } from "react";
import { money } from "@/lib/finance/format";
import { useShowAxes } from "@/lib/prefs";

/** A chart with its value labels down the left (€10K / €5K / €0), each
 *  sitting exactly on its gridline. `at` is the tick's height as a share of
 *  `height` from the bottom; `top` is how far below the wrapper's top the
 *  plotted area starts. Hidden — chart full width — when the user turns
 *  axis values off in Settings. */
export function WithYAxis({
  height,
  ticks,
  currency,
  top = 0,
  children,
}: {
  height: number;
  ticks: { value: number; at: number }[];
  currency: string;
  top?: number;
  children: ReactNode;
}) {
  const show = useShowAxes();
  if (!show) return <>{children}</>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 6, alignItems: "start" }}>
      <div className="pf-yaxis" style={{ height, marginTop: top }} aria-hidden>
        {ticks.map((t, i) => (
          <span key={i} style={{ bottom: `${t.at * 100}%` }}>
            {money(t.value, currency, { compact: true })}
          </span>
        ))}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Three ticks — 0, half, top — for a chart scaled from 0 to `max`. */
export const zeroToMax = (max: number) => [0, 0.5, 1].map((f) => ({ value: max * f, at: f }));
