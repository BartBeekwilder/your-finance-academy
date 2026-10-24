"use client";

import { intlLocale, t } from "@/lib/i18n";
import Segmented from "@/components/finance/Segmented";
import { useState } from "react";
import { useFinance } from "@/components/finance/FinanceProvider";
import type { Mode } from "@/components/finance/LiveTiles";
import NetWorthTile from "@/components/finance/NetWorthTile";
import NetWorthWaterfall from "@/components/finance/NetWorthWaterfall";
import AssetMixChart from "@/components/finance/AssetMixChart";
import Stat from "@/components/finance/Stat";
import { live, netWorthFigures, num } from "@/lib/finance/calc";
import { money, monthYear, monthName } from "@/lib/finance/format";
import { useNow } from "@/lib/motion";

// Net worth — the Income and Expenses pages' sibling: the live net worth
// tile (Month / Year, zoom, forecast, scrub), the period's figures, a
// waterfall of how it moved, the asset mix over time, where it sits (accounts and investments) and,
// in Year view, each month's closing value.

const ASSET_COLORS: Record<string, string> = { crypto: "#F7931A", stock: "#0A84FF", metal: "#D4AF37" };
const ACCOUNT_COLORS = ["#40c8e0", "#30d158", "#5e5ce6", "#64d2ff", "#bf5af2", "#ff9f0a"];

export default function NetWorthPage() {
  const { data, now } = useFinance();
  const currency = data.profile.currency_code;
  const [mode, setMode] = useState<Mode>("month");
  const nw = netWorthFigures(data, now);
  const tick = useNow(1000);
  const nowValue = nw.base + nw.liveChange(tick);
  const monthEnd = nw.base + (nw.forecast[0]?.change ?? 0);
  const yearEnd = nw.base + nw.forecast.reduce((t, f) => t + f.change, 0);
  // A percentage only means something on a solid positive starting point.
  const pct = (from: number, to: number, since: string) =>
    from > 0 && from >= Math.abs(to) * 0.1 ? `${to >= from ? "+" : ""}${(((to - from) / from) * 100).toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% ${since}` : since[0].toUpperCase() + since.slice(1);

  // Where it sits: each account and holding (their starting values, at
  // cost) plus what's been saved this year — together today's net worth.
  const parts = [
    { id: "saved", name: t("Saved this year"), kind: t("Cash flow"), value: nowValue - nw.startOfYear, color: "#30d158" },
    ...live(data.accounts)
      .filter((a) => num(a.balance) !== 0)
      .map((a, i) => ({ id: a.id, name: a.name || t("Account"), kind: t("Account"), value: num(a.balance), color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] })),
    ...live(data.holdings)
      .filter((h) => h.cost_basis && (h.cost_basis_currency ?? currency) === currency)
      .map((h) => ({ id: h.id, name: h.name || h.symbol, kind: t(h.asset_type[0].toUpperCase() + h.asset_type.slice(1)), value: num(h.cost_basis), color: ASSET_COLORS[h.asset_type] ?? "#8e8e93" })),
  ].sort((a, b) => b.value - a.value);
  const partsTotal = parts.reduce((t, p) => t + Math.max(p.value, 0), 0);

  // Closing value of each month this year (finished months as entered).
  const closes = nw.finished.reduce<{ month: Date; change: number; close: number }[]>((acc, change, m) => {
    const prev = acc.length ? acc[acc.length - 1].close : nw.startOfYear;
    return [...acc, { month: new Date(now.getFullYear(), m, 1), change, close: prev + change }];
  }, []);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Net worth")}</h1>
        <Segmented label={t("Period")} value={mode} onChange={setMode} options={[{ value: "month", label: t("Month") }, { value: "year", label: t("Year") }]} />
      </header>

      <NetWorthTile data={data} currency={currency} mode={mode} />

      <div key={mode} className="pf-readout" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Stat label={t("Net worth now")} value={money(nowValue, currency)} color="#40c8e0" hint={t("Saved this year {v1}", { v1: money(nowValue - nw.startOfYear, currency, { signed: true }) })} />
        {mode === "month" ? (
          <>
            <Stat
              label={t("Change this month")}
              value={money(nowValue - nw.base, currency, { signed: true })}
              color={nowValue >= nw.base ? "var(--pf-green)" : "var(--pf-red)"}
              hint={pct(nw.base, nowValue, t("since the 1st"))}
            />
            <Stat label={t("Expected at month end")} value={money(monthEnd, currency)} hint={t("Forecast to the end of {v1}", { v1: monthName(now) })} />
            <Stat label={t("Start of month")} value={money(nw.base, currency)} />
          </>
        ) : (
          <>
            <Stat
              label={t("Change this year")}
              value={money(nowValue - nw.startOfYear, currency, { signed: true })}
              color={nowValue >= nw.startOfYear ? "var(--pf-green)" : "var(--pf-red)"}
              hint={pct(nw.startOfYear, nowValue, t("since 1 January"))}
            />
            <Stat label={t("Expected at year end")} value={money(yearEnd, currency)} hint={t("Forecast to December")} />
            <Stat label={t("Start of year")} value={money(nw.startOfYear, currency)} />
          </>
        )}
      </div>

      <NetWorthWaterfall data={data} now={now} currency={currency} mode={mode} />

      <section>
        <h2 className="pf-section-title">{t("Asset mix over time")}</h2>
        <AssetMixChart data={data} now={now} currency={currency} />
      </section>

      <section>
        <h2 className="pf-section-title">{t("Where it sits")}</h2>
        <div className="pf-card" style={{ padding: 16, display: "grid", gap: 14 }}>
          <div className="pf-nw-split">
            {parts.filter((p) => p.value > 0).map((p, i) => (
              <span key={p.id} title={`${p.name}: ${money(p.value, currency)}`} style={{ flex: p.value, background: p.color, animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {parts.map((p) => (
              <div key={p.id} className="pf-row" style={{ padding: "8px 2px" }}>
                <span className="pf-cbar-swatch" style={{ background: p.color }} />
                <span style={{ flex: 1 }}>
                  {p.name} <span style={{ color: "var(--pf-ink-3)", fontSize: "0.75rem" }}>· {p.kind}</span>
                </span>
                <span className="pf-rounded" style={{ fontWeight: 600 }}>{money(p.value, currency)}</span>
                <span className="pf-rounded" style={{ width: 44, textAlign: "right", color: "var(--pf-ink-3)", fontSize: "0.8rem" }}>
                  {partsTotal ? Math.round((Math.max(p.value, 0) / partsTotal) * 100) : 0}%
                </span>
              </div>
            ))}
            {parts.length === 0 && <div style={{ color: "var(--pf-ink-2)" }}>{t("Add an account balance or an investment to see where your money sits.")}</div>}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>
            {t("Accounts and investments as entered (investments at what you paid — live prices arrive with account sync), plus this year's income minus spending.")}
          </div>
        </div>
      </section>

      {mode === "year" && (
        <section key="by-month" className="pf-readout">
          <h2 className="pf-section-title">{t("By month")}</h2>
          <div className="pf-card">
            {[...closes].reverse().map((c) => (
              <div key={c.month.toISOString()} className="pf-row">
                <span style={{ flex: 1 }}>{monthYear(c.month)}</span>
                <span className="pf-rounded" style={{ fontSize: "0.85rem", color: c.change >= 0 ? "var(--pf-green)" : "var(--pf-red)", width: 110, textAlign: "right" }}>
                  {money(c.change, currency, { signed: true })}
                </span>
                <span className="pf-rounded" style={{ fontWeight: 600, width: 120, textAlign: "right" }}>{money(c.close, currency)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
