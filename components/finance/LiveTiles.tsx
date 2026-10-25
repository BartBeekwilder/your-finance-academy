"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useState } from "react";
import { summarize } from "@/lib/finance/calc";
import { useTickerNow } from "@/lib/motion";
import { money, monthName } from "@/lib/finance/format";
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

export type Mode = "month" | "year";

export default function LiveTiles({
  data,
  monthStart,
  monthlyIncome,
  enteredIncome,
  fixed,
  variable,
  currency,
  only,
  onModeChange,
  mode,
}: {
  data: FinanceData;
  monthStart: Date;
  monthlyIncome: number;
  enteredIncome: number;
  fixed: number;
  variable: number;
  currency: string;
  /** Show just this tile (the Income and Expenses pages). */
  only?: "income" | "spent" | "balance";
  /** Told when a tile switches Month / Year (so a page can follow along). */
  onModeChange?: (mode: Mode) => void;
  /** A page-level Month / Year switch the tiles follow (theirs hide). */
  mode?: Mode;
}) {
  // As often as the live decimals need (80 ms at five, so the sub-cent
  // digits visibly stream; Settings › Animations).
  const now = useTickerNow();

  const start = monthStart.getTime();
  const days = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const fraction = Math.min(Math.max((now - start) / (days * 86_400_000), 0), 1);
  const dayOfMonth = Math.max(1, Math.ceil(fraction * days));

  const liveIncome = monthlyIncome * fraction;
  const liveSpent = fixed * fraction + variable;
  const liveBalance = liveIncome - liveSpent;
  const spentTotal = fixed + variable;
  const month = monthName(monthStart);
  const year = monthStart.getFullYear();

  // The finished months of this year, as entered.
  const past = Array.from({ length: monthStart.getMonth() }, (_, m) => summarize(data.transactions, new Date(year, m, 1)));
  const sum = (f: (s: (typeof past)[number]) => number) => past.reduce((t, s) => t + f(s), 0);
  const before = { income: sum((s) => s.income), spent: sum((s) => s.spent), fixed: sum((s) => s.fixed), variable: sum((s) => s.variable) };
  const monthsElapsed = monthStart.getMonth() + fraction;
  const ytd = { income: before.income + liveIncome, spent: before.spent + liveSpent };

  return (
    <div className="pf-card" style={{ overflow: "hidden", display: "grid", gridTemplateRows: only ? undefined : "repeat(3, 1fr)" }}>
      {(!only || only === "income") && <Tile
        title={() => t("Income")}
        last={only === "income"}
        onModeChange={onModeChange}
        mode={mode}
        value={liveIncome}
        before={before.income}
        color={() => GREEN}
        currency={currency}
        chart={(z, _v, abs) => <TileSparkline data={data} series="income" color="#30d158" z={z} currency={currency} absolute={abs} />}
      >
        {(mode) =>
          mode === "month" ? (
            <>
              <Sub label={t("Entered so far")} value={enteredIncome} color={GREEN} currency={currency} />
              <Sub label="≈" value={monthlyIncome / days} suffix={t("/ day net")} color={GREEN} currency={currency} />
              <Bar label={t("{v1}% of month elapsed", { v1: Math.round(fraction * 100) })} parts={elapsed(fraction, GREEN, "rgba(48,209,88,.25)")} />
            </>
          ) : (
            <>
              <Sub label={t("Entered this year")} value={before.income + enteredIncome} color={GREEN} currency={currency} />
              <Sub label="≈" value={ytd.income / Math.max(monthsElapsed, 1)} suffix={t("/ month net")} color={GREEN} currency={currency} />
              <Bar label={t("{v1}% of year elapsed", { v1: Math.round((monthsElapsed / 12) * 100) })} parts={elapsed(monthsElapsed / 12, GREEN, "rgba(48,209,88,.25)")} />
            </>
          )
        }
      </Tile>}

      {(!only || only === "spent") && <Tile
        title={() => t("Spent")}
        last={only === "spent"}
        onModeChange={onModeChange}
        mode={mode}
        value={liveSpent}
        before={before.spent}
        color={() => RED}
        currency={currency}
        chart={(z, _v, abs) => <TileSparkline data={data} series="spent" color="#ff453a" z={z} currency={currency} absolute={abs} />}
      >
        {(mode) => {
          const total = mode === "month" ? spentTotal : before.spent + spentTotal;
          const fix = mode === "month" ? fixed : before.fixed + fixed;
          const vary = mode === "month" ? variable : before.variable + variable;
          return (
            <>
              <Sub label={mode === "month" ? t("Entered so far") : t("Entered this year")} value={total} color={RED} currency={currency} />
              {mode === "month" ? (
                <Sub label="≈" value={spentTotal / dayOfMonth} suffix={t("/ day")} color={RED} currency={currency} />
              ) : (
                <Sub label="≈" value={ytd.spent / Math.max(monthsElapsed, 1)} suffix={t("/ month")} color={RED} currency={currency} />
              )}
              {total > 0 && (
                <Bar
                  label={t("Fixed {f}% · Variable {v}%", { f: Math.round((fix / total) * 100), v: Math.round((vary / total) * 100) })}
                  parts={[
                    { share: fix / total, color: RED },
                    { share: vary / total, color: "rgba(255,69,58,.3)" },
                  ]}
                />
              )}
            </>
          );
        }}
      </Tile>}

      {(!only || only === "balance") && <Tile
        title={(mode) => t("Balance {period}", { period: mode === "month" ? month : year })}
        value={liveBalance}
        before={before.income - before.spent}
        color={(v) => (v >= 0 ? BLUE : RED)}
        currency={currency}
        last
        chart={(z, v, abs) => <TileSparkline data={data} series="balance" color={v >= 0 ? "#0a84ff" : "#ff453a"} z={z} currency={currency} absolute={abs} />}
      >
        {(mode) => {
          const inc = mode === "month" ? liveIncome : ytd.income;
          const bal = mode === "month" ? liveBalance : ytd.income - ytd.spent;
          // What's left over on average so far: the tile's own balance (the
          // same live model as the big number) per day (month) / month (year).
          const lc = bal >= 0 ? BLUE : RED;
          const lines =
            mode === "month" ? (
              <Sub label="≈" value={bal / dayOfMonth} suffix={t("/ day left over")} color={lc} currency={currency} />
            ) : (
              <Sub label="≈" value={bal / Math.max(monthsElapsed, 1)} suffix={t("/ month left over")} color={lc} currency={currency} />
            );
          if (inc <= 0) return lines;
          const retained = Math.round((bal / inc) * 100);
          const share = Math.min(Math.max(retained, 0), 100) / 100;
          const c = bal >= 0 ? BLUE : RED;
          return (
            <>
            {lines}
            <Bar
              label={t("{retained}% of income retained", { retained })}
              labelColor={c}
              parts={[
                { share, color: c },
                { share: 1 - share, color: bal >= 0 ? "rgba(10,132,255,.25)" : "rgba(255,69,58,.25)" },
              ]}
            />
            </>
          );
        }}
      </Tile>}
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
export function Tile({ title, value, before, color, currency, last, chart, children, onModeChange, mode: controlled }: {
  title: (mode: Mode) => string;
  value: number;
  before: number;
  color: (shown: number) => string;
  currency: string;
  last?: boolean;
  chart: (z: number, shown: number, absolute: boolean) => React.ReactNode;
  children: (mode: Mode) => React.ReactNode;
  onModeChange?: (mode: Mode) => void;
  /** Set by a page that has its own Month / Year switch: the tile follows
   *  it and hides its own. */
  mode?: Mode;
}) {
  const [own, setMode] = useState<Mode>("month");
  const mode = controlled ?? own;
  // The chart: running total (∑) or the amount per day / month (▮).
  const [absolute, setAbsolute] = useState(false);
  const z = useZoom(mode === "month" ? 1 : 0, 950);
  const shown = value + before * (1 - z);
  const c = color(shown);
  const valuesSwitch = (
    <span className="pf-tsl-mode" role="group" aria-label={t("Chart values")}>
      <button type="button" aria-pressed={!absolute} title={t("Running total")} onClick={() => setAbsolute(false)}>∑</button>
      <button type="button" aria-pressed={absolute} title={mode === "month" ? t("Per day") : t("Per month")} onClick={() => setAbsolute(true)}>▮</button>
    </span>
  );
  return (
    <div className="pf-tile" style={{ borderBottom: last ? 0 : "1px solid var(--pf-line)", ["--tile" as string]: c }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div key={title(mode)} className="pf-readout" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78rem", color: "var(--pf-ink-2)" }}>
          <span className="pf-pulse" style={{ background: c, ["--pf-pulse-color" as string]: c }} />
          {title(mode)}
        </div>
        {/* With the page's own Month / Year switch, ∑ / ▮ takes the top-right spot. */}
        {controlled && valuesSwitch}
        {!controlled && <Segmented
          label={`${title("month").split(" ")[0]} period`}
          value={mode}
          onChange={(m) => { setMode(m); onModeChange?.(m); }}
          options={[{ value: "month", label: t("Month") }, { value: "year", label: t("Year") }]}
        />}
      </div>
      {/* The number, with the chart's ∑ / ▮ switch on the same row. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <LiveAmount value={shown} currency={currency} size="2rem" color={c} />
        {!controlled && valuesSwitch}
      </div>
      {chart(z, shown, absolute)}
      <div key={mode} className="pf-readout" style={{ display: "grid", gap: 4 }}>{children(mode)}</div>
    </div>
  );
}

export function Sub({ label, value, suffix, color, currency }: { label: string; value: number; suffix?: string; color: string; currency: string }) {
  return (
    <div style={{ fontSize: "0.68rem", color: "var(--pf-ink-2)", display: "flex", gap: 4 }}>
      {label}
      <span className="pf-rounded" style={{ fontWeight: 600, color, opacity: 0.8 }}>{money(value, currency)}</span>
      {suffix}
    </div>
  );
}

export function Bar({ label, labelColor, parts }: { label: string; labelColor?: string; parts: { share: number; color: string }[] }) {
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
