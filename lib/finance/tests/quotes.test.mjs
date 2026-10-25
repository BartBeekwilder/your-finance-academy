// Holding values from quotes. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, holdingValue, investmentsValue, portfolioSeries, quoteSymbol, symbolsFor } from "../quotes.ts";

const q = (symbol, currency, price, previousClose, points) => ({ symbol, name: null, currency, price, previousClose, time: 0, open: true, exchange: null, high52: null, low52: null, points });
const quotes = {
  NVDA: q("NVDA", "USD", 220, 200, [[1000, 200], [2000, 220]]),
  "BTC-EUR": q("BTC-EUR", "EUR", 72000, 70000, [[1000, 70000], [2000, 72000]]),
  "EURUSD=X": q("EURUSD=X", "USD", 1.1, 1.1, [[1000, 1.0], [2000, 1.1]]),
};
const cents = (x) => Math.round(x * 100);
const h = (symbol, asset_type, quantity, cost, date = "1970-01-01T00:00:00Z") => ({ id: symbol, updated_at: "", deleted_at: null, symbol, name: symbol, asset_type, quantity: String(quantity), cost_basis: String(cost), cost_basis_currency: null, date_added: date });

test("symbols: crypto against the currency, metals as futures, plus the dollar rate", () => {
  assert.equal(quoteSymbol({ symbol: "btc", asset_type: "crypto" }, "EUR"), "BTC-EUR");
  assert.equal(quoteSymbol({ symbol: "XAU", asset_type: "metal" }, "EUR"), "GC=F");
  assert.deepEqual(symbolsFor([{ symbol: "NVDA", asset_type: "stock" }], "EUR"), ["EURUSD=X", "NVDA"]);
});

test("dollars to euros with the EURUSD rate", () => {
  assert.equal(cents(convert(110, "USD", "EUR", quotes)), 10000);
  assert.equal(convert(100, "USD", "EUR", quotes, 1000), 100);
});

test("real vs nominal per holding, with the day change", () => {
  const v = holdingValue(h("NVDA", "stock", 1, 150), quotes, "EUR");
  assert.equal(cents(v.value), 20000);
  assert.equal(cents(v.result), 5000);
  assert.equal(Math.round(v.resultPct * 1000), 333);
  assert.equal(Math.round(v.day * 100), Math.round((200 - 200 / 1.1) * 100));
  const b = holdingValue(h("BTC", "crypto", 0.5, 40000), quotes, "EUR");
  assert.equal(b.value, 36000);
  assert.equal(b.result, -4000);
  assert.equal(b.resultPct, -0.1);
});

test("portfolio over time only counts what was held then", () => {
  const s = portfolioSeries([h("NVDA", "stock", 1, 150), h("BTC", "crypto", 0.5, 40000, new Date(1500).toISOString())], quotes, "EUR");
  assert.deepEqual(s.map((p) => p.t), [1000, 2000]);
  assert.equal(s[0].value, 200); // NVDA only: 200 USD at 1.0
  assert.equal(s[0].cost, 150);
  assert.equal(s[1].value, 200 + 36000);
  assert.equal(s[1].cost, 40150);
});

test("balance sheet: investments at market value, at cost without quotes", async () => {
  const data = { profile: { currency_code: "EUR" }, holdings: [h("NVDA", "stock", 1, 150), h("GOLD", "metal", 1, 100)], market: { NVDA: [[1000, 180], [2000, 200]] } };
  assert.deepEqual(investmentsValue(data, new Date(1500)), { total: 280, real: true });
  assert.deepEqual(investmentsValue(data, new Date(5000)), { total: 300, real: true });
  assert.deepEqual(investmentsValue(data, new Date(10)), { total: 280, real: true });
  assert.deepEqual(investmentsValue({ ...data, market: undefined }, new Date(5000)), { total: 250, real: false });
});
