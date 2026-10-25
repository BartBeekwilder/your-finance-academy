// Market prices for the Investments page: Yahoo Finance's public chart API
// (no key), fetched server side because it doesn't allow browser requests.
// Only ticker symbols go out — never anything about the user. Responses are
// cached briefly so a page full of viewers doesn't hammer the source.
//
//   GET /api/quotes?symbols=NVDA,BTC-EUR,EURUSD=X&range=1mo
//   → { quotes: { [symbol]: Quote | null } }

export const dynamic = "force-dynamic";

const RANGES: Record<string, { range: string; interval: string; ttl: number }> = {
  "1d": { range: "1d", interval: "5m", ttl: 30 },
  "5d": { range: "5d", interval: "30m", ttl: 120 },
  "1mo": { range: "1mo", interval: "1d", ttl: 600 },
  "1y": { range: "1y", interval: "1d", ttl: 3600 },
  "5y": { range: "5y", interval: "1wk", ttl: 3600 },
};
// Tickers, crypto pairs (BTC-EUR), futures (GC=F), FX (EURUSD=X), indices (^GSPC).
const SYMBOL = /^[A-Z0-9^][A-Z0-9.\-=^]{0,19}$/;

export type Quote = {
  symbol: string;
  name: string | null;
  currency: string;
  price: number;
  previousClose: number | null;
  /** Unix ms of the last price. */
  time: number;
  /** Regular session open right now (crypto: always). */
  open: boolean;
  exchange: string | null;
  high52: number | null;
  low52: number | null;
  /** [unix ms, close] over the range. */
  points: [number, number][];
};

type YahooMeta = {
  currency?: string; symbol?: string; longName?: string; shortName?: string; regularMarketPrice?: number;
  chartPreviousClose?: number; previousClose?: number; regularMarketTime?: number; instrumentType?: string;
  fullExchangeName?: string; fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number;
  currentTradingPeriod?: { regular?: { start: number; end: number } };
};

async function one(symbol: string, cfg: (typeof RANGES)[string]): Promise<Quote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`;
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, next: { revalidate: cfg.ttl } });
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    const m: YahooMeta | undefined = res?.meta;
    if (!m || typeof m.regularMarketPrice !== "number") return null;
    const ts: number[] = res.timestamp ?? [];
    const closes: (number | null)[] = res.indicators?.quote?.[0]?.close ?? [];
    const points: [number, number][] = [];
    ts.forEach((t, i) => {
      const c = closes[i];
      if (typeof c === "number" && Number.isFinite(c)) points.push([t * 1000, c]);
    });
    const time = (m.regularMarketTime ?? Date.now() / 1000) * 1000;
    // The live price is the last point, so the chart ends where the number is.
    if (!points.length || points[points.length - 1][0] < time) points.push([time, m.regularMarketPrice]);
    const p = m.currentTradingPeriod?.regular;
    const now = Date.now() / 1000;
    const crypto = m.instrumentType === "CRYPTOCURRENCY" || m.instrumentType === "CURRENCY";
    return {
      symbol,
      name: m.longName ?? m.shortName ?? null,
      currency: m.currency ?? "USD",
      price: m.regularMarketPrice,
      previousClose: m.previousClose ?? m.chartPreviousClose ?? null,
      time,
      open: crypto || (!!p && now >= p.start && now < p.end),
      exchange: m.fullExchangeName ?? null,
      high52: m.fiftyTwoWeekHigh ?? null,
      low52: m.fiftyTwoWeekLow ?? null,
      points,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const cfg = RANGES[q.get("range") ?? "1d"];
  const symbols = [...new Set((q.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()))].filter((s) => SYMBOL.test(s)).slice(0, 40);
  if (!cfg || !symbols.length) return Response.json({ error: "Give symbols and a range (1d, 5d, 1mo, 1y, 5y)." }, { status: 400 });
  const list = await Promise.all(symbols.map((s) => one(s, cfg)));
  return Response.json(
    { quotes: Object.fromEntries(symbols.map((s, i) => [s, list[i]])) },
    { headers: { "cache-control": `public, max-age=${Math.min(cfg.ttl, 60)}` } },
  );
}
