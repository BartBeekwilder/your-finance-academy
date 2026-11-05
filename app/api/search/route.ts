// Finding an investment by name or ticker (onboarding, Investments): Yahoo
// Finance's public search, fetched server side like /api/quotes. Only the
// typed search text goes out — never anything about the user.
//
//   GET /api/search?q=apple
//   → { results: [{ symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "stock" }, …] }
//
// A result's `symbol` is what a holding stores: a ticker for shares and
// funds, the coin (BTC) for crypto — quoteSymbol adds the currency — and
// XAU/XAG/XPT/XPD for metals.

export const dynamic = "force-dynamic";

export type SearchResult = { symbol: string; name: string; exchange: string | null; type: "stock" | "crypto" | "metal"; kind: string };

const METALS: Record<string, { symbol: string; name: string }> = {
  "GC=F": { symbol: "XAU", name: "Gold" },
  "SI=F": { symbol: "XAG", name: "Silver" },
  "PL=F": { symbol: "XPT", name: "Platinum" },
  "PA=F": { symbol: "XPD", name: "Palladium" },
};
const KINDS: Record<string, string> = { EQUITY: "Stock", ETF: "Fund", MUTUALFUND: "Fund", CRYPTOCURRENCY: "Crypto", FUTURE: "Metal" };

type YahooQuote = { symbol?: string; shortname?: string; longname?: string; exchDisp?: string; quoteType?: string };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 40) ?? "";
  if (q.length < 1) return Response.json({ results: [] });
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=true`;
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, next: { revalidate: 3600 } });
    if (!r.ok) return Response.json({ results: [] });
    const j = await r.json();
    const seen = new Set<string>();
    const results: SearchResult[] = [];
    for (const x of (j?.quotes ?? []) as YahooQuote[]) {
      if (!x.symbol || !x.quoteType) continue;
      let out: SearchResult | null = null;
      if (x.quoteType === "CRYPTOCURRENCY") {
        // BTC-USD, BTC-EUR… → one result per coin.
        const coin = x.symbol.split("-")[0];
        out = { symbol: coin, name: (x.shortname ?? x.longname ?? coin).replace(/\s+[A-Z]{3}$/, ""), exchange: null, type: "crypto", kind: KINDS.CRYPTOCURRENCY };
      } else if (x.quoteType === "FUTURE") {
        const m = METALS[x.symbol];
        if (m) out = { symbol: m.symbol, name: m.name, exchange: null, type: "metal", kind: KINDS.FUTURE };
      } else if (KINDS[x.quoteType]) {
        out = { symbol: x.symbol, name: x.longname ?? x.shortname ?? x.symbol, exchange: x.exchDisp ?? null, type: "stock", kind: KINDS[x.quoteType] };
      }
      if (!out || seen.has(`${out.type}:${out.symbol}`)) continue;
      seen.add(`${out.type}:${out.symbol}`);
      results.push(out);
      if (results.length >= 6) break;
    }
    // Typed a metal's name: offer it even when the search leaves it out.
    const low = q.toLowerCase();
    for (const m of Object.values(METALS)) {
      const names = { XAU: ["gold", "goud", "xau"], XAG: ["silver", "zilver", "xag"], XPT: ["platinum", "platina", "xpt"], XPD: ["palladium", "xpd"] }[m.symbol]!;
      if (names.some((n) => n.startsWith(low) || low.startsWith(n)) && !seen.has(`metal:${m.symbol}`)) results.unshift({ symbol: m.symbol, name: m.name, exchange: null, type: "metal", kind: KINDS.FUTURE });
    }
    return Response.json({ results: results.slice(0, 6) });
  } catch {
    return Response.json({ results: [] });
  }
}
