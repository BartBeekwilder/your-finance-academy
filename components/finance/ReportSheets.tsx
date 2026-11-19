"use client";

import { intlLocale, t } from "@/lib/i18n";
import { money, monthName, monthYear, shortMonth } from "@/lib/finance/format";
import type { MonthReport } from "@/lib/finance/monthReport";
import type { YearCloseData } from "@/lib/finance/yearCloseModel";
import type { FinanceData } from "@/lib/finance/types";
import type { WealthMonth, WealthYear } from "@/lib/finance/wealthReport";
import BrandMark from "./BrandMark";

// The Premium reports as A4 sheets (app/app/report): a month on one page, a
// year on two (the year in numbers, then the figures for the tax return),
// each followed by your wealth against the world market.
// Light paper with the brand's gradient on top, so they read well on a
// screen and when printed; charts are plain SVG, so the PDF stays sharp.

const SAVINGS_GOAL = 0.2;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const longDate = (d: Date) => d.toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" });
const dayMonth = (d: Date) => d.toLocaleDateString(intlLocale(), { day: "numeric", month: "short" });

function Head({ kicker, title, who, currency }: { kicker: string; title: string; who: string; currency: string }) {
  return (
    <header className="rp-head">
      <div className="rp-head-l">
        <span className="rp-kicker">{kicker}</span>
        <h1>{title}</h1>
        <span className="rp-sub">
          {who} · {t("Made on {date}", { date: longDate(new Date()) })}
        </span>
      </div>
      <div className="rp-brand">
        <BrandMark size={46} currency={currency} />
        <span>
          <b>Personal Finance</b>
          <small>yourfinanceacademy.com</small>
        </span>
      </div>
    </header>
  );
}

function Foot({ page, pages, children }: { page: number; pages: number; children?: React.ReactNode }) {
  return (
    <footer className="rp-foot">
      <div className="rp-foot-l">{children}</div>
      <span className="rp-foot-r">
        Personal Finance · yourfinanceacademy.com · {t("Page {n} of {total}", { n: page, total: pages })}
      </span>
    </footer>
  );
}

/** A number with how it moved since last time (▲ more / ▼ less). */
function Kpi({ label, value, tone, delta, deltaGood, note }: { label: string; value: string; tone: "in" | "out" | "kept" | "plain"; delta?: string | null; deltaGood?: boolean; note?: string }) {
  return (
    <div className="rp-kpi" data-tone={tone}>
      <span className="rp-kpi-label">{label}</span>
      <b className="rp-kpi-value">{value}</b>
      {delta && <span className="rp-kpi-delta" data-good={deltaGood ? "1" : "0"}>{delta}</span>}
      {note && <span className="rp-kpi-note">{note}</span>}
    </div>
  );
}

function delta(now: number, before: number, currency: string, against: string) {
  const d = now - before;
  if (Math.abs(d) < 0.5) return t("Same as {month}", { month: against });
  return `${d > 0 ? "▲" : "▼"} ${money(Math.abs(d), currency)} ${t("vs {month}", { month: against })}`;
}

/** Spending per day: the bars are day-to-day spending; fixed costs (rent on
 *  the 1st would flatten everything else) and paydays are marks underneath. */
function DayChart({ r, currency }: { r: MonthReport; currency: string }) {
  const W = 1000, H = 200, top = 18, bottom = 52;
  const max = Math.max(1, ...r.perDay.map((d) => d.variable));
  const n = r.perDay.length, slot = W / n, bw = Math.max(4, slot * 0.62);
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const base = H - bottom;
  return (
    <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Spending per day")}>
      <defs>
        <linearGradient id="rp-var" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a7a" />
          <stop offset="1" stopColor="#e5484d" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} className="rp-grid" />
      ))}
      <line x1="0" x2={W} y1={base} y2={base} className="rp-base" />
      <text x="0" y={y(max) - 5} className="rp-axis">{money(max, currency, { compact: true })}</text>
      {r.perDay.map((d, i) => {
        const x = i * slot + (slot - bw) / 2, h = (base - top) * (d.variable / max);
        const peak = r.peak?.day === d.day;
        return (
          <g key={d.day}>
            {d.variable > 0 && <rect x={x} y={base - h} width={bw} height={h} rx="3" fill="url(#rp-var)" opacity={peak ? 1 : 0.82} />}
            {d.fixed > 0 && <rect x={x + bw / 2 - 5} y={base + 7} width="10" height="10" rx="3" className="rp-bar-fixed" />}
            {d.income > 0 && <circle cx={x + bw / 2} cy={base + 27} r="5" className="rp-pay" />}
            {(d.day === 1 || d.day % 5 === 0) && (
              <text x={x + bw / 2} y={H - 2} textAnchor="middle" className="rp-axis">{d.day}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function CategoryRows({ rows, currency }: { rows: MonthReport["categories"]; currency: string }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.budget ?? 0)));
  return (
    <div className="rp-cats">
      {rows.slice(0, 7).map((r) => {
        const color = `#${r.category.color_hex}`;
        return (
          <div className="rp-cat" key={r.category.id}>
            <span className="rp-cat-name">
              <i style={{ background: color }} />
              {r.category.name}
            </span>
            <span className="rp-cat-track">
              <span className="rp-cat-fill" style={{ width: `${(r.spent / max) * 100}%`, background: r.isOverBudget ? "#e5484d" : color }} />
              {r.budget != null && <span className="rp-cat-budget" style={{ left: `${(r.budget / max) * 100}%` }} />}
            </span>
            <span className="rp-cat-amount">
              <b>{money(r.spent, currency)}</b>
              {r.budget != null && <small data-over={r.isOverBudget ? "1" : "0"}>{t("of {amount}", { amount: money(r.budget, currency) })}</small>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MonthSheet({ r, data, who }: { r: MonthReport; data: FinanceData; who: string }) {
  const currency = data.profile.currency_code;
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const before = monthName(new Date(r.month.getFullYear(), r.month.getMonth() - 1, 1));
  const label = (tx: MonthReport["fixed"][number]) => tx.note || cats.get(tx.category_id ?? "")?.name || t("Expense");
  return (
    <section className="rp-page">
      <Head kicker={r.inProgress ? t("Monthly report · so far") : t("Monthly report")} title={monthYear(r.month)} who={who} currency={currency} />
      <div className="rp-body">
        <div className="rp-kpis">
          <Kpi label={t("Income")} value={money(r.income, currency)} tone="in" delta={r.prev.has ? delta(r.income, r.prev.income, currency, before) : null} deltaGood={r.income >= r.prev.income} />
          <Kpi label={t("Spent")} value={money(r.spent, currency)} tone="out" delta={r.prev.has ? delta(r.spent, r.prev.spent, currency, before) : null} deltaGood={r.spent <= r.prev.spent} note={t("{fixed} fixed · {other} other", { fixed: money(r.fixedTotal, currency), other: money(r.variableTotal, currency) })} />
          <Kpi label={t("Kept aside")} value={money(r.saved, currency, { signed: true })} tone="kept" delta={r.prev.has ? delta(r.saved, r.prev.saved, currency, before) : null} deltaGood={r.saved >= r.prev.saved} />
        </div>

        <div className="rp-rate">
          <span className="rp-rate-label">
            {t("Savings rate")} <b>{pct(Math.max(r.savingsRate, 0))}</b>
          </span>
          <span className="rp-rate-track">
            <span className="rp-rate-fill" style={{ width: `${Math.min(Math.max(r.savingsRate, 0) / 0.5, 1) * 100}%` }} />
            <span className="rp-rate-goal" style={{ left: `${(SAVINGS_GOAL / 0.5) * 100}%` }}>
              <small>{t("goal {pct}", { pct: pct(SAVINGS_GOAL) })}</small>
            </span>
          </span>
        </div>

        <div className="rp-block">
          <div className="rp-block-head">
            <h3>{t("Spending per day")}</h3>
            <span className="rp-legend">
              <i className="rp-l-var" /> {t("Daily spending")} <i className="rp-l-fixed" /> {t("Fixed costs")} <i className="rp-l-pay" /> {t("Income")}
            </span>
          </div>
          <DayChart r={r} currency={currency} />
          <p className="rp-caption">
            {r.peak && t("Biggest day: {date}, {amount}.", { date: dayMonth(new Date(r.month.getFullYear(), r.month.getMonth(), r.peak.day)), amount: money(r.peak.variable, currency) })}{" "}
            {t("{n} days without spending.", { n: r.noSpend })}
          </p>
        </div>

        <div className="rp-block">
          <div className="rp-block-head">
            <h3>{t("Where it went")}</h3>
            <span className="rp-legend">
              <i className="rp-l-budget" /> {t("Budget")}
            </span>
          </div>
          <CategoryRows rows={r.categories} currency={currency} />
        </div>

        <div className="rp-cols">
          <div className="rp-block">
            <h3>{t("Fixed costs")}</h3>
            <ul className="rp-list">
              {r.fixed.slice(0, 6).map((x) => (
                <li key={x.id}>
                  <span>{label(x)}</span>
                  <b>{money(Number(x.amount), currency)}</b>
                </li>
              ))}
              {r.fixed.length > 6 && <li className="rp-more">{t("+{n} more", { n: r.fixed.length - 6 })}</li>}
              <li className="rp-total">
                <span>{t("Total")}</span>
                <b>{money(r.fixedTotal, currency)}</b>
              </li>
            </ul>
          </div>
          <div className="rp-block">
            <h3>{t("Biggest expenses")}</h3>
            <ul className="rp-list">
              {r.biggest.map((x) => (
                <li key={x.id}>
                  <span>
                    {label(x)} <small>{dayMonth(new Date(x.date))}</small>
                  </span>
                  <b>{money(Number(x.amount), currency)}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <Foot page={1} pages={2}>
        <span>{t("Equity at the end of {month}", { month: monthName(r.month) })}</span>
        <b>{money(r.equity, currency)}</b>
        {Math.abs(r.equityChange) >= 0.5 && <small data-good={r.equityChange >= 0 ? "1" : "0"}>{money(r.equityChange, currency, { signed: true })}</small>}
      </Foot>
    </section>
  );
}

/** Grouped bars: income and spending per month. */
function MonthsChart({ months, currency }: { months: ReportMonth[]; currency: string }) {
  const W = 1000, H = 165, top = 16, bottom = 24;
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.spent]));
  const slot = W / 12, bw = slot * 0.3;
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  return (
    <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Month by month")}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} className="rp-grid" />
      ))}
      <text x="0" y={y(max) - 4} className="rp-axis">{money(max, currency, { compact: true })}</text>
      {months.map((m, i) => {
        const x = i * slot + slot / 2, base = H - bottom;
        return (
          <g key={i} opacity={m.kind === "forecast" ? 0.35 : 1}>
            <rect x={x - bw - 1.5} y={y(m.income)} width={bw} height={Math.max(base - y(m.income), 0)} rx="3" className="rp-bar-in" />
            <rect x={x + 1.5} y={y(m.spent)} width={bw} height={Math.max(base - y(m.spent), 0)} rx="3" className="rp-bar-out" />
            <text x={x} y={H - 4} textAnchor="middle" className="rp-axis">{shortMonth(new Date(2026, i, 1))}</text>
          </g>
        );
      })}
    </svg>
  );
}

const signedPct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toLocaleString(intlLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`);

/** A holding's month in a few pixels: its value from the first day to the last. */
function Spark({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <svg className="rp-spark" viewBox="0 0 120 26" />;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 116 + 2).toFixed(1)},${(22 - ((v - lo) / span) * 18).toFixed(1)}`);
  const c = up ? "#12a150" : "#e5484d";
  return (
    <svg className="rp-spark" viewBox="0 0 120 26" aria-hidden>
      <polyline points={`2,24 ${pts.join(" ")} 118,24`} fill={c} opacity="0.12" stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** The money on the accounts through the month, with its lowest day. */
function LiquidityLine({ start, days, total, currency }: { start: number; days: number[]; total: number; currency: string }) {
  const W = 500, H = 120, pad = 10;
  const vals = [start, ...days];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => pad + (i / total) * (W - pad * 2);
  const y = (v: number) => pad + (H - pad * 2) * (1 - (v - lo) / span);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const low = days.reduce((m, v, i) => (v < days[m] ? i : m), 0);
  return (
    <svg className="rp-chart" viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={t("Liquidity")}>
      <defs>
        <linearGradient id="rp-liq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#40c8e0" stopOpacity="0.3" />
          <stop offset="1" stopColor="#40c8e0" stopOpacity="0" />
        </linearGradient>
      </defs>
      {lo < 0 && hi > 0 && <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="#e5484d" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />}
      <path d={`${line} L${x(vals.length - 1)},${H - pad} L${x(0)},${H - pad} Z`} fill="url(#rp-liq-fill)" />
      <path d={line} fill="none" stroke="#1592ad" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {days.length > 1 && (
        <>
          <circle cx={x(low + 1)} cy={y(days[low])} r="4" fill="#fff" stroke="#e5484d" strokeWidth="2" />
          <text x={Math.min(Math.max(x(low + 1), 50), W - 50)} y={Math.min(y(days[low]) + 17, H + 12)} textAnchor="middle" className="rp-axis">{t("lowest {amount}", { amount: money(days[low], currency) })}</text>
        </>
      )}
    </svg>
  );
}

/** Page 2 of the monthly report: your wealth — investments, accounts, balance sheet, benchmarks. */
export function WealthSheet({ w, month, data, who }: { w: WealthMonth; month: Date; data: FinanceData; who: string }) {
  const currency = data.profile.currency_code;
  const before = monthName(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const tone = (v: number | null) => (v == null ? undefined : v >= 0 ? "1" : "0");
  const rows: { label: string; now: number; then: number }[] = [
    { label: t("What you own"), now: w.sheet.assets, then: w.prev.assets },
    { label: t("What you owe"), now: w.sheet.debts, then: w.prev.debts },
    { label: t("Equity"), now: w.sheet.equity, then: w.prev.equity },
  ];
  return (
    <section className="rp-page">
      <Head kicker={t("Monthly report")} title={t("Your wealth · {month}", { month: monthYear(month) })} who={who} currency={currency} />
      <div className="rp-body">
        <div className="rp-kpis rp-kpis-4">
          <Kpi label={t("Equity")} value={money(w.sheet.equity, currency)} tone="kept" delta={delta(w.sheet.equity, w.prev.equity, currency, before)} deltaGood={w.sheet.equity >= w.prev.equity} note={signedPct(w.equityPct)} />
          <Kpi label={t("Investments")} value={money(w.invEnd, currency)} tone="plain" delta={w.holdings.length ? delta(w.invEnd, w.invStart, currency, before) : null} deltaGood={w.invEnd >= w.invStart} note={w.holdings.length ? signedPct(w.invPct) : undefined} />
          <Kpi label={t("On your accounts")} value={money(w.liqEnd, currency)} tone="in" delta={delta(w.liqEnd, w.liqStart, currency, before)} deltaGood={w.liqEnd >= w.liqStart} />
          <Kpi label={t("Equity growth from work")} value={w.fromWork == null ? "—" : pct(w.fromWork)} tone="plain" note={t("{work} from work · {investments} from investments", { work: money(w.work, currency), investments: money(w.invGain, currency) })} />
        </div>

        {w.holdings.length > 0 && (
          <div className="rp-block">
            <div className="rp-block-head">
              <h3>{t("Your investments this month")}</h3>
              {w.market?.month != null && <span className="rp-legend">{t("World market (MSCI World) {pct}", { pct: signedPct(w.market.month) })}</span>}
            </div>
            <ul className="rp-list rp-holdings">
              {w.holdings.slice(0, 6).map((x) => (
                <li key={x.holding.id}>
                  <span className="rp-h-name">{x.holding.name || x.holding.symbol} <small>{x.holding.symbol}</small></span>
                  <Spark values={x.series} up={(x.pct ?? 0) >= 0} />
                  <b>{money(x.end ?? 0, currency)}</b>
                  <em data-good={tone(x.pct)}>{signedPct(x.pct)}</em>
                </li>
              ))}
              {w.holdings.length > 6 && <li className="rp-more">{t("+{n} more", { n: w.holdings.length - 6 })}</li>}
              <li className="rp-total">
                <span>{t("Total")}</span>
                <span />
                <b>{money(w.invEnd, currency)}</b>
                <em data-good={tone(w.invPct)}>{signedPct(w.invPct)}</em>
              </li>
            </ul>
          </div>
        )}

        <div className="rp-cols">
          <div className="rp-block">
            <div className="rp-block-head"><h3>{t("On your accounts through the month")}</h3></div>
            <LiquidityLine start={w.liqStart} days={w.liquidity} total={w.days} currency={currency} />
          </div>
          <div className="rp-block">
            <h3>{t("Balance sheet")}</h3>
            <table className="rp-table rp-bs">
              <thead><tr><th /><th>{monthName(month)}</th><th>{t("vs {month}", { month: before })}</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.label} className={i === 2 ? "rp-bs-eq" : undefined}>
                    <td>{r.label}</td>
                    <td>{money(r.now, currency)}</td>
                    <td data-good={i === 1 ? (r.now <= r.then ? "1" : "0") : r.now >= r.then ? "1" : "0"}>{money(r.now - r.then, currency, { signed: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rp-block">
          <div className="rp-block-head"><h3>{t("Benchmarks")}</h3></div>
          <table className="rp-table rp-bench">
            <thead><tr><th /><th>{monthName(month)}</th><th>{t("{year} so far", { year: String(month.getFullYear()) })}</th></tr></thead>
            <tbody>
              <tr><td>{t("Your equity")}</td><td data-good={tone(w.equityPct)}>{signedPct(w.equityPct)}</td><td data-good={tone(w.equityYear)}>{signedPct(w.equityYear)}</td></tr>
              {w.holdings.length > 0 && <tr><td>{t("Your investments")}</td><td data-good={tone(w.invPct)}>{signedPct(w.invPct)}</td><td data-good={tone(w.invYear)}>{signedPct(w.invYear)}</td></tr>}
              <tr><td>{t("World market (MSCI World)")}</td><td data-good={tone(w.market?.month ?? null)}>{signedPct(w.market?.month ?? null)}</td><td data-good={tone(w.market?.year ?? null)}>{signedPct(w.market?.year ?? null)}</td></tr>
              <tr><td>{t("Savings rate")}</td><td>{w.savingsRate == null ? "—" : pct(w.savingsRate)}</td><td /></tr>
            </tbody>
          </table>
          <p className="rp-caption">{t("World market: the iShares MSCI World ETF (IWDA) in euros. A comparison, not advice.")}</p>
        </div>
      </div>
      <Foot page={2} pages={2}>
        <span>{t("Equity at the end of {month}", { month: monthName(month) })}</span>
        <b>{money(w.sheet.equity, currency)}</b>
        {w.equityPct != null && <small data-good={w.sheet.equity >= w.prev.equity ? "1" : "0"}>{signedPct(w.equityPct)}</small>}
      </Foot>
    </section>
  );
}

/** Equity through the year, from where it started. */
function EquityLine({ start, months }: { start: number; months: number[] }) {
  const W = 500, H = 105, pad = 8;
  const vals = [start, ...months];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = vals.map((v, i) => [pad + (i / (vals.length - 1)) * (W - pad * 2), pad + (H - pad * 2) * (1 - (v - lo) / span)] as const);
  const line = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" ");
  return (
    <svg className="rp-chart rp-eq" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Equity")}>
      <defs>
        <linearGradient id="rp-eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14b8a6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rp-eq-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6e5bea" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <path d={`${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`} fill="url(#rp-eq-fill)" />
      <path d={line} fill="none" stroke="url(#rp-eq-line)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="5" fill="#14b8a6" />
    </svg>
  );
}

/** Month by month: your equity's growth beside the world market's, around zero. */
function GrowthBars({ rows }: { rows: { a: number | null; b: number | null }[] }) {
  const W = 500, H = 105, pad = 26, base = 8;
  const vals = rows.flatMap((r) => [r.a ?? 0, r.b ?? 0]);
  const top = Math.max(...vals, 0.01), bottom = Math.min(...vals, -0.01), span = top - bottom;
  const y = (v: number) => base + (H - base * 2) * ((top - v) / span);
  const slot = (W - pad) / 12, bw = slot * 0.3;
  return (
    <svg className="rp-chart" viewBox={`0 0 ${W} ${H + 16}`} role="img" aria-label={t("Benchmarks")}>
      <line x1={pad} x2={W} y1={y(0)} y2={y(0)} className="rp-base" />
      <text x={pad - 4} y={y(top) + 4} textAnchor="end" className="rp-axis rp-axis-s">{`${Math.round(top * 100)}%`}</text>
      <text x={pad - 4} y={y(bottom) + 4} textAnchor="end" className="rp-axis rp-axis-s">{`${Math.round(bottom * 100)}%`}</text>
      {Array.from({ length: 12 }, (_, i) => {
        const r = rows[i], x = pad + i * slot + slot / 2;
        const bar = (v: number | null, dx: number, fill: string) =>
          v == null ? null : <rect x={x + dx} y={Math.min(y(v), y(0))} width={bw} height={Math.max(Math.abs(y(v) - y(0)), 1)} rx="2" fill={fill} />;
        return (
          <g key={i}>
            {r && bar(r.a, -bw - 1, r.a != null && r.a < 0 ? "#e5484d" : "#14b8a6")}
            {r && bar(r.b, 1, "#c9c9d6")}
            <text x={x} y={H + 12} textAnchor="middle" className="rp-axis rp-axis-s">{shortMonth(new Date(2000, i, 1))}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** A value at the end of each month of the year so far, from where it started. */
function YearLine({ start, values, color }: { start: number; values: number[]; color: string }) {
  const W = 500, H = 100, pad = 8;
  const vals = [start, ...values];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => pad + (i / 12) * (W - pad * 2);
  const y = (v: number) => pad + (H - pad * 2) * (1 - (v - lo) / span);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const id = `rp-yl-${color.slice(1)}`;
  return (
    <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {lo < 0 && hi > 0 && <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="#e5484d" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />}
      <path d={`${line} L${x(vals.length - 1)},${H} L${x(0)},${H} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r="4.5" fill={color} />
    </svg>
  );
}

/** Page 3 of the annual report: your wealth month by month against the world market. */
function YearWealthSheet({ w, year, currency, who }: { w: WealthYear; year: number; currency: string; who: string }) {
  const tone = (v: number | null) => (v == null ? undefined : v >= 0 ? "1" : "0");
  const invStart = w.months[0] ? w.months[0].inv / (1 + (w.months[0].invPct ?? 0)) : 0;
  return (
    <section className="rp-page">
      <Head kicker={t("Annual report")} title={t("Your wealth · {month}", { month: String(year) })} who={who} currency={currency} />
      <div className="rp-body">
        <div className="rp-kpis rp-kpis-4">
          <Kpi label={t("Your equity")} value={signedPct(w.equityYear)} tone="kept" note={t("{year} so far", { year: String(year) })} />
          <Kpi label={t("Your investments")} value={w.hasInv ? signedPct(w.invYear) : "—"} tone="plain" note={t("{year} so far", { year: String(year) })} />
          <Kpi label={t("World market (MSCI World)")} value={signedPct(w.marketYear)} tone="plain" note={t("{year} so far", { year: String(year) })} />
          <Kpi label={t("On your accounts")} value={money(w.months.at(-1)?.liq ?? w.liqStart, currency)} tone="in" delta={w.months.length ? delta(w.months.at(-1)!.liq, w.liqStart, currency, monthName(new Date(year, 0, 1))) : null} deltaGood={(w.months.at(-1)?.liq ?? 0) >= w.liqStart} />
        </div>

        <div className="rp-block">
          <div className="rp-block-head">
            <h3>{t("Your equity against the world market, per month")}</h3>
            <span className="rp-legend">
              <i style={{ background: "#14b8a6" }} /> {t("Your equity")} <i style={{ background: "#c9c9d6" }} /> {t("World market (MSCI World)")}
            </span>
          </div>
          <GrowthBars rows={w.months.map((m) => ({ a: m.equityPct, b: m.market }))} />
        </div>

        <div className="rp-cols">
          {w.hasInv && (
            <div className="rp-block">
              <h3>{t("Your investments")}</h3>
              <YearLine start={invStart} values={w.months.map((m) => m.inv)} color="#6e5bea" />
            </div>
          )}
          <div className="rp-block">
            <h3>{t("On your accounts")}</h3>
            <YearLine start={w.liqStart} values={w.months.map((m) => m.liq)} color="#1592ad" />
          </div>
        </div>

        <div className="rp-block">
          <h3>{t("Per month")}</h3>
          <table className="rp-table rp-bench">
            <thead>
              <tr>
                <th />
                <th>{t("Equity")}</th>
                <th>{t("Your equity")}</th>
                {w.hasInv && <th>{t("Your investments")}</th>}
                <th>{t("World market (MSCI World)")}</th>
                <th>{t("On your accounts")}</th>
              </tr>
            </thead>
            <tbody>
              {w.months.map((m) => (
                <tr key={m.m}>
                  <td>{monthName(new Date(year, m.m, 1))}</td>
                  <td>{money(m.equity, currency)}</td>
                  <td data-good={tone(m.equityPct)}>{signedPct(m.equityPct)}</td>
                  {w.hasInv && <td data-good={tone(m.invPct)}>{signedPct(m.invPct)}</td>}
                  <td data-good={tone(m.market)}>{signedPct(m.market)}</td>
                  <td>{money(m.liq, currency)}</td>
                </tr>
              ))}
              <tr className="rp-bs-eq">
                <td>{t("{year} so far", { year: String(year) })}</td>
                <td>{money(w.months.at(-1)?.equity ?? 0, currency)}</td>
                <td data-good={tone(w.equityYear)}>{signedPct(w.equityYear)}</td>
                {w.hasInv && <td data-good={tone(w.invYear)}>{signedPct(w.invYear)}</td>}
                <td data-good={tone(w.marketYear)}>{signedPct(w.marketYear)}</td>
                <td>{money(w.months.at(-1)?.liq ?? w.liqStart, currency)}</td>
              </tr>
            </tbody>
          </table>
          <p className="rp-caption">{t("World market: the iShares MSCI World ETF (IWDA) in euros. A comparison, not advice.")}</p>
        </div>
      </div>
      <Foot page={3} pages={3} />
    </section>
  );
}

/** A month on the annual report: booked, this month live (so far), or a
 *  month ahead as the forecast. */
export type ReportMonth = { income: number; spent: number; kind?: "booked" | "live" | "forecast" };

export function YearSheets({ y, months, data, who, wealth }: { y: YearCloseData; months: ReportMonth[]; data: FinanceData; who: string; wealth?: WealthYear }) {
  const pages = wealth?.months.length ? 3 : 2;
  const currency = data.profile.currency_code;
  const w = y.wrap;
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const monthOf = (i: number) => monthName(new Date(y.year, i, 1));
  const last = w.lastYear;
  const tax = y.tax;
  return (
    <>
      <section className="rp-page">
        <Head kicker={t("Annual report")} title={String(y.year)} who={who} currency={currency} />
        <div className="rp-body">
          <div className="rp-kpis rp-kpis-4">
            <Kpi label={t("Income")} value={money(w.income, currency)} tone="in" delta={last ? delta(w.income, last.income, currency, String(y.year - 1)) : null} deltaGood={!last || w.income >= last.income} />
            <Kpi label={t("Spent")} value={money(w.spent, currency)} tone="out" delta={last ? delta(w.spent, last.spent, currency, String(y.year - 1)) : null} deltaGood={!last || w.spent <= last.spent} />
            <Kpi label={t("Kept aside")} value={money(w.saved, currency, { signed: true })} tone="kept" delta={last ? delta(w.saved, last.saved, currency, String(y.year - 1)) : null} deltaGood={!last || w.saved >= last.saved} />
            <Kpi label={t("Savings rate")} value={pct(Math.max(w.savingsRate, 0))} tone="plain" note={t("goal {pct}", { pct: pct(SAVINGS_GOAL) })} />
          </div>

          <div className="rp-block">
            <div className="rp-block-head">
              <h3>{t("Month by month")}</h3>
              <span className="rp-legend">
                <i className="rp-l-in" /> {t("Income")} <i className="rp-l-out" /> {t("Spent")}
              </span>
            </div>
            <MonthsChart months={months} currency={currency} />
          </div>

          <div className="rp-cols">
            <div className="rp-block">
              <h3>{t("Equity")}</h3>
              <EquityLine start={w.equityStart} months={w.equityByMonth} />
              <p className="rp-caption">
                {money(w.equityStart, currency)} → <b>{money(w.equityEnd, currency)}</b>{" "}
                <span data-good={w.equityChange >= 0 ? "1" : "0"} className="rp-chg">({money(w.equityChange, currency, { signed: true })})</span>
              </p>
            </div>
            <div className="rp-block">
              <h3>{t("Where it went")}</h3>
              <div className="rp-shares">
                {w.top.map((c) => {
                  const cat = cats.get(c.id);
                  return (
                    <div key={c.id} className="rp-share">
                      <span className="rp-cat-name">
                        <i style={{ background: `#${cat?.color_hex ?? "888888"}` }} />
                        {cat?.name ?? "—"}
                      </span>
                      <span className="rp-cat-track">
                        <span className="rp-cat-fill" style={{ width: `${Math.max(c.share, 0.02) * 100}%`, background: `#${cat?.color_hex ?? "888888"}` }} />
                      </span>
                      <b>{money(c.spent, currency)}</b>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rp-highlights">
            {w.best && (
              <div>
                <small>{t("Best month")}</small>
                <b>{monthOf(w.best.i)}</b>
                <span>{money(w.best.saved, currency, { signed: true })}</span>
              </div>
            )}
            {w.toughest && (
              <div>
                <small>{t("Toughest month")}</small>
                <b>{monthOf(w.toughest.i)}</b>
                <span>{money(w.toughest.saved, currency, { signed: true })}</span>
              </div>
            )}
            <div>
              <small>{t("Months in the plus")}</small>
              <b>{t("{n} of {total}", { n: w.plusMonths, total: w.activeMonths })}</b>
            </div>
            <div>
              <small>{t("Days without spending")}</small>
              <b>{w.facts.noSpend}</b>
            </div>
          </div>

          <div className="rp-block">
            <h3>{t("Per month")}</h3>
            <table className="rp-table">
              <thead>
                <tr>
                  <th />
                  <th>{t("Income")}</th>
                  <th>{t("Spent")}</th>
                  <th>{t("Kept aside")}</th>
                  <th>{t("Savings rate")}</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => {
                  const kept = m.income - m.spent, any = m.income > 0 || m.spent > 0;
                  return (
                    <tr key={i} data-empty={any ? "0" : "1"} data-kind={m.kind ?? "booked"}>
                      <td>
                        {monthOf(i)}
                        {m.kind === "live" && <span className="rp-tag">{t("so far")}</span>}
                        {m.kind === "forecast" && <span className="rp-tag">{t("expected")}</span>}
                      </td>
                      <td>{any ? money(m.income, currency) : "—"}</td>
                      <td>{any ? money(m.spent, currency) : "—"}</td>
                      <td data-good={kept >= 0 ? "1" : "0"}>{any ? money(kept, currency, { signed: true }) : "—"}</td>
                      <td>{any && m.income > 0 ? pct(kept / m.income) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <Foot page={1} pages={pages}>
          <span>{t("Equity at the end of {year}", { year: y.year })}</span>
          <b>{money(w.equityEnd, currency)}</b>
        </Foot>
      </section>

      <section className="rp-page">
        <header className="rp-head rp-head-slim">
          <div className="rp-head-l">
            <span className="rp-kicker">
              {t("Annual report")} · {y.year}
            </span>
            <h1>{t("For your tax return")}</h1>
            <span className="rp-sub">{t("What you own and owe on 31 December {year}.", { year: y.year })}</span>
          </div>
          <div className="rp-brand">
            <BrandMark size={40} currency={currency} />
          </div>
        </header>
        <div className="rp-body">
          <div className="rp-cols">
            <div className="rp-block">
              <h3>{t("What you own")}</h3>
              <ul className="rp-list">
                {tax.assets.slice(0, 9).map((l) => (
                  <li key={l.id}>
                    <span>{l.name}</span>
                    <b>{money(l.value, currency)}</b>
                  </li>
                ))}
                <li className="rp-total">
                  <span>{t("Total")}</span>
                  <b>{money(tax.totalAssets, currency)}</b>
                </li>
              </ul>
            </div>
            <div className="rp-block">
              <h3>{t("What you owe")}</h3>
              <ul className="rp-list">
                {tax.liabilities.length ? (
                  tax.liabilities.slice(0, 9).map((l) => (
                    <li key={l.id}>
                      <span>{l.name}</span>
                      <b>{money(l.value, currency)}</b>
                    </li>
                  ))
                ) : (
                  <li className="rp-more">{t("No debts")}</li>
                )}
                <li className="rp-total">
                  <span>{t("Total")}</span>
                  <b>{money(tax.totalDebt, currency)}</b>
                </li>
              </ul>
            </div>
          </div>

          <div className="rp-equity-band">
            <span>{t("Equity on 31 December {year}", { year: y.year })}</span>
            <b>{money(tax.equity, currency)}</b>
          </div>

          <div className="rp-kpis rp-kpis-4">
            <Kpi label={t("Net income")} value={money(tax.net, currency)} tone="in" />
            {tax.grossKnown && <Kpi label={t("Gross income")} value={money(tax.gross, currency)} tone="plain" />}
            {tax.hasHome && <Kpi label={t("Mortgage interest paid")} value={money(tax.mortgageInterest, currency)} tone="plain" />}
            <Kpi label={t("Payslips kept")} value={t("{n} of 12", { n: tax.payslips })} tone="plain" />
          </div>

          {y.accounts.length > 0 && (
            <div className="rp-block">
              <h3>{t("Your accounts on 31 December")}</h3>
              <ul className="rp-list rp-list-2">
                {y.accounts.slice(0, 10).map((a) => (
                  <li key={a.account.id}>
                    <span>{a.account.name}</span>
                    <b>{money(a.proposed, currency)}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {y.costs.fixed.length > 0 && (
            <div className="rp-block">
              <div className="rp-block-head">
                <h3>{t("Fixed costs per category")}</h3>
                <span className="rp-legend">
                  {y.year} · {y.year - 1}
                </span>
              </div>
              <ul className="rp-list rp-list-3">
                {y.costs.fixed.slice(0, 10).map((f) => {
                  const ch = f.before ? f.spent / f.before - 1 : null;
                  return (
                    <li key={f.category?.id ?? "none"}>
                      <span>{f.category?.name ?? t("Other")}</span>
                      <b>{money(f.spent, currency)}</b>
                      <small data-good={ch != null && ch <= 0 ? "1" : "0"}>{f.before ? `${money(f.before, currency)} · ${ch! > 0 ? "+" : ""}${Math.round(ch! * 100)}%` : "—"}</small>
                    </li>
                  );
                })}
                <li className="rp-total">
                  <span>{t("Total")}</span>
                  <b>{money(y.costs.fixedTotal, currency)}</b>
                  <small>{y.costs.fixedBeforeTotal != null ? money(y.costs.fixedBeforeTotal, currency) : ""}</small>
                </li>
              </ul>
            </div>
          )}

          <p className="rp-disclaimer">{t("Not tax advice: these are the figures from your own books. Check them against your bank's annual statements and your annual salary statement.")}</p>
        </div>
        <Foot page={2} pages={pages} />
      </section>
      {wealth && pages === 3 && <YearWealthSheet w={wealth} year={y.year} currency={currency} who={who} />}
    </>
  );
}
