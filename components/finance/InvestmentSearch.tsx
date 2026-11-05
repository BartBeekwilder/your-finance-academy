"use client";

import { t } from "@/lib/i18n";
import { Check, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { money } from "@/lib/finance/format";
import { holdingValue, type Quotes } from "@/lib/finance/quotes";
import type { AssetType, Holding } from "@/lib/finance/types";
import type { SearchResult } from "@/app/api/search/route";
import { AssetIcon } from "./Portfolio";

// One investment in the onboarding: search it by name or ticker (/api/search),
// pick it, say how many you hold — its value then follows the live price,
// like on the Investments page. Not listed (a private fund, a pension)? Add
// it by hand at what it's worth today, without a live price.

export type InvestmentDraft = {
  key: string;
  name: string;
  type: AssetType;
  /** By hand: what it's worth today. */
  amount: string;
  /** Linked to a live price: the holding's symbol (AAPL, BTC, XAU) … */
  symbol?: string;
  exchange?: string | null;
  kind?: string;
  /** … how many, and optionally what was paid: in total, or per share /
   *  coin (`paidEach`) — then the total is that × how many. */
  quantity?: string;
  paid?: string;
  paidEach?: boolean;
};

const parse = (s: string | undefined) => {
  const v = Number((s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

/** What was paid in total (0 when not filled in). */
export function paidTotal(x: InvestmentDraft) {
  const p = parse(x.paid);
  return x.paidEach ? p * parse(x.quantity) : p;
}

/** The draft as a holding (for quotes and its value). */
export function draftHolding(x: InvestmentDraft, currency: string): Holding {
  return {
    id: x.key,
    symbol: x.symbol ?? "",
    name: x.name,
    asset_type: x.type,
    quantity: String(parse(x.quantity)),
    cost_basis: paidTotal(x) > 0 ? String(paidTotal(x)) : null,
    cost_basis_currency: currency,
    date_added: new Date().toISOString(),
    updated_at: "",
    deleted_at: null,
  } as Holding;
}

/** What it's worth now: live price × quantity, or the amount typed by hand. */
export function draftValue(x: InvestmentDraft, quotes: Quotes | null, currency: string, num: (s: string) => number) {
  if (!x.symbol) return num(x.amount);
  return holdingValue(draftHolding(x, currency), quotes ?? {}, currency).value ?? 0;
}

/** A logo only for a plain ticker: VWRL.AS and the like come back blank. */
export const logo = (symbol: string) => (/^[A-Z0-9-]{1,10}$/.test(symbol) ? symbol : "");

/** Metals come back by their English name; the rest by their own name. */
export const label = (r: SearchResult) => (r.type === "metal" ? t(r.name) : r.name);

export function useSearch(q: string) {
  const [state, setState] = useState<{ q: string; results: SearchResult[] } | null>(null);
  useEffect(() => {
    const text = q.trim();
    if (!text) return;
    let alive = true;
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(text)}`)
        .then((r) => r.json())
        .then((j) => alive && setState({ q: text, results: j.results ?? [] }))
        .catch(() => alive && setState({ q: text, results: [] }));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q]);
  const text = q.trim();
  return { results: text && state?.q === text ? state.results : [], loading: !!text && state?.q !== text };
}

export default function InvestmentLine({ x, currency, quotes, onChange, onRemove, AmountField, autoFocus }: {
  x: InvestmentDraft;
  currency: string;
  quotes: Quotes | null;
  onChange: (patch: Partial<InvestmentDraft>) => void;
  onRemove: () => void;
  AmountField: (p: { value: string; onChange: (v: string) => void; label: string; currency: string }) => React.ReactNode;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const { results, loading } = useSearch(q);
  const list = useId();
  const qtyRef = useRef<HTMLInputElement>(null);
  const manual = !x.symbol && (x.name !== "" || x.amount !== "");

  const pick = (r: SearchResult) => {
    onChange({ symbol: r.symbol, name: label(r), type: r.type, exchange: r.exchange, kind: r.kind, amount: "", quantity: x.quantity ?? "" });
    setQ("");
    requestAnimationFrame(() => qtyRef.current?.focus());
  };
  const byHand = () => {
    onChange({ symbol: undefined, name: q.trim() || x.name, amount: x.amount, exchange: undefined, kind: undefined });
    setQ("");
  };

  // Linked to a live price.
  if (x.symbol) {
    const v = holdingValue(draftHolding(x, currency), quotes ?? {}, currency);
    const qty = parse(x.quantity);
    const unit = v.quote ? money(v.quote.price, v.quote.currency) : null;
    const up = (v.dayPct ?? 0) >= 0;
    return (
      <div className="pf-inv pf-inv-linked">
        <div className="pf-inv-head">
          <AssetIcon symbol={logo(x.symbol)} type={x.type} size={34} />
          <span className="pf-inv-title">
            <b>{x.name}</b>
            <small>
              {x.symbol}
              {x.exchange ? ` · ${x.exchange}` : ""}
              {x.kind ? ` · ${t(x.kind)}` : ""}
            </small>
          </span>
          <span className="pf-inv-price">
            {unit ? (
              <>
                <b className="pf-rounded">{unit}</b>
                {v.dayPct != null && <small data-up={up}>{up ? "▲" : "▼"} {Math.abs(v.dayPct * 100).toFixed(2)}%</small>}
              </>
            ) : (
              <span className="pf-inv-wait" aria-label={t("Working…")} />
            )}
          </span>
          <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={onRemove}><X size={14} /></button>
        </div>
        <div className="pf-inv-body">
          <label>
            {t("How many?")}
            <input ref={qtyRef} className="pf-input pf-inv-qty" inputMode="decimal" placeholder="0" value={x.quantity ?? ""} onChange={(e) => onChange({ quantity: e.target.value })} />
          </label>
          <div className="pf-inv-paid">
            {/* What was paid: the total, or per share / coin. */}
            <span className="pf-inv-paidhead">
              {t("Paid (optional)")}
              <span className="pf-inv-paidmode" role="group" aria-label={t("Paid")}>
                <button type="button" aria-pressed={!x.paidEach} onClick={() => onChange({ paidEach: false })}>{t("Total")}</button>
                <button type="button" aria-pressed={!!x.paidEach} onClick={() => onChange({ paidEach: true })}>{x.type === "crypto" ? t("Per coin") : x.type === "metal" ? t("Per ounce") : t("Per share")}</button>
              </span>
            </span>
            <AmountField currency={currency} value={x.paid ?? ""} label={x.paidEach ? t("Paid per share") : t("Paid in total")} onChange={(paid) => onChange({ paid })} />
            {/* Inside the card (it grows to make room, smoothly), not hanging below it. */}
            <div className="pf-inv-paidsum" data-on={x.paidEach && parse(x.paid) > 0 && qty > 0}>
              <small>= {money(paidTotal(x), currency)} {t("in total")}</small>
            </div>
          </div>
          <span className="pf-inv-worth" data-on={qty > 0 && v.value != null}>
            <small>{t("Worth now")}</small>
            <b className="pf-rounded">{v.value != null && qty > 0 ? money(v.value, currency) : "—"}</b>
            {paidTotal(x) > 0 && v.value != null && qty > 0 ? (
              <i className="pf-inv-result" data-up={v.value >= paidTotal(x)}>
                {v.value >= paidTotal(x) ? "+" : "−"}{money(Math.abs(v.value - paidTotal(x)), currency)} · {Math.abs(((v.value - paidTotal(x)) / paidTotal(x)) * 100).toFixed(1)}%
              </i>
            ) : (
              <i className="pf-inv-live"><span /> {t("Live")}</i>
            )}
          </span>
        </div>
      </div>
    );
  }

  // Added by hand, without a live price.
  if (manual)
    return (
      <div className="pf-ob-line">
        <span className="pf-inv-manual" title={t("Without a live price")}><AssetIcon symbol="" type={x.type} size={26} /></span>
        <input className="pf-ob-name" value={x.name} placeholder={t("Name")} aria-label={t("Name")} onChange={(e) => onChange({ name: e.target.value })} />
        <AmountField currency={currency} value={x.amount} label={t("Worth today")} onChange={(amount) => onChange({ amount })} />
        <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={onRemove}><X size={14} /></button>
      </div>
    );

  // Searching.
  const open = focused && q.trim() !== "";
  const options = results.length;
  return (
    <div className="pf-inv pf-inv-search">
      <div className="pf-inv-field">
        <Search size={15} />
        <input
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls={list}
          aria-autocomplete="list"
          aria-activedescendant={open && options ? `${list}-${active}` : undefined}
          placeholder={t("Search a share, fund or coin — e.g. Apple, VWRL, Bitcoin")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); if (active < options) pick(results[active]); else byHand(); }
            else if (e.key === "Escape") { e.preventDefault(); setQ(""); }
          }}
        />
        {loading && <span className="pf-inv-wait" />}
        <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={onRemove}><X size={14} /></button>
      </div>
      {open && (
        <ul className="pf-inv-results" id={list} role="listbox">
          {results.map((r, i) => (
            <li key={`${r.type}:${r.symbol}`} id={`${list}-${i}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(r); }} style={{ animationDelay: `${i * 35}ms` }}>
              <AssetIcon symbol={logo(r.symbol)} type={r.type} size={28} />
              <span>
                <b>{label(r)}</b>
                <small>{r.symbol}{r.exchange ? ` · ${r.exchange}` : ""} · {t(r.kind)}</small>
              </span>
              {i === active && <Check size={14} className="pf-inv-go" />}
            </li>
          ))}
          {!loading && !options && <li className="pf-inv-none">{t("Nothing found with a live price.")}</li>}
          <li id={`${list}-${options}`} role="option" aria-selected={active === options} className="pf-inv-byhand" onMouseEnter={() => setActive(options)} onMouseDown={(e) => { e.preventDefault(); byHand(); }}>
            {t("Add “{name}” by hand, without a live price", { name: q.trim() })}
          </li>
        </ul>
      )}
    </div>
  );
}
