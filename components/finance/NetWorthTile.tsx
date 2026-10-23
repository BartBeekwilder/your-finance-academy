"use client";

import { t } from "@/lib/i18n";
import { useMemo } from "react";
import { netWorthFigures } from "@/lib/finance/calc";
import type { FinanceData } from "@/lib/finance/types";
import { useNow } from "@/lib/motion";
import { Bar, Sub, Tile, type Mode } from "./LiveTiles";
import TileSparkline from "./TileSparkline";

// The live net worth tile — the Income / Spent / Balance tiles' sibling.
// Net worth = today's accounts + holdings (at cost), moved through this
// month by the live Balance (same rules). Month / Year: the number stays the
// net worth; the sparkline zooms between this month and the year (built from
// the start-of-year value, with the dotted forecast to December) and the
// lines underneath give the change over that period.

const TEAL = "#40c8e0";

export default function NetWorthTile({ data, currency, onModeChange, mode }: { data: FinanceData; currency: string; onModeChange?: (m: Mode) => void; mode?: Mode }) {
  const nw = useMemo(() => netWorthFigures(data, new Date()), [data]);
  const now = useNow(80);
  const change = nw.liveChange(now);
  const value = nw.base + change;
  const d = new Date(now);
  const fraction = Math.min(Math.max((now - new Date(d.getFullYear(), d.getMonth(), 1).getTime()) / (nw.days * 86_400_000), 0), 1);
  const monthsElapsed = d.getMonth() + fraction;
  const yearChange = value - nw.startOfYear;

  return (
    <div className="pf-card" style={{ overflow: "hidden" }}>
      <Tile
        title={() => t("Net worth")}
        value={value}
        before={0}
        color={() => TEAL}
        currency={currency}
        last
        onModeChange={onModeChange}
        mode={mode}
        chart={(z, _v, abs) => <TileSparkline data={data} series="networth" color={TEAL} z={z} currency={currency} offset={nw.startOfYear} absolute={abs} />}
      >
        {(mode) =>
          mode === "month" ? (
            <>
              <Sub label={t("Change this month")} value={change} color={change >= 0 ? "var(--pf-green)" : "var(--pf-red)"} currency={currency} />
              <Sub label={t("Start of month")} value={nw.base} color={TEAL} currency={currency} />
              <Bar label={t("{v1}% of month elapsed", { v1: Math.round(fraction * 100) })} parts={[{ share: fraction, color: TEAL }, { share: 1 - fraction, color: "rgba(64,200,224,.25)" }]} />
            </>
          ) : (
            <>
              <Sub label={t("Change this year")} value={yearChange} color={yearChange >= 0 ? "var(--pf-green)" : "var(--pf-red)"} currency={currency} />
              <Sub label="≈" value={yearChange / Math.max(monthsElapsed, 1)} suffix="/ month" color={TEAL} currency={currency} />
              <Bar label={t("{v1}% of year elapsed", { v1: Math.round((monthsElapsed / 12) * 100) })} parts={[{ share: monthsElapsed / 12, color: TEAL }, { share: 1 - monthsElapsed / 12, color: "rgba(64,200,224,.25)" }]} />
            </>
          )
        }
      </Tile>
    </div>
  );
}
