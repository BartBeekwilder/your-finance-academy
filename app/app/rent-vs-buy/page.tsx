"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import Segmented from "@/components/finance/Segmented";
import Stat from "@/components/finance/Stat";
import { live, num } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import { homes } from "@/lib/finance/realEstate";
import { rentVsBuy, RENT_BUY_DEFAULTS, type CostTotals, type RentBuyInput, type RentBuyYear } from "@/lib/finance/rentVsBuy";
import type { FinanceData } from "@/lib/finance/types";
import { intlLocale, t } from "@/lib/i18n";

// Rent or buy — the long run, side by side. Both sides spend the same each
// month; whoever's housing is cheaper invests the difference. The hero says
// who's ahead after the chosen number of years and from when buying wins;
// the chart shows both fortunes year by year; the cost card splits a month
// of owning (interest, repayment, upkeep, costs, tax back) against the rent.
// Every assumption is a slider; the inputs are remembered on this device.

const BUY = "#40c8e0";
const RENT = "#bf5af2";
const INTEREST = "#ff9f0a";
const REPAY = "#30d158";
const UPKEEP = "#ff6482";
const COSTS = "#ffd60a";
const KEY = "pf-rent-vs-buy";

/** Starting point: saved inputs, else what we know (home value, your rent). */
function initial(data: FinanceData, now: Date): RentBuyInput {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return { ...RENT_BUY_DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  const home = homes(data)[0];
  const rentCat = data.categories.find((c) => c.name.toLowerCase() === "rent");
  const since = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const rents = rentCat ? live(data.transactions).filter((x) => x.category_id === rentCat.id && x.type === "expense" && new Date(x.date) >= since && new Date(x.date) < new Date(now.getFullYear(), now.getMonth(), 1)) : [];
  const rent = rents.length ? Math.round(rents.reduce((s, x) => s + num(x.amount), 0) / 3 / 25) * 25 : RENT_BUY_DEFAULTS.rent;
  const price = home ? Math.round(num(home.property.value) / 5000) * 5000 : RENT_BUY_DEFAULTS.price;
  const nl = home?.property.country === "NL" || intlLocale().startsWith("nl");
  return { ...RENT_BUY_DEFAULTS, price, ownMoney: Math.round(price * 0.1), rent, nlTax: nl, buyCostsRate: nl ? 0.04 : RENT_BUY_DEFAULTS.buyCostsRate };
}

export default function RentVsBuyPage() {
  const { data, now } = useFinance();
  const currency = data.profile.currency_code;
  const [x, setX] = useState<RentBuyInput>(() => initial(data, now));
  const [horizon, setHorizon] = useState(() => Math.min(x.years, 15));
  const set = (patch: Partial<RentBuyInput>) =>
    setX((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  const reset = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setX(initial(data, now));
  };

  const r = useMemo(() => rentVsBuy({ ...x, years: 40 }), [x]);
  const at = r.timeline[horizon];
  const buyAhead = at.buyer >= at.renter;
  const gap = Math.abs(at.buyer - at.renter);
  const pct = (v: number, d = 1) => new Intl.NumberFormat(intlLocale(), { style: "percent", maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
  const upTo = (key: keyof CostTotals) => sumTo(r, horizon, key);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Rent or buy")}</h1>
          <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("What each choice leaves you with in the long run.")}</p>
        </div>
        <button className="pf-chip" onClick={reset}>
          <RotateCcw size={14} /> {t("Reset")}
        </button>
      </header>

      {/* Verdict at the chosen horizon. */}
      <section className="pf-card pf-rvb-hero" data-buy={buyAhead}>
        <div style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--pf-ink-2)" }}>{t("After {n} years", { n: horizon })}</span>
          <div key={`${horizon}-${buyAhead}`} className="pf-readout" style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1.2 }}>
            {buyAhead ? t("Buying leaves you {amount} better off", { amount: money(gap, currency) }) : t("Renting leaves you {amount} better off", { amount: money(gap, currency) })}
          </div>
          <div className="pf-re-chips">
            <span className="pf-chip" style={{ cursor: "default" }}>
              {r.breakEven !== null && r.breakEven <= 40 ? t("Buying wins from year {n}", { n: r.breakEven }) : t("Renting stays ahead for 40 years")}
            </span>
          </div>
        </div>
        <div className="pf-rvb-duo">
          <Side label={t("Buy")} color={BUY} value={money(at.buyer, currency)} sub={t("home {value} − debt {debt} + invested {inv}", { value: money(at.homeValue * (1 - x.sellCostsRate), currency, { compact: true }), debt: money(at.debt, currency, { compact: true }), inv: money(at.buyerPortfolio, currency, { compact: true }) })} lead={buyAhead} />
          <Side label={t("Rent")} color={RENT} value={money(at.renter, currency)} sub={t("invested {inv}", { inv: money(at.renterPortfolio, currency, { compact: true }) })} lead={!buyAhead} />
        </div>
        <label className="pf-re-slider" style={{ gridColumn: "1 / -1" }}>
          <span>{t("Years")} <b className="pf-rounded">{horizon}</b></span>
          <input className="pf-re-range" type="range" min={1} max={40} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} style={{ ["--fill" as string]: `${((horizon - 1) / 39) * 100}%` }} aria-label={t("Years")} />
        </label>
      </section>

      <WealthChart years={r.timeline} horizon={horizon} breakEven={r.breakEven} currency={currency} onPick={setHorizon} />

      {/* A month of owning vs. a month of renting. */}
      <MonthCost r={r} currency={currency} />

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Stat label={t("Rent paid in {n} years", { n: horizon })} value={money(upTo("rent"), currency)} color={RENT} />
        <Stat label={t("Interest paid in {n} years", { n: horizon })} value={money(upTo("interest"), currency)} color={INTEREST} />
        <Stat label={t("Upkeep and costs in {n} years", { n: horizon })} value={money(upTo("maintenance") + upTo("ownerCosts"), currency)} color={UPKEEP} />
        <Stat label={t("Home value after {n} years", { n: horizon })} value={money(at.homeValue, currency)} color={BUY} hint={t("bought for {amount}", { amount: money(x.price, currency) })} />
        {x.nlTax && <Stat label={t("Tax back in {n} years", { n: horizon })} value={money(upTo("tax"), currency)} color={REPAY} />}
      </div>

      {/* Assumptions. */}
      <section className="pf-card" style={{ padding: 20, display: "grid", gap: 18 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>{t("Your assumptions")}</h2>
        <div className="pf-rvb-inputs">
          <fieldset>
            <legend>{t("Buy")}</legend>
            <Slider label={t("Purchase price")} value={x.price} min={50_000} max={2_000_000} step={5_000} show={money(x.price, currency)} onChange={(v) => set({ price: v, ownMoney: Math.min(x.ownMoney, v) })} />
            <Slider label={t("Own money")} value={x.ownMoney} min={0} max={x.price} step={1_000} show={`${money(x.ownMoney, currency)} · ${pct(x.price ? x.ownMoney / x.price : 0, 0)}`} onChange={(v) => set({ ownMoney: v })} />
            <Slider label={t("Buying costs")} value={x.buyCostsRate} min={0} max={0.12} step={0.005} show={`${pct(x.buyCostsRate)} · ${money(x.price * x.buyCostsRate, currency)}`} onChange={(v) => set({ buyCostsRate: v })} />
            <Slider label={t("Mortgage interest")} value={x.rate} min={0} max={0.08} step={0.0005} show={pct(x.rate, 2)} onChange={(v) => set({ rate: v })} />
            <Slider label={t("Term")} value={x.termYears} min={5} max={40} step={1} show={t("{n} years", { n: x.termYears })} onChange={(v) => set({ termYears: v })} />
            <Segmented label={t("Repayment")} value={x.kind} onChange={(v) => set({ kind: v })} options={[{ value: "annuity", label: t("Annuity") }, { value: "linear", label: t("Linear") }]} />
            <Slider label={t("Home value growth per year")} value={x.appreciation} min={-0.03} max={0.08} step={0.0025} show={pct(x.appreciation)} onChange={(v) => set({ appreciation: v })} />
            <Slider label={t("Maintenance per year")} value={x.maintenanceRate} min={0} max={0.03} step={0.001} show={`${pct(x.maintenanceRate)} ${t("of the value")}`} onChange={(v) => set({ maintenanceRate: v })} />
            <Slider label={t("Other owner costs per year")} value={x.ownerCostsRate} min={0} max={0.02} step={0.0005} show={`${pct(x.ownerCostsRate, 2)} ${t("of the value")}`} onChange={(v) => set({ ownerCostsRate: v })} hint={t("Property tax, home insurance, HOA")} />
            <Slider label={t("Selling costs")} value={x.sellCostsRate} min={0} max={0.06} step={0.0025} show={pct(x.sellCostsRate)} onChange={(v) => set({ sellCostsRate: v })} />
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={x.nlTax} onChange={(e) => set({ nlTax: e.target.checked })} />
              {t("Dutch mortgage interest deduction")}
            </label>
          </fieldset>
          <fieldset>
            <legend>{t("Rent")}</legend>
            <Slider label={t("Rent per month")} value={x.rent} min={300} max={6_000} step={25} show={money(x.rent, currency)} onChange={(v) => set({ rent: v })} />
            <Slider label={t("Rent increase per year")} value={x.rentGrowth} min={0} max={0.08} step={0.0025} show={pct(x.rentGrowth)} onChange={(v) => set({ rentGrowth: v })} />
            <legend style={{ marginTop: 10 }}>{t("Invest")}</legend>
            <Slider label={t("Return on investments per year")} value={x.investReturn} min={0} max={0.1} step={0.0025} show={pct(x.investReturn)} onChange={(v) => set({ investReturn: v })} hint={t("What the cheaper side invests each month earns this")} />
          </fieldset>
        </div>
        <p style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)", lineHeight: 1.5 }}>
          {t("Both sides spend the same each month: whoever's housing is cheaper invests the difference. The renter starts by investing the own money and buying costs. Returns before tax; an estimate, not advice.")}
        </p>
      </section>
    </div>
  );
}

/** Totals over the first n years. */
function sumTo(r: ReturnType<typeof rentVsBuy>, years: number, key: keyof CostTotals) {
  return r.byYear.slice(0, years).reduce((s, y) => s + y[key], 0);
}

function Side({ label, color, value, sub, lead }: { label: string; color: string; value: string; sub: string; lead: boolean }) {
  return (
    <div className="pf-rvb-side" data-lead={lead} style={{ ["--c" as string]: color }}>
      <span style={{ fontSize: "0.75rem", color, fontWeight: 700 }}>{label}</span>
      <b key={value} className="pf-rounded pf-readout" style={{ fontSize: "1.4rem" }}>{value}</b>
      <span style={{ fontSize: "0.68rem", color: "var(--pf-ink-3)" }}>{sub}</span>
    </div>
  );
}

function Slider({ label, value, min, max, step, show, onChange, hint }: { label: string; value: number; min: number; max: number; step: number; show: string; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="pf-re-slider">
      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>{label}</span>
        <b className="pf-rounded">{show}</b>
      </span>
      <input className="pf-re-range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ ["--fill" as string]: `${max > min ? ((value - min) / (max - min)) * 100 : 0}%` }} aria-label={label} />
      {hint && <span style={{ fontSize: "0.68rem", color: "var(--pf-ink-3)" }}>{hint}</span>}
    </label>
  );
}

/** Per year: the difference (buying minus renting) as an area above zero
 *  in the buyer's colour and below in the renter's, or both fortunes as
 *  lines with the gap tinted; break-even marked, the chosen year lit. */
function WealthChart({ years, horizon, breakEven, currency, onPick }: { years: RentBuyYear[]; horizon: number; breakEven: number | null; currency: string; onPick: (y: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [mode, setMode] = useState<"diff" | "both">("diff");
  const W = 100, H = 220;
  const shown = years.slice(0, horizon + 1);
  const diff = shown.map((q) => q.buyer - q.renter);
  // Difference: symmetric-ish around zero so above/below read at a glance.
  const values = mode === "diff" ? diff : shown.flatMap((q) => [q.buyer, q.renter]);
  const max = Math.max(mode === "diff" ? 1 : 1, ...values, 0);
  const min = Math.min(0, ...values);
  const n = Math.max(shown.length - 1, 1);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const line = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const zero = y(0);
  const area = `${line(diff)} L${x(diff.length - 1)},${zero} L0,${zero} Z`;
  const gap = `${line(shown.map((q) => q.buyer))} ${shown.map((_, i) => `L${x(shown.length - 1 - i)},${y(shown[shown.length - 1 - i].renter)}`).join(" ")} Z`;
  const pick = Math.min(hover ?? horizon, shown.length - 1);
  const p = shown[pick];
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(Math.max(Math.round(((e.clientX - rect.left) / rect.width) * n), 0), n));
  };
  const dots = mode === "diff" ? [{ v: diff[pick], c: diff[pick] >= 0 ? BUY : RENT }] : [{ v: p.buyer, c: BUY }, { v: p.renter, c: RENT }];
  const lead = diff[pick];
  return (
    <section className="pf-card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Segmented label={t("Chart")} value={mode} onChange={setMode} options={[{ value: "diff", label: t("Difference") }, { value: "both", label: t("Both") }]} />
        <span key={`${pick}-${mode}`} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          <b style={{ color: "var(--pf-ink)" }}>{t("Year {n}", { n: p.year })}</b> ·{" "}
          {mode === "diff" ? (
            <span style={{ color: lead >= 0 ? BUY : RENT }}>{lead >= 0 ? t("Buying ahead by {amount}", { amount: money(lead, currency) }) : t("Renting ahead by {amount}", { amount: money(-lead, currency) })}</span>
          ) : (
            <>
              <span style={{ color: BUY }}>{t("Buy")} {money(p.buyer, currency)}</span> · <span style={{ color: RENT }}>{t("Rent")} {money(p.renter, currency)}</span>
            </>
          )}
        </span>
      </div>
      <div style={{ position: "relative", height: H, touchAction: "pan-y" }} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={() => hover !== null && hover > 0 && onPick(hover)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ overflow: "visible", display: "block" }}>
          <defs>
            <clipPath id="rvb-above"><rect x="0" y="0" width={W} height={zero} /></clipPath>
            <clipPath id="rvb-below"><rect x="0" y={zero} width={W} height={Math.max(H - zero, 0)} /></clipPath>
            <linearGradient id="rvb-up" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BUY} stopOpacity="0.45" />
              <stop offset="100%" stopColor={BUY} stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="rvb-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={RENT} stopOpacity="0.04" />
              <stop offset="100%" stopColor={RENT} stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="rvb-gap" x1="0" y1="0" x2="1" y2="0">
              {shown.map((q, i) => (
                <stop key={i} offset={`${(i / n) * 100}%`} stopColor={q.buyer >= q.renter ? BUY : RENT} stopOpacity="0.2" />
              ))}
            </linearGradient>
          </defs>
          <line x1="0" x2={W} y1={zero} y2={zero} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          {breakEven !== null && breakEven <= horizon && (
            <line x1={x(breakEven)} x2={x(breakEven)} y1="0" y2={H} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          )}
          {mode === "diff" ? (
            <g key={`d${horizon}`} className="pf-rvb-reveal">
              <path d={area} fill="url(#rvb-up)" clipPath="url(#rvb-above)" />
              <path d={area} fill="url(#rvb-down)" clipPath="url(#rvb-below)" />
              <path d={line(diff)} fill="none" stroke={BUY} strokeWidth="2.6" vectorEffect="non-scaling-stroke" clipPath="url(#rvb-above)" style={{ filter: `drop-shadow(0 0 4px ${BUY})` }} />
              <path d={line(diff)} fill="none" stroke={RENT} strokeWidth="2.6" vectorEffect="non-scaling-stroke" clipPath="url(#rvb-below)" style={{ filter: `drop-shadow(0 0 4px ${RENT})` }} />
            </g>
          ) : (
            <g key={`b${horizon}`}>
              <path d={gap} fill="url(#rvb-gap)" />
              <path d={line(shown.map((q) => q.renter))} fill="none" stroke={RENT} strokeWidth="2.2" vectorEffect="non-scaling-stroke" className="pf-re-line" />
              <path d={line(shown.map((q) => q.buyer))} fill="none" stroke={BUY} strokeWidth="2.6" vectorEffect="non-scaling-stroke" className="pf-re-line" style={{ filter: `drop-shadow(0 0 4px ${BUY})` }} />
            </g>
          )}
          <line x1={x(pick)} x2={x(pick)} y1="0" y2={H} stroke="rgba(255,255,255,0.18)" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Dots as HTML so they stay round on a stretched chart. */}
        {dots.map((d, i) => (
          <span key={i} className="pf-rvb-dot" style={{ left: `${(pick / n) * 100}%`, top: y(d.v), background: d.c, boxShadow: `0 0 10px ${d.c}` }} />
        ))}
        {breakEven !== null && breakEven <= horizon && (
          <span className="pf-rvb-flag" style={{ left: `${(breakEven / n) * 100}%` }}>{t("break-even")}</span>
        )}
        {mode === "diff" && (
          <>
            <span className="pf-rvb-zone" style={{ top: 4, color: BUY }}>{t("Buying ahead")}</span>
            <span className="pf-rvb-zone" style={{ bottom: 4, color: RENT }}>{t("Renting ahead")}</span>
          </>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--pf-ink-3)" }}>
        <span>{t("Now")}</span>
        <span>{t("Year {n}", { n: Math.round(horizon / 2) })}</span>
        <span>{t("Year {n}", { n: horizon })}</span>
      </div>
    </section>
  );
}

/** One month: owning split into its parts vs. renting, on one scale. */
function MonthCost({ r, currency }: { r: ReturnType<typeof rentVsBuy>; currency: string }) {
  const m = r.firstMonth;
  const parts = [
    { label: t("Interest"), v: m.interest, c: INTEREST },
    { label: t("Repayment"), v: m.repayment, c: REPAY },
    { label: t("Maintenance"), v: m.maintenance, c: UPKEEP },
    { label: t("Owner costs"), v: m.ownerCosts, c: COSTS },
  ];
  const gross = parts.reduce((s, p) => s + p.v, 0);
  const max = Math.max(gross, m.rent, 1);
  return (
    <section className="pf-card" style={{ padding: 20, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>{t("The first month")}</h2>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          {m.total > m.rent ? t("Owning costs {amount} more — the renter invests that", { amount: money(m.total - m.rent, currency) }) : t("Owning costs {amount} less — the owner invests that", { amount: money(m.rent - m.total, currency) })}
        </span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <div className="pf-rvb-row">
          <span style={{ color: BUY, fontWeight: 700 }}>{t("Buy")}</span>
          <div className="pf-rvb-bar">
            {parts.map((p, i) => (
              <span key={p.label} title={`${p.label} ${money(p.v, currency)}`} style={{ width: `${(p.v / max) * 100}%`, background: p.c, animationDelay: `${i * 0.08}s` }} />
            ))}
            {m.tax > 0 && <i className="pf-rvb-tax" style={{ width: `${(m.tax / max) * 100}%`, left: `${((gross - m.tax) / max) * 100}%` }} title={`${t("Tax back")} ${money(m.tax, currency)}`} />}
          </div>
          <b className="pf-rounded">{money(m.total, currency)}</b>
        </div>
        <div className="pf-rvb-row">
          <span style={{ color: RENT, fontWeight: 700 }}>{t("Rent")}</span>
          <div className="pf-rvb-bar">
            <span style={{ width: `${(m.rent / max) * 100}%`, background: RENT }} />
          </div>
          <b className="pf-rounded">{money(m.rent, currency)}</b>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.7rem", color: "var(--pf-ink-2)" }}>
        {parts.map((p) => (
          <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: p.c }} />
            {p.label} {money(p.v, currency)}
          </span>
        ))}
        {m.tax > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, border: "1px dashed #fff" }} />
            {t("Tax back")} −{money(m.tax, currency)}
          </span>
        )}
      </div>
      <p style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>{t("Repayment isn't gone: it becomes your share of the home.")}</p>
    </section>
  );
}
