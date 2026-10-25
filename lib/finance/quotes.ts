// Market values of holdings — pure functions over quotes from /api/quotes,
// no imports beyond types, so they can be tested with plain node and ported.
//
//   Nominal ("nominaal") — what you paid: the cost basis.
//   Real    ("reëel")    — what it's worth now: quantity × price, in the
//                          profile currency (converted with the FX quote).

import type { FinanceData, Holding } from "./types";

export type Quote = {
  symbol: string;
  name: string | null;
  currency: string;
  price: number;
  previousClose: number | null;
  time: number;
  open: boolean;
  exchange: string | null;
  high52: number | null;
  low52: number | null;
  points: [number, number][];
};
export type Quotes = Record<string, Quote | null>;

const METALS: Record<string, string> = { XAU: "GC=F", XAG: "SI=F", XPT: "PL=F", XPD: "PA=F" };

/** The market symbol for a holding: stocks as they are, crypto against the
 *  profile currency (BTC-EUR), metals as their futures (USD per troy ounce). */
export function quoteSymbol(h: Pick<Holding, "symbol" | "asset_type">, currency: string) {
  const s = h.symbol.trim().toUpperCase();
  if (h.asset_type === "crypto") return `${s}-${currency}`;
  if (h.asset_type === "metal") return METALS[s] ?? s;
  return s;
}

/** FX quote giving `from` per one `to` (EURUSD=X = dollars per euro). */
export const fxSymbol = (from: string, to: string) => `${to}${from}=X`;

/** The symbols to ask /api/quotes for: every holding plus the FX it needs. */
export function symbolsFor(holdings: Pick<Holding, "symbol" | "asset_type">[], currency: string, quotes: Quotes = {}) {
  const out = new Set(holdings.map((h) => quoteSymbol(h, currency)));
  for (const s of [...out]) {
    const c = quotes[s]?.currency;
    if (c && c !== currency) out.add(fxSymbol(c, currency));
  }
  // Holdings priced in dollars are the common case: ask for that rate up front.
  if (currency !== "USD" && holdings.some((h) => h.asset_type !== "crypto")) out.add(fxSymbol("USD", currency));
  return [...out].sort();
}

/** The close at time t: the last point at or before t, else the first one. */
export function priceAt(points: [number, number][], t: number) {
  if (!points.length) return null;
  let v = points[0][1];
  for (const [pt, c] of points) {
    if (pt > t) break;
    v = c;
  }
  return v;
}

/** Converts an amount in `from` to `to` at time t (null = rate missing). */
export function convert(amount: number, from: string, to: string, quotes: Quotes, t?: number) {
  if (from === to) return amount;
  // Pence: London quotes in GBp.
  if (from === "GBp") return convert(amount / 100, "GBP", to, quotes, t);
  const fx = quotes[fxSymbol(from, to)];
  if (!fx) return null;
  const rate = t == null ? fx.price : (priceAt(fx.points, t) ?? fx.price);
  return rate ? amount / rate : null;
}

export type HoldingValue = {
  holding: Holding;
  quote: Quote | null;
  /** Price per unit in the quote's own currency. */
  price: number | null;
  /** Real: worth now in the profile currency (null = no quote yet). */
  value: number | null;
  /** Nominal: cost basis in the profile currency. */
  cost: number | null;
  /** value − cost, and as a share of cost. */
  result: number | null;
  resultPct: number | null;
  /** Since the previous close, in the profile currency. */
  day: number | null;
  dayPct: number | null;
};

export function holdingValue(h: Holding, quotes: Quotes, currency: string): HoldingValue {
  const quote = quotes[quoteSymbol(h, currency)] ?? null;
  const qty = Number(h.quantity) || 0;
  const cost = h.cost_basis == null ? null : convert(Number(h.cost_basis), h.cost_basis_currency ?? currency, currency, quotes);
  const value = quote ? convert(qty * quote.price, quote.currency, currency, quotes) : null;
  const prev = quote?.previousClose != null ? convert(qty * quote.previousClose, quote.currency, currency, quotes) : null;
  const result = value != null && cost != null ? value - cost : null;
  return {
    holding: h,
    quote,
    price: quote?.price ?? null,
    value,
    cost,
    result,
    resultPct: result != null && cost ? result / cost : null,
    day: value != null && prev != null ? value - prev : null,
    dayPct: value != null && prev ? (value - prev) / prev : null,
  };
}

/** One holding's real value over its quote's points (profile currency). */
export function holdingSeries(h: Holding, quotes: Quotes, currency: string) {
  const q = quotes[quoteSymbol(h, currency)];
  if (!q) return [];
  const qty = Number(h.quantity) || 0;
  return q.points
    .map(([t, c]) => [t, convert(qty * c, q.currency, currency, quotes, t)] as const)
    .filter((p): p is readonly [number, number] => p[1] != null)
    .map(([t, v]) => ({ t, value: v }));
}

/** The portfolio over time: at every moment any quote moved, the real value
 *  of what was held then (bought on or before that day), and what had been
 *  put in (nominal). Holdings without a quote count at cost. */
export function portfolioSeries(holdings: Holding[], quotes: Quotes, currency: string) {
  const own = holdings.map((h) => ({ h, q: quotes[quoteSymbol(h, currency)] ?? null, from: Date.parse(h.date_added) || 0 }));
  const times = new Set<number>();
  for (const { q } of own) for (const [t] of q?.points ?? []) times.add(t);
  return [...times]
    .sort((a, b) => a - b)
    .map((t) => {
      let value = 0, cost = 0;
      for (const { h, q, from } of own) {
        if (from > t) continue;
        const c = h.cost_basis == null ? 0 : (convert(Number(h.cost_basis), h.cost_basis_currency ?? currency, currency, quotes, t) ?? 0);
        cost += c;
        const p = q ? priceAt(q.points, t) : null;
        const v = q && p != null ? convert((Number(h.quantity) || 0) * p, q.currency, currency, quotes, t) : null;
        value += v ?? c;
      }
      return { t, value, cost };
    });
}

/** Investments at their market value at `at` (real), from the live quotes in
 *  data.market: the value at the last price on or before that moment (before
 *  the history starts, its first price). A holding without quotes counts at
 *  cost. `real` = at least one holding is at market value. Like the cost
 *  model, every holding counts for the whole year (its money is in the
 *  year's starting point, not taken out of Accounts when bought). */
export function investmentsValue(data: Pick<FinanceData, "holdings" | "market" | "profile">, at: Date) {
  const t = at.getTime();
  const currency = data.profile.currency_code;
  let total = 0, real = false;
  for (const h of data.holdings) {
    if (h.deleted_at) continue;
    const pts = data.market?.[h.id];
    if (pts?.length) {
      let v = pts[0][1];
      for (const [pt, val] of pts) {
        if (pt > t) break;
        v = val;
      }
      total += v;
      real = true;
    } else if (h.cost_basis && (h.cost_basis_currency ?? currency) === currency) total += Number(h.cost_basis);
  }
  return { total, real };
}
