"use client";

import { useEffect, useMemo, useState } from "react";
import { holdingSeries, holdingValue, symbolsFor, type Quotes } from "./quotes";
import type { FinanceData } from "./types";

// Live market values for the balance sheet (FinanceProvider puts them in
// data.market): a year of daily closes per holding, refreshed every
// 10 minutes, plus today's price every minute as the latest point.

async function load(symbols: string[], range: "1d" | "1y"): Promise<Quotes | null> {
  if (!symbols.length) return null;
  try {
    const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}&range=${range}`);
    return r.ok ? ((await r.json()).quotes as Quotes) : null;
  } catch {
    return null;
  }
}

export function useMarket(data: FinanceData | null) {
  const currency = data?.profile.currency_code ?? "EUR";
  const holdings = useMemo(() => (data?.holdings ?? []).filter((h) => !h.deleted_at), [data?.holdings]);
  const key = holdings.map((h) => `${h.id}:${h.symbol}:${h.asset_type}`).join("|");
  const [year, setYear] = useState<Quotes | null>(null);
  const [day, setDay] = useState<Quotes | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const run = async (range: "1d" | "1y", set: (q: Quotes) => void) => {
      let q = await load(symbolsFor(holdings, currency), range);
      // Holdings priced in a currency not asked for yet: fetch with its rate.
      const more = q ? symbolsFor(holdings, currency, q) : [];
      if (q && more.some((s) => !(s in q!))) q = (await load(more, range)) ?? q;
      if (alive && q) set(q);
    };
    run("1y", setYear);
    run("1d", setDay);
    const a = setInterval(() => document.visibilityState === "visible" && run("1y", setYear), 600_000);
    const b = setInterval(() => document.visibilityState === "visible" && run("1d", setDay), 60_000);
    return () => {
      alive = false;
      clearInterval(a);
      clearInterval(b);
    };
    // holdings/currency are captured through `key` and currency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, currency]);

  return useMemo(() => {
    if (!year && !day) return undefined;
    const now = Date.now();
    const out: Record<string, [number, number][]> = {};
    for (const h of holdings) {
      const pts: [number, number][] = year ? holdingSeries(h, year, currency).map((p) => [p.t, p.value]) : [];
      const live = day ? holdingValue(h, day, currency).value : null;
      if (live != null) pts.push([Math.max(now, pts.length ? pts[pts.length - 1][0] + 1 : now), live]);
      if (pts.length) out[h.id] = pts;
    }
    return out;
  }, [year, day, holdings, currency]);
}
