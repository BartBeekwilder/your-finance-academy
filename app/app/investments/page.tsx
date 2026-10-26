"use client";

import { t as tr } from "@/lib/i18n";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinance } from "@/components/finance/FinanceProvider";
import { HoldingDetail, HoldingRow, PortfolioHero, useQuotes, type Range } from "@/components/finance/Portfolio";
import Sheet from "@/components/finance/Sheet";
import PortfolioMix from "@/components/finance/PortfolioMix";
import { live } from "@/lib/finance/calc";
import { holdingValue, portfolioSeries, symbolsFor } from "@/lib/finance/quotes";

// Investments: every holding at its live market price (real value) against
// what was paid for it (nominal), in green or red. On top the portfolio's
// real value, ticking live, with its line over a chosen period and the
// nominal line dashed beneath it. A row opens its own chart and details.
// Prices: /api/quotes (Yahoo Finance) — today's every 30 s while the page is
// visible, the chosen period's history every 5 minutes.

export default function InvestmentsPage() {
  const { data } = useFinance();
  const currency = data.profile.currency_code;
  const holdings = useMemo(() => live(data.holdings), [data.holdings]);
  const [range, setRange] = useState<Range>("1d");
  const [open, setOpen] = useState<{ id: string | null; show: boolean; from: Element | null }>({ id: null, show: false, from: null });

  // Ask once for the holdings (+ the dollar rate); once the quotes say which
  // currencies they're in, any other rate needed is added.
  const first = useQuotes(symbolsFor(holdings, currency), "1d", 30_000);
  const symbols = symbolsFor(holdings, currency, first?.quotes);
  const today = useQuotes(symbols, "1d", 30_000) ?? first;
  const period = useQuotes(symbols, range, range === "1d" ? 0 : 300_000);
  const rangeQuotes = range === "1d" ? (today?.quotes ?? null) : (period?.quotes ?? null);

  const values = useMemo(() => holdings.map((h) => holdingValue(h, today?.quotes ?? {}, currency)), [holdings, today, currency]);
  // Biggest real value first.
  const sorted = [...values].sort((a, b) => (b.value ?? b.cost ?? 0) - (a.value ?? a.cost ?? 0));
  // 1D is the last 24 hours: crypto trades all weekend while a stock's
  // "1d" is its last session, so mixing them would leave a flat gap.
  const series = useMemo(() => {
    // From the first moment something was held.
    const all = (rangeQuotes ? portfolioSeries(holdings, rangeQuotes, currency) : []).filter((p) => p.cost > 0 || p.value > 0);
    if (range !== "1d" || !all.length) return all;
    const from = all[all.length - 1].t - 86_400_000;
    return all.filter((p) => p.t >= from);
  }, [holdings, rangeQuotes, currency, range]);
  const anyOpen = values.some((v) => v.quote?.open);
  const current = values.find((v) => v.holding.id === open.id);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{tr("Investments")}</h1>

      <PortfolioHero values={values} series={series} currency={currency} range={range} onRange={setRange} open={anyOpen} at={today?.at ?? null} />

      <section>
        <h2 className="pf-section-title">{tr("Holdings")}</h2>
        <div className="pf-card">
          {sorted.map((v) => (
            <HoldingRow key={v.holding.id} v={v} currency={currency} rangeQuotes={rangeQuotes} range={range} onOpen={(from) => setOpen({ id: v.holding.id, show: true, from })} />
          ))}
        </div>
      </section>

      {rangeQuotes && holdings.length > 1 && <PortfolioMix holdings={holdings} quotes={rangeQuotes} currency={currency} range={range} onRange={setRange} />}

      <Sheet open={open.show} onClose={() => setOpen((o) => ({ ...o, show: false }))} origin={open.from} label={tr("Holding details")}>
        {current && (
          <div style={{ position: "relative" }}>
            <button type="button" className="pf-icon-button" aria-label={tr("Close")} onClick={() => setOpen((o) => ({ ...o, show: false }))} style={{ position: "absolute", top: -4, right: -4 }}>
              <X size={16} />
            </button>
            <HoldingDetail key={current.holding.id} v={current} currency={currency} rangeQuotes={rangeQuotes} range={range} onRange={setRange} />
          </div>
        )}
      </Sheet>
    </div>
  );
}
