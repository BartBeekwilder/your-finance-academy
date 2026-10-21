"use client";

import { useEffect, useState } from "react";
import { summarize } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import LiveAmount from "./LiveAmount";
import Segmented from "./Segmented";
import TileSparkline from "./TileSparkline";
import { useZoom } from "./useZoom";

// The iOS Dashboard's Spent / Income / Balance group (LiveSpentTile,
// LiveAccrualTile, LiveBalanceTile). Each figure ticks as the month passes,
// so the tiles read "where you are now", not just what has been entered:
//   Income  = month's net income × fraction of month elapsed
//   Spent   = fixed costs × fraction + variable spending in full
//   Balance = live income − live spent
// Each tile has its own Month / Year toggle. Year adds the finished months
// (as entered) to the live month, so the number becomes the year to date.
// Switching zooms the tile's sparkline in or out about its "now" dot (see
// TileSparkline) while the number counts along to the other figure; the
// lines underneath swap to that period's figures.

const RED = "var(--pf-red)";
const GREEN = "var(--pf-green)";
const BLUE = "var(--pf-blue)";

type Mode = "month" | "year";

export default function LiveTiles({
  data,
  monthStart,
  monthlyIncome,
  enteredIncome,
  fixed,
  variable,
  currency,
}: {
  data: FinanceData;
  monthStart: Date;
  monthlyIncome: number;
  enteredIncome: number;
  fixed: number;
  variable: number;
  currency: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // 80 ms, like the net worth ticker, so the sub-cent digits visibly stream.
    const t = setInterval(() => setNow(Date.now()), 80);
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
  const month = monthStart.toLocaleDateString("en-GB", { month: "long" });
  const year = monthStart.getFullYear();

  // The finished months of this year, as entered.
  const past = Array.from({ length: monthStart.getMonth() }, (_, m) => summarize(data.transactions, new Date(year, m, 1)));
  const sum = (f: (s: (typeof past)[number]) => number) => past.reduce((t, s) => t + f(s), 0);
  const before = { income: sum((s) => s.income), spent: sum((s) => s.spent), fixed: sum((s) => s.fixed), variable: sum((s) => s.variable) };
  const monthsElapsed = monthStart.getMonth() + fraction;
  const ytd = { income: before.income + liveIncome, spent: before.spent + liveSpent };

  return (
    <div className="pf-card" style={{ overflow: "hidden", display: "grid", gridTemplateRows: "repeat(3, 1fr)" }}>
      <Tile
        title={() => "Income"}
        value={liveIncome}
        before={before.income}
        color={() => GREEN}
        currency={currency}
        chart={(z) => <TileSparkline data={data} series="income" color="#30d158" z={z} currency={currency} />}
      >
        {(mode) =>
          mode === "month" ? (
            <>
              <Sub label="Entered so far" value={enteredIncome} color={GREEN} currency={currency} />
              <Sub label="≈" value={monthlyIncome / days} suffix="/ day net" color={GREEN} currency={currency} />
              <Bar label={`${Math.round(fraction * 100)}% of month elapsed`} parts={elapsed(fraction, GREEN, "rgba(48,209,88,.25)")} />
            </>
          ) : (
            <>
              <Sub label="Entered this year" value={before.income + enteredIncome} color={GREEN} currency={currency} />
              <Sub label="≈" value={ytd.income / Math.max(monthsElapsed, 1)} suffix="/ month net" color={GREEN} currency={currency} />
              <Bar label={`${Math.round((monthsElapsed / 12) * 100)}% of year elapsed`} parts={elapsed(monthsElapsed / 12, GREEN, "rgba(48,209,88,.25)")} />
            </>
          )
        }
      </Tile>

      <Tile
        title={() => "Spent"}
        value={liveSpent}
        before={before.spent}
        color={() => RED}
        currency={currency}
        chart={(z) => <TileSparkline data={data} series="spent" color="#ff453a" z={z} currency={currency} />}
      >
        {(mode) => {
          const total = mode === "month" ? spentTotal : before.spent + spentTotal;
          const fix = mode === "month" ? fixed : before.fixed + fixed;
          const vary = mode === "month" ? variable : before.variable + variable;
          return (
            <>
              <Sub label={mode === "month" ? "Entered so far" : "Entered this year"} value={total} color={RED} currency={currency} />
              {mode === "month" ? (
                <Sub label="≈" value={spentTotal / dayOfMonth} suffix="/ day" color={RED} currency={currency} />
              ) : (
                <Sub label="≈" value={ytd.spent / Math.max(monthsElapsed, 1)} suffix="/ month" color={RED} currency={currency} />
              )}
              {total > 0 && (
                <Bar
                  label={`Fixed ${Math.round((fix / total) * 100)}% · Variable ${Math.round((vary / total) * 100)}%`}
                  parts={[
                    { share: fix / total, color: RED },
                    { share: vary / total, color: "rgba(255,69,58,.3)" },
                  ]}
                />
              )}
            </>
          );
        }}
      </Tile>

      <Tile
        title={(mode) => `Balance ${mode === "month" ? month : year}`}
        value={liveBalance}
        before={before.income - before.spent}
        color={(v) => (v >= 0 ? BLUE : RED)}
        currency={currency}
        last
        chart={(z, v) => <TileSparkline data={data} series="balance" color={v >= 0 ? "#0a84ff" : "#ff453a"} z={z} currency={currency} />}
      >
        {(mode) => {
          const inc = mode === "month" ? liveIncome : ytd.income;
          const bal = mode === "month" ? liveBalance : ytd.income - ytd.spent;
          if (inc <= 0) return null;
          const retained = Math.round((bal / inc) * 100);
          const share = Math.min(Math.max(retained, 0), 100) / 100;
          const c = bal >= 0 ? BLUE : RED;
          return (
            <Bar
              label={`${retained}% of income retained`}
              labelColor={c}
              parts={[
                { share, color: c },
                { share: 1 - share, color: bal >= 0 ? "rgba(10,132,255,.25)" : "rgba(255,69,58,.25)" },
              ]}
            />
          );
        }}
      </Tile>
    </div>
  );
}

const elapsed = (f: number, on: string, off: string) => [
  { share: f, color: on },
  { share: 1 - f, color: off },
];

/** One tile. `value` is this month's live figure; `before` is the finished
 *  months of the year, which Year mode adds on — eased with the zoom, so the
 *  number counts along while the sparkline zooms out. */
function Tile({ title, value, before, color, currency, last, chart, children }: {
  title: (mode: Mode) => string;
  value: number;
  before: number;
  color: (shown: number) => string;
  currency: string;
  last?: boolean;
  chart: (z: number, shown: number) => React.ReactNode;
  children: (mode: Mode) => React.ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("month");
  const z = useZoom(mode === "month" ? 1 : 0, 950);
  const shown = value + before * (1 - z);
  const c = color(shown);
  return (
    <div className="pf-tile" style={{ borderBottom: last ? 0 : "1px solid var(--pf-line)", ["--tile" as string]: c }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div key={title(mode)} className="pf-readout" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78rem", color: "var(--pf-ink-2)" }}>
          <span className="pf-pulse" style={{ background: c, ["--pf-pulse-color" as string]: c }} />
          {title(mode)}
        </div>
        <Segmented
          label={`${title("month").split(" ")[0]} period`}
          value={mode}
          onChange={setMode}
          options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]}
        />
      </div>
      <div>
        <LiveAmount value={shown} currency={currency} size="2rem" color={c} />
      </div>
      {chart(z, shown)}
      <div key={mode} className="pf-readout" style={{ display: "grid", gap: 4 }}>{children(mode)}</div>
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
