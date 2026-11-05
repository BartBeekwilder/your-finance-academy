"use client";

import { intlLocale, t } from "@/lib/i18n";
import { ArrowRight, Check, Minus, PenLine, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { money } from "@/lib/finance/format";
import { holdingValue, symbolsFor } from "@/lib/finance/quotes";
import type { Holding } from "@/lib/finance/types";
import { useFinance } from "./FinanceProvider";
import { logo } from "./InvestmentSearch";
import LiveAmount from "./LiveAmount";
import { AssetIcon, useQuotes } from "./Portfolio";
import Segmented from "./Segmented";
import Sheet from "./Sheet";

// One holding: buy more, sell (part of) it, edit it or delete it — in the
// same large panel as adding one. Buying more adds the shares and what was
// paid (so the average price follows); selling takes the shares off and the
// matching part of what was put in, and shows the result that was made;
// selling everything removes the holding. Opened from the holding's detail
// sheet via the "pf-holding-action" event ({ id, mode, origin }).

export type TradeMode = "buy" | "sell" | "edit";
/** "delete": the edit view with the delete confirmation already up. */
export type TradeOpen = TradeMode | "delete";
export const openTrade = (id: string, mode: TradeOpen, origin: Element | null) =>
  window.dispatchEvent(new CustomEvent("pf-holding-action", { detail: { id, mode, origin } }));

const parse = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtQty = (n: number) => n.toLocaleString(intlLocale(), { maximumFractionDigits: 8 });

export default function HoldingTrade() {
  const [state, setState] = useState<{ id: string; mode: TradeOpen; origin: Element | null; n: number } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const go = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; mode: TradeOpen; origin: Element | null }>).detail;
      setState((s) => ({ ...d, n: (s?.n ?? 0) + 1 }));
      setOpen(true);
    };
    window.addEventListener("pf-holding-action", go);
    return () => window.removeEventListener("pf-holding-action", go);
  }, []);
  return (
    <Sheet wide open={open} onClose={() => setOpen(false)} origin={state?.origin} focus=".pf-ah-big" label={t("Investment")}>
      {state && <Trade key={state.n} id={state.id} mode0={state.mode} onDone={() => setOpen(false)} />}
    </Sheet>
  );
}

function Trade({ id, mode0, onDone }: { id: string; mode0: TradeOpen; onDone: () => void }) {
  const { data, updateHolding, deleteHolding } = useFinance();
  const currency = data.profile.currency_code;
  const h = data.holdings.find((x) => x.id === id && !x.deleted_at);
  const [mode, setMode] = useState<TradeMode>(mode0 === "delete" ? "edit" : mode0);
  const [by, setBy] = useState<"units" | "money">("units");
  const [units, setUnits] = useState("");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [each, setEach] = useState(false);
  const [date, setDate] = useState(() => isoDay(new Date()));
  // Edit.
  const [name, setName] = useState(h?.name ?? "");
  const [qtyEdit, setQtyEdit] = useState(h ? String(Number(h.quantity)).replace(".", ",") : "");
  // Starts empty for a cost kept in another currency (filled once converted).
  const [costEdit, setCostEdit] = useState(h?.cost_basis && (h.cost_basis_currency ?? currency) === currency ? String(Number(h.cost_basis)).replace(".", ",") : "");
  const [since, setSince] = useState(h ? isoDay(new Date(h.date_added)) : isoDay(new Date()));
  const [confirmDelete, setConfirmDelete] = useState(mode0 === "delete");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const today = useQuotes(h?.symbol ? symbolsFor([h], currency) : [], "1d", 30_000);
  if (!h) return <p style={{ padding: 28 }}>{t("This investment is no longer there.")}</p>;

  const quotes = today?.quotes ?? {};
  const linked = !!h.symbol;
  const qty = Number(h.quantity) || 0;
  // What was put in, in the profile currency (a cost kept in dollars is
  // converted at today's rate, and saved in the profile currency after).
  const ownCurrency = (h.cost_basis_currency ?? currency) === currency;
  const converted = h.cost_basis != null ? holdingValue(h, quotes, currency).cost : null;
  const cost = h.cost_basis == null ? null : ownCurrency ? Number(h.cost_basis) : converted;
  const costReady = h.cost_basis == null || ownCurrency || (today != null && converted != null);
  const unit = linked ? holdingValue({ ...h, quantity: "1" } as Holding, quotes, currency).value : null; // one share, profile currency
  const nowValue = linked ? (unit != null ? unit * qty : null) : cost;
  const delta = by === "units" ? parse(units) : unit ? parse(amount) / unit : 0;
  const sellAll = mode === "sell" && delta >= qty - 1e-9 && delta > 0;
  const tradeQty = mode === "sell" ? Math.min(delta, qty) : delta;
  const tradeValue = unit != null ? unit * tradeQty : null;
  const money0 = each ? parse(price) * tradeQty : parse(price);
  const tradeMoney = money0 > 0 ? money0 : tradeValue ?? 0;
  const unitWord = h.asset_type === "crypto" ? t("Per coin") : h.asset_type === "metal" ? t("Per ounce") : t("Per share");
  const countWord = h.asset_type === "crypto" ? t("Coins") : h.asset_type === "metal" ? t("Ounces") : t("Shares");

  // Edit: an empty "paid" keeps what was put in (converted if need be).
  const editCost = parse(costEdit) > 0 ? parse(costEdit) : cost ?? 0;
  // After the trade.
  const afterQty = mode === "buy" ? qty + tradeQty : mode === "sell" ? qty - tradeQty : parse(qtyEdit);
  const costOut = mode === "sell" && cost != null && qty > 0 ? cost * (tradeQty / qty) : 0;
  const afterCost = mode === "buy" ? (cost ?? nowValue ?? 0) + tradeMoney : mode === "sell" ? (cost ?? 0) - costOut : editCost;
  const afterValue = linked ? (unit != null ? unit * afterQty : null) : mode === "edit" ? editCost : cost;
  const realised = mode === "sell" && cost != null ? tradeMoney - costOut : null;
  const avg = (c: number, q: number) => (q > 0 ? c / q : null);
  const ready = costReady && (mode === "edit" ? name.trim() !== "" && (linked ? afterQty > 0 : editCost > 0) : tradeQty > 0);

  async function save() {
    if (!ready || !h) return;
    setSaving(true);
    setError("");
    try {
      if (mode === "buy") {
        // Bought earlier than the first purchase: the holding runs from then.
        const first = date < isoDay(new Date(h.date_added)) ? `${date}T12:00:00.000Z` : h.date_added;
        await updateHolding(h.id, { quantity: String(+afterQty.toFixed(8)), cost_basis: afterCost.toFixed(2), cost_basis_currency: currency, date_added: first });
      } else if (mode === "sell") {
        if (sellAll) await deleteHolding(h.id);
        else await updateHolding(h.id, { quantity: String(+afterQty.toFixed(8)), cost_basis: cost != null ? Math.max(0, afterCost).toFixed(2) : null, cost_basis_currency: currency });
      } else {
        await updateHolding(h.id, linked
          ? { name: name.trim(), quantity: String(+afterQty.toFixed(8)), cost_basis: editCost > 0 ? editCost.toFixed(2) : null, cost_basis_currency: currency, date_added: `${since}T12:00:00.000Z` }
          : { name: name.trim(), cost_basis: editCost.toFixed(2), cost_basis_currency: currency, date_added: `${since}T12:00:00.000Z` });
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!h) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setSaving(true);
    try {
      await deleteHolding(h.id);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const row = (label: string, before: string, after: string, color?: string) => (
    <div className="pf-ht-row">
      <dt>{label}</dt>
      <dd className="pf-rounded"><span>{before}</span>{before !== after && <><ArrowRight size={12} /><b style={{ color }}>{after}</b></>}</dd>
    </div>
  );

  return (
    <div className="pf-ah">
      <button type="button" className="pf-icon-button pf-ah-close" aria-label={t("Close")} onClick={onDone}><X size={16} /></button>
      <div className="pf-ah-main">
        <div className="pf-ah-id">
          <AssetIcon symbol={logo(h.symbol)} type={h.asset_type} size={48} />
          <span className="pf-ah-idtext">
            <small>{h.symbol ? `${h.symbol} · ` : ""}{fmtQty(qty)} {countWord.toLowerCase()}</small>
            <b>{h.name}</b>
          </span>
        </div>
        <Segmented
          options={[
            ...(linked ? [{ value: "buy" as const, label: t("Buy more") }, { value: "sell" as const, label: t("Sell") }] : []),
            { value: "edit" as const, label: t("Edit") },
          ]}
          value={mode}
          onChange={(m) => { setMode(m); setConfirmDelete(false); }}
          label={t("Investment")}
        />

        {mode !== "edit" && (
          <div key={mode} className="pf-ah-fields">
            <div className="pf-ah-field">
              <span className="pf-ah-label">
                {mode === "buy" ? t("How much did you buy?") : t("How much did you sell?")}
                <Segmented size="sm" options={[{ value: "units", label: countWord }, { value: "money", label: t("Amount") }]} value={by} onChange={setBy} label={t("How much")} />
              </span>
              {by === "units" ? (
                <input className="pf-input pf-ah-big" inputMode="decimal" placeholder="0" value={units} onChange={(e) => setUnits(e.target.value)} />
              ) : (
                <input className="pf-input pf-ah-big" inputMode="decimal" placeholder={money(0, currency)} value={amount} onChange={(e) => setAmount(e.target.value)} />
              )}
              <small>
                {mode === "sell" && (
                  <button type="button" className="pf-link" onClick={() => { setBy("units"); setUnits(String(qty).replace(".", ",")); }}>{t("All of it ({n})", { n: fmtQty(qty) })}</button>
                )}
                {mode === "buy" && by === "money" && tradeQty > 0 ? t("= {n} at today's price", { n: fmtQty(tradeQty) }) : null}
              </small>
            </div>
            <div className="pf-ah-field">
              <span className="pf-ah-label">
                {mode === "buy" ? t("What did you pay?") : t("What did you get for it?")}
                <Segmented size="sm" options={[{ value: "total", label: t("Total") }, { value: "each", label: unitWord }]} value={each ? "each" : "total"} onChange={(v) => setEach(v === "each")} label={t("Price")} />
              </span>
              <input className="pf-input pf-ah-big" inputMode="decimal" placeholder={tradeValue ? money(tradeValue, currency) : money(0, currency)} value={price} onChange={(e) => setPrice(e.target.value)} />
              <small>{each && money0 > 0 ? t("= {amount} in total", { amount: money(money0, currency) }) : t("Empty counts it at today's price.")}</small>
            </div>
            {mode === "buy" && (
              <label className="pf-ah-field">
                <span className="pf-ah-label">{t("Bought on")}</span>
                <input className="pf-input pf-ah-date" type="date" max={isoDay(new Date())} value={date} onChange={(e) => setDate(e.target.value || isoDay(new Date()))} />
              </label>
            )}
          </div>
        )}

        {mode === "edit" && (
          <div key="edit" className="pf-ah-fields">
            <label className="pf-ah-field">
              <span className="pf-ah-label">{t("Name")}</span>
              <input className="pf-input pf-ah-big" style={{ textAlign: "left" }} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            {linked && (
              <label className="pf-ah-field">
                <span className="pf-ah-label">{countWord}</span>
                <input className="pf-input pf-ah-big" inputMode="decimal" value={qtyEdit} onChange={(e) => setQtyEdit(e.target.value)} />
              </label>
            )}
            <label className="pf-ah-field">
              <span className="pf-ah-label">{linked ? t("Paid in total") : t("Worth today")}</span>
              <input className="pf-input pf-ah-big" inputMode="decimal" placeholder={money(cost ?? 0, currency)} value={costEdit} onChange={(e) => setCostEdit(e.target.value)} />
              {linked && afterQty > 0 && editCost > 0 && <small>{t("Average {price} {unit}", { price: money(editCost / afterQty, currency), unit: unitWord.toLowerCase() })}</small>}
            </label>
            <label className="pf-ah-field">
              <span className="pf-ah-label">{t("Since")}</span>
              <input className="pf-input pf-ah-date" type="date" max={isoDay(new Date())} value={since} onChange={(e) => setSince(e.target.value || since)} />
            </label>
          </div>
        )}

        <div className="pf-ht-danger">
          <button type="button" className="pf-ht-delete" data-sure={confirmDelete} onClick={() => void remove()} disabled={saving}>
            <Trash2 size={14} /> {confirmDelete ? t("Sure? Delete {name} for good", { name: h.name }) : t("Delete this investment")}
          </button>
          {confirmDelete && <button type="button" className="pf-link" onClick={() => setConfirmDelete(false)}>{t("Cancel")}</button>}
        </div>
      </div>

      <aside className="pf-ah-side" data-on={ready}>
        <span className="pf-ah-sidehead">
          {mode === "buy" ? t("After buying") : mode === "sell" ? t("After selling") : t("After the change")}
          {linked && <i className="pf-inv-live"><span /> {t("Live")}</i>}
        </span>
        {afterValue != null && afterQty > 0 ? <LiveAmount value={afterValue} currency={currency} size="2rem" color="var(--pf-ink)" /> : <b className="pf-ah-zero pf-rounded">{mode === "sell" && sellAll ? t("Sold") : money(0, currency)}</b>}
        <dl>
          {linked && row(countWord, fmtQty(qty), fmtQty(Math.max(0, afterQty)))}
          {row(t("Put in"), cost != null ? money(cost, currency) : "—", money(Math.max(0, afterCost), currency))}
          {linked && row(t("Average price"), avg(cost ?? 0, qty) != null ? money(avg(cost ?? 0, qty)!, currency) : "—", avg(afterCost, afterQty) != null ? money(avg(afterCost, afterQty)!, currency) : "—")}
          {linked && nowValue != null && row(t("Worth now"), money(nowValue, currency), afterValue != null ? money(Math.max(0, afterValue), currency) : "—")}
        </dl>
        {mode === "sell" && realised != null && tradeQty > 0 && (
          <div className="pf-ht-realised" data-up={realised >= 0}>
            <span>{t("Result on this sale")}</span>
            <b className="pf-rounded">{realised >= 0 ? "+" : "−"}{money(Math.abs(realised), currency)}</b>
            <small>{t("You get {amount} for it.", { amount: money(tradeMoney, currency) })}</small>
          </div>
        )}
        {error && <p className="pf-unlock-error" role="alert">{error}</p>}
        <button type="button" className="pf-button pf-ah-add" disabled={!ready || saving} onClick={() => void save()}>
          {saving ? t("Working…") : mode === "buy" ? <><Plus size={16} /> {t("Add the purchase")}</> : mode === "sell" ? <><Minus size={16} /> {sellAll ? t("Sell everything") : t("Record the sale")}</> : <><Check size={16} /> {t("Save changes")}</>}
        </button>
        {mode === "edit" && <small className="pf-ah-hint"><PenLine size={12} /> {t("For a purchase or sale, use Buy more or Sell — the average price follows.")}</small>}
      </aside>
    </div>
  );
}
