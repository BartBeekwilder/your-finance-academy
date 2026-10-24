"use client";

import { monthName } from "@/lib/finance/format";
import { intlLocale, t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { BalanceBars, BalanceTable, balanceColors } from "@/components/finance/BalanceSheet";
import { StackedMix, type Series } from "@/components/finance/AssetMixChart";
import Segmented from "@/components/finance/Segmented";
import { useFinance } from "@/components/finance/FinanceProvider";
import EquityHero from "@/components/finance/EquityHero";
import EquityWaterfall from "@/components/finance/EquityWaterfall";
import SortableTiles from "@/components/finance/SortableTiles";
import StepSlider from "@/components/finance/StepSlider";
import { balanceSheet, netWorthFigures } from "@/lib/finance/calc";

// Balance sheet — the finances as a company's books: what you own (your own
// posts like a home, plus accounts, investments, prepaid costs and income
// still to receive, which are calculated) against what you owe (mortgage,
// loans) and the difference, equity — the headline, with its line over the
// year; the line's dots, or the slider under the bars, pick the month: the current
// month shows today's stand, earlier months their month-end stand. Your own
// posts are edited in place; editing an earlier month changes only that
// month, editing this month also sets the current value. A month with no
// stand of its own carries the latest earlier one forward.

export default function BalancePage() {
  const { data, now, setBalanceValue, renameBalanceItem, deleteBalanceItem, addBalanceItem } = useFinance();
  const currency = data.profile.currency_code;
  const [sel, setSel] = useState(now.getMonth());
  const month = new Date(now.getFullYear(), sel, 1);
  const sheet = balanceSheet(data, now, month);
  const prev = balanceSheet(data, now, new Date(now.getFullYear(), sel - 1, 1));
  const name = monthName(month);
  const label = sheet.isCurrent ? t("today") : t("end of {month}", { month: name });
  const [error, setError] = useState<string | null>(null);
  // Equity at the end of each month so far (today for this month).
  // Memoised: each sheet walks every transaction, and the slider re-renders often.
  const points = useMemo(
    () =>
      Array.from({ length: now.getMonth() + 1 }, (_, i) => {
        const d = new Date(now.getFullYear(), i, 1);
        const n = monthName(d);
        return { label: n.slice(0, 3), full: i === now.getMonth() ? t("Today") : t("End of {n}", { n }), value: balanceSheet(data, now, d).equity };
      }).concat(
        // Forecast to December: each later month-end's sheet (posts carried
        // forward, mortgages on their schedule) plus the cash the forecast
        // expects to be added from this month up to that month.
        (() => {
          const fc = netWorthFigures(data, now).forecast;
          const out: { label: string; full: string; value: number; forecast: boolean }[] = [];
          for (let m = now.getMonth() + 1; m < 12; m++) {
            const d = new Date(now.getFullYear(), m, 1);
            const n = monthName(d);
            const added = fc.filter((f) => f.month <= m).reduce((a, f) => a + f.change, 0);
            out.push({ label: n.slice(0, 3), full: t("End of {n} · forecast", { n }), value: balanceSheet(data, now, d).equity + added, forecast: true });
          }
          return out;
        })(),
      ),
    [data, now],
  );
  const yearStart = useMemo(() => balanceSheet(data, now, new Date(now.getFullYear() - 1, 11, 1)).equity, [data, now]);
  // 2D view: each post through the year, one side at a time. Clicking a
  // segment in the bars picks it (and switches to its side).
  const [side, setSide] = useState<"assets" | "funding">("assets");
  const [picked, setPicked] = useState<string | null>(null);
  const colors = balanceColors(sheet);
  const mix = useMemo(() => {
    const map = new Map<string, Series>();
    const months = now.getMonth() + 1;
    for (let m = 0; m < months; m++) {
      const sh = balanceSheet(data, now, new Date(now.getFullYear(), m, 1));
      const lines = side === "assets" ? sh.assets : [...sh.liabilities, { id: "equity", name: t("Equity"), value: sh.equity }];
      for (const l of lines) {
        if (!map.has(l.id)) map.set(l.id, { id: l.id, name: l.name, color: "", values: new Array(months).fill(0) });
        map.get(l.id)!.values[m] = Math.max(l.value, 0);
      }
    }
    const list = [...map.values()].filter((s) => s.values.some((v) => v > 0.005));
    // Equity at the bottom of its side; the rest largest first.
    list.sort((a, b) => (a.id === "equity" ? -1 : b.id === "equity" ? 1 : b.values[months - 1] - a.values[months - 1]));
    return list;
  }, [data, now, side]);
  const spare = ["#8e8e93", "#66d4cf", "#ffd60a", "#ff9f0a", "#bf5af2", "#64d2ff"];
  const mixSeries = mix.map((s, i) => ({ ...s, color: colors.get(s.id) ?? spare[i % spare.length] }));
  const pick = (id: string, s: "assets" | "funding") => {
    setSide(s);
    setPicked((p) => (p === id ? null : id));
  };
  const run = (p: Promise<void>) => p.then(() => setError(null)).catch((e: Error) => setError(e.message));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Balance sheet")}</h1>
        <span style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>
          {name} {now.getFullYear()} · {sheet.isCurrent ? t("current stand") : t("month-end stand")}
        </span>
      </header>

      <SortableTiles
        storageKey="pf-balance-tiles"
        tiles={[
          { id: "equity", label: t("Equity"), node: <EquityHero points={points} sel={sel} onSelect={setSel} totalAssets={sheet.totalAssets} label={label} currency={currency} /> },
          {
            id: "bars",
            label: t("Balance bars"),
            node: (
              <section className="pf-card" style={{ padding: 18, display: "grid", gap: 16 }}>
                {/* No key per month: the segments stay and glide to the
                    new month's widths instead of being rebuilt. */}
                <BalanceBars sheet={sheet} prev={prev} currency={currency} header={false} legend={false} picked={picked} onPick={pick} />
                <StepSlider
                  label={t("Month")}
                  animKey="balance-months"
                  value={sel}
                  steps={Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(now.getFullYear(), i, 1);
                    const n = monthName(d);
                    return { label: n.slice(0, 3), short: n[0], full: `${n} ${now.getFullYear()}`, disabled: i > now.getMonth() };
                  })}
                  onChange={setSel}
                />
              </section>
            ),
          },
          {
            id: "over-time",
            label: t("Balance over time"),
            node: (
              <section style={{ display: "grid", gap: 8 }}>
                <h2 className="pf-section-title">{t("Balance over time")}</h2>
                <StackedMix
                  key={side}
                  series={mixSeries}
                  now={now}
                  currency={currency}
                  lit={picked}
                  onLit={setPicked}
                  lowerIsBetter={(id) => side === "funding" && id !== "equity"}
                  extra={
                    <Segmented
                      size="sm"
                      label={t("Side")}
                      value={side}
                      onChange={(v) => { setSide(v); setPicked(null); }}
                      options={[{ value: "assets", label: t("Assets") }, { value: "funding", label: t("Debt + equity") }]}
                    />
                  }
                  note={t("Click a bar above or a band here to follow one post through the year.")}
                />
              </section>
            ),
          },
          {
            id: "table",
            label: t("Balance table"),
            node: (
              <section className="pf-card" style={{ padding: "18px 34px 18px 18px" }}>
                <BalanceTable
                  key={sel}
                  sheet={sheet}
                  prev={prev}
                  currency={currency}
                  edit={{
                    onValue: (id, v) => run(setBalanceValue(id, month, v)),
                    onRename: (id, n) => run(renameBalanceItem(id, n)),
                    onDelete: (id) => {
                      const line = [...sheet.assets, ...sheet.liabilities].find((l) => l.id === id);
                      if (confirm(t("Remove “{v1}” from the balance sheet, including its history?", { v1: line?.name ?? "" }))) run(deleteBalanceItem(id));
                    },
                    onAdd: (side) => run(addBalanceItem({ name: t("New post"), side, value: 0 })),
                  }}
                />
                {error && <p style={{ color: "var(--pf-red)", fontSize: "0.8rem", marginTop: 10 }}>{error}</p>}
              </section>
            ),
          },
          {
            id: "waterfall",
            label: t("Equity waterfall"),
            node: (
              <EquityWaterfall
                sheet={sheet}
                prev={prev}
                months={{ start: yearStart, points }}
                sel={sel}
                currency={currency}
              />
            ),
          },
        ]}
      />

      <p style={{ fontSize: "0.75rem", color: "var(--pf-ink-3)", lineHeight: 1.5, maxWidth: 720 }}>
        {t("Posts marked auto follow from your accounts, transactions and holdings. Accounts: balances on 1 January plus what each month added. Investments: holdings at cost. In the current month, Prepaid is the part of this month's fixed costs that covers the days ahead, and Receivable the income earned so far that hasn't come in yet. Your own posts: this month's value is the current stand; earlier months keep their own month-end value.")}
      </p>
    </div>
  );
}
