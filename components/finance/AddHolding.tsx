"use client";

import { t } from "@/lib/i18n";
import { ArrowLeft, Check, PenLine, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResult } from "@/app/api/search/route";
import { live } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import { holdingSeries, holdingValue, symbolsFor } from "@/lib/finance/quotes";
import type { AssetType, Holding } from "@/lib/finance/types";
import { useFinance } from "./FinanceProvider";
import { label, logo, useSearch } from "./InvestmentSearch";
import LiveAmount from "./LiveAmount";
import { AssetIcon, PriceChart, RANGES, TYPE, useQuotes, type Range } from "./Portfolio";
import Segmented from "./Segmented";
import Sheet from "./Sheet";

// Adding an investment (the + on the Investments page): a large panel.
// Left, find it — search by name or ticker, or tap a popular one — and see
// its live price and chart; then say how many you have (or how much money
// is in it), what you paid (in total or per share / coin / ounce) and when
// you bought it. Right, live, what that holding is worth now, the result,
// and its share of your portfolio once added. Not listed (a pension, a
// private fund)? Add it by hand at what it's worth today.

const POPULAR: SearchResult[] = [
  { symbol: "BTC", name: "Bitcoin", exchange: null, type: "crypto", kind: "Crypto" },
  { symbol: "ETH", name: "Ethereum", exchange: null, type: "crypto", kind: "Crypto" },
  { symbol: "XAU", name: "Gold", exchange: null, type: "metal", kind: "Metal" },
  { symbol: "XAG", name: "Silver", exchange: null, type: "metal", kind: "Metal" },
  { symbol: "VWRL.AS", name: "Vanguard FTSE All-World UCITS ETF", exchange: "Amsterdam", type: "stock", kind: "Fund" },
  { symbol: "IWDA.AS", name: "iShares Core MSCI World UCITS ETF", exchange: "Amsterdam", type: "stock", kind: "Fund" },
  { symbol: "ASML.AS", name: "ASML Holding", exchange: "Amsterdam", type: "stock", kind: "Stock" },
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "stock", kind: "Stock" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", type: "stock", kind: "Stock" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", type: "stock", kind: "Stock" },
];

const parse = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function AddHolding() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Element | null>(null);
  const [session, setSession] = useState(0);
  useEffect(() => {
    const go = (e: Event) => {
      setFrom((e as CustomEvent<Element | null>).detail ?? null);
      setSession((n) => n + 1);
      setOpen(true);
    };
    window.addEventListener("pf-add-holding", go);
    return () => window.removeEventListener("pf-add-holding", go);
  }, []);
  return (
    <Sheet wide open={open} onClose={() => setOpen(false)} origin={from} focus=".pf-ah-search input" label={t("Add investment")}>
      <Form key={session} onDone={() => setOpen(false)} />
    </Sheet>
  );
}

function Form({ onDone }: { onDone: () => void }) {
  const { data, addHolding } = useFinance();
  const currency = data.profile.currency_code;
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [manual, setManual] = useState(false);
  // How much: a number of shares / coins, or an amount of money in it.
  const [by, setBy] = useState<"units" | "money">("units");
  const [units, setUnits] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [paidEach, setPaidEach] = useState(false);
  const [date, setDate] = useState(todayIso);
  const [range, setRange] = useState<Range>("1mo");
  // By hand.
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AssetType>("stock");
  const [worth, setWorth] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { results, loading } = useSearch(q);
  const qtyRef = useRef<HTMLInputElement>(null);

  const holdings = useMemo(() => live(data.holdings), [data.holdings]);
  const draft = (qty: number): Holding => ({
    id: "new", symbol: picked?.symbol ?? "", name: picked ? label(picked) : name, asset_type: picked?.type ?? kind,
    quantity: String(qty), cost_basis: null, cost_basis_currency: currency, date_added: `${date}T12:00:00.000Z`, updated_at: "", deleted_at: null,
  } as Holding);
  const one = draft(1);
  const symbols = symbolsFor([...holdings, ...(picked ? [one] : [])], currency);
  const today = useQuotes(symbols, "1d", 30_000);
  const period = useQuotes(picked ? symbolsFor([one], currency) : [], range, range === "1d" ? 30_000 : 300_000);
  const quotes = today?.quotes ?? {};
  const unit = picked ? holdingValue(one, quotes, currency) : null;
  const price = unit?.value ?? null; // one share / coin / ounce, in the profile currency
  const qty = by === "units" ? parse(units) : price ? parse(amount) / price : 0;
  const now = picked ? (price != null ? price * qty : null) : parse(worth);
  const paidTotal = paidEach ? parse(paid) * qty : parse(paid);
  const cost = paidTotal > 0 ? paidTotal : now ?? 0;
  const result = now != null && paidTotal > 0 ? now - paidTotal : null;
  const portfolio = holdings.reduce((s, h) => { const v = holdingValue(h, quotes, currency); return s + (v.value ?? v.cost ?? 0); }, 0);
  const share = now && now > 0 ? now / (portfolio + now) : null;
  const series = useMemo(() => {
    if (!picked || !period?.quotes) return [];
    const all = holdingSeries(one, period.quotes, currency);
    return range === "1d" && all.length ? all.filter((p) => p.t >= all[all.length - 1].t - 86_400_000) : all;
  }, [picked, period, currency, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const unitWord = picked?.type === "crypto" ? t("Per coin") : picked?.type === "metal" ? t("Per ounce") : t("Per share");
  const ready = picked ? qty > 0 : name.trim() !== "" && parse(worth) > 0;

  const pick = (r: SearchResult) => {
    setPicked(r);
    setQ("");
    requestAnimationFrame(() => qtyRef.current?.focus());
  };
  const list = q.trim() ? results : POPULAR;

  async function save() {
    if (!ready) return;
    setSaving(true);
    setError("");
    try {
      if (picked) {
        await addHolding({ symbol: picked.symbol, name: label(picked), asset_type: picked.type, quantity: String(+qty.toFixed(8)), cost_basis: cost > 0 ? cost.toFixed(2) : null, cost_basis_currency: currency, date_added: `${date}T12:00:00.000Z` });
      } else {
        await addHolding({ symbol: "", name: name.trim(), asset_type: kind, quantity: "1", cost_basis: parse(worth).toFixed(2), cost_basis_currency: currency, date_added: `${date}T12:00:00.000Z` });
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="pf-ah">
      <button type="button" className="pf-icon-button pf-ah-close" aria-label={t("Close")} onClick={onDone}><X size={16} /></button>
      <div className="pf-ah-main">
        <header className="pf-ah-head">
          <span className="pf-wr-kicker" style={{ color: "var(--pf-ink-3)" }}>{t("Investments")}</span>
          <h2>{picked ? label(picked) : manual ? t("Add it by hand") : t("Add an investment")}</h2>
        </header>

        {!picked && !manual && (
          <>
            <div className="pf-ah-search">
              <Search size={18} />
              <input
                value={q}
                placeholder={t("Search a share, fund or coin — e.g. Apple, VWRL, Bitcoin")}
                onChange={(e) => { setQ(e.target.value); setActive(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  if (e.key === "Enter" && list[active]) { e.preventDefault(); pick(list[active]); }
                }}
              />
              {loading && <span className="pf-inv-wait" />}
            </div>
            <span className="pf-ah-sub">{q.trim() ? t("Results") : t("Popular")}</span>
            <div className="pf-ah-grid" role="listbox">
              {list.map((r, i) => (
                <button key={`${r.type}:${r.symbol}`} type="button" role="option" aria-selected={i === active} className="pf-ah-tile" style={{ ["--d" as string]: `${i * 30}ms` }} onMouseEnter={() => setActive(i)} onClick={() => pick(r)}>
                  <AssetIcon symbol={logo(r.symbol)} type={r.type} size={36} />
                  <span>
                    <b>{label(r)}</b>
                    <small>{r.symbol}{r.exchange ? ` · ${r.exchange}` : ""} · {t(r.kind)}</small>
                  </span>
                </button>
              ))}
              {q.trim() && !loading && !results.length && <p className="pf-ah-none">{t("Nothing found with a live price.")}</p>}
            </div>
            <button type="button" className="pf-ah-manual" onClick={() => { setManual(true); setName(q.trim()); }}>
              <PenLine size={15} /> {t("Not listed? Add it by hand, without a live price")}
            </button>
          </>
        )}

        {picked && (
          <div className="pf-ah-picked">
            <div className="pf-ah-id">
              <AssetIcon symbol={logo(picked.symbol)} type={picked.type} size={48} />
              <span className="pf-ah-idtext">
                <small>{picked.symbol}{picked.exchange ? ` · ${picked.exchange}` : ""} · {t(picked.kind)}</small>
                {unit?.quote ? (
                  <b className="pf-rounded">
                    {money(unit.quote.price, unit.quote.currency)}{" "}
                    {unit.dayPct != null && <em data-up={unit.dayPct >= 0}>{unit.dayPct >= 0 ? "▲" : "▼"} {Math.abs(unit.dayPct * 100).toFixed(2)}% {t("today")}</em>}
                  </b>
                ) : (
                  <span className="pf-inv-wait" />
                )}
              </span>
              <button type="button" className="pf-link" onClick={() => setPicked(null)}><ArrowLeft size={14} /> {t("Change")}</button>
            </div>
            <div className="pf-ah-chart">
              <div style={{ justifySelf: "end" }}>
                <Segmented size="sm" options={RANGES.map((r) => ({ value: r.value, label: t(r.label) }))} value={range} onChange={setRange} label={t("Period")} />
              </div>
              {series.length > 1 ? <PriceChart series={series} currency={currency} range={range} height={120} showCost={false} /> : <div className="pf-ah-chartwait"><span className="pf-inv-wait" /></div>}
            </div>

            <div className="pf-ah-fields">
              <div className="pf-ah-field">
                <span className="pf-ah-label">
                  {t("How much do you have?")}
                  <Segmented size="sm" options={[{ value: "units", label: picked.type === "crypto" ? t("Coins") : picked.type === "metal" ? t("Ounces") : t("Shares") }, { value: "money", label: t("Amount") }]} value={by} onChange={setBy} label={t("How much do you have?")} />
                </span>
                {by === "units" ? (
                  <input ref={qtyRef} className="pf-input pf-ah-big" inputMode="decimal" placeholder="0" value={units} onChange={(e) => setUnits(e.target.value)} />
                ) : (
                  <input ref={qtyRef} className="pf-input pf-ah-big" inputMode="decimal" placeholder={money(0, currency)} value={amount} onChange={(e) => setAmount(e.target.value)} />
                )}
                <small>{by === "money" && qty > 0 ? t("= {n} at today's price", { n: qty.toLocaleString(undefined, { maximumFractionDigits: 6 }) }) : price ? t("{price} each", { price: money(price, currency) }) : " "}</small>
              </div>
              <div className="pf-ah-field">
                <span className="pf-ah-label">
                  {t("What did you pay?")}
                  <Segmented size="sm" options={[{ value: "total", label: t("Total") }, { value: "each", label: unitWord }]} value={paidEach ? "each" : "total"} onChange={(v) => setPaidEach(v === "each")} label={t("What did you pay?")} />
                </span>
                <input className="pf-input pf-ah-big" inputMode="decimal" placeholder={now ? money(now, currency) : money(0, currency)} value={paid} onChange={(e) => setPaid(e.target.value)} />
                <small>{paidEach && paidTotal > 0 ? t("= {amount} in total", { amount: money(paidTotal, currency) }) : t("Optional — empty counts it at today's value.")}</small>
              </div>
              <label className="pf-ah-field">
                <span className="pf-ah-label">{t("Bought on")}</span>
                <input className="pf-input pf-ah-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value || todayIso())} />
                <small>{t("Its chart and result run from this day.")}</small>
              </label>
            </div>
          </div>
        )}

        {manual && !picked && (
          <div className="pf-ah-fields">
            <label className="pf-ah-field">
              <span className="pf-ah-label">{t("Name")}</span>
              <input className="pf-input pf-ah-big" autoFocus placeholder={t("e.g. pension fund")} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="pf-ah-field">
              <span className="pf-ah-label">{t("Kind")}</span>
              <Segmented options={(["stock", "crypto", "metal"] as AssetType[]).map((k) => ({ value: k, label: t(TYPE[k].label) }))} value={kind} onChange={setKind} label={t("Kind")} />
            </div>
            <label className="pf-ah-field">
              <span className="pf-ah-label">{t("Worth today")}</span>
              <input className="pf-input pf-ah-big" inputMode="decimal" placeholder={money(0, currency)} value={worth} onChange={(e) => setWorth(e.target.value)} />
            </label>
            <label className="pf-ah-field">
              <span className="pf-ah-label">{t("Since")}</span>
              <input className="pf-input pf-ah-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value || todayIso())} />
            </label>
            <button type="button" className="pf-link" style={{ justifySelf: "start" }} onClick={() => setManual(false)}><ArrowLeft size={14} /> {t("Search instead")}</button>
          </div>
        )}
      </div>

      {/* Live: what it's worth, the result, its share of the portfolio. */}
      <aside className="pf-ah-side" data-on={ready}>
        <span className="pf-ah-sidehead">{t("Worth now")} {picked && <i className="pf-inv-live"><span /> {t("Live")}</i>}</span>
        {now != null && now > 0 ? <LiveAmount value={now} currency={currency} size="2rem" color="var(--pf-ink)" /> : <b className="pf-ah-zero pf-rounded">{money(0, currency)}</b>}
        <dl>
          <div><dt>{t("Paid")}</dt><dd className="pf-rounded">{cost > 0 ? money(cost, currency) : "—"}</dd></div>
          <div>
            <dt>{t("Result")}</dt>
            <dd className="pf-rounded" style={{ color: result == null ? undefined : result >= 0 ? "var(--pf-green)" : "var(--pf-red)" }}>
              {result == null ? "—" : `${result >= 0 ? "+" : "−"}${money(Math.abs(result), currency)} · ${Math.abs((result / paidTotal) * 100).toFixed(1)}%`}
            </dd>
          </div>
          {picked && qty > 0 && <div><dt>{t("How many")}</dt><dd className="pf-rounded">{qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}</dd></div>}
          <div><dt>{t("Share of your portfolio")}</dt><dd className="pf-rounded">{share != null ? `${(share * 100).toFixed(1)}%` : "—"}</dd></div>
        </dl>
        {share != null && (
          <div className="pf-ah-sharebar" aria-hidden><i style={{ width: `${(1 - share) * 100}%` }} /><em style={{ width: `${share * 100}%` }} /></div>
        )}
        {error && <p className="pf-unlock-error" role="alert">{error}</p>}
        <button type="button" className="pf-button pf-ah-add" disabled={!ready || saving} onClick={() => void save()}>
          {saving ? t("Working…") : <><Check size={16} /> {t("Add to my investments")}</>}
        </button>
        {!ready && <small className="pf-ah-hint"><Sparkles size={12} /> {picked ? t("Fill in how much you have.") : manual ? t("A name and what it's worth.") : t("Find what you hold first.")}</small>}
      </aside>
    </div>
  );
}
