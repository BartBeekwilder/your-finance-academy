"use client";

import { Fragment } from "react";
import { intlLocale, t } from "@/lib/i18n";
import { money, monthName, monthYear, shortMonth } from "@/lib/finance/format";
import type { MonthReport } from "@/lib/finance/monthReport";
import type { YearCloseData } from "@/lib/finance/yearCloseModel";
import type { FinanceData } from "@/lib/finance/types";
import { balanceSheet, type BalanceLine } from "@/lib/finance/calc";
import { clockTime, duration, type MoneyClock as MoneyClockData } from "@/lib/finance/moneyClock";
import { useMoneyClock, useYearClock } from "./MoneyClock";
import { workCost, workHoursIn } from "@/lib/finance/workHours";
import { days1, workTime } from "./workTime";
import type { WealthMonth, WealthYear } from "@/lib/finance/wealthReport";
import BrandMark from "./BrandMark";

// The Premium reports as A4 sheets (app/app/report): a month on four pages
// (the month; your wealth and benchmarks; your money clock and accounts; the
// balance sheet line by line), a year on three (the year in numbers, the figures for the
// tax return, your wealth against the world market).
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
  const W = 1000, H = 200, top = 18, bottom = 52, left = 78;
  const peak = Math.max(1, ...r.perDay.map((d) => d.variable));
  // Four round steps up the y-axis (0, 250, 500, 750, 1000), each labelled.
  const raw = peak / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((f) => f * mag >= raw) ?? 10) * mag;
  const max = step * 4;
  const n = r.perDay.length, slot = (W - left) / n, bw = Math.max(4, slot * 0.62);
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
      {[1, 2, 3, 4].map((k) => (
        <line key={k} x1={left} x2={W} y1={y(step * k)} y2={y(step * k)} className="rp-grid" />
      ))}
      <line x1={left} x2={W} y1={base} y2={base} className="rp-base" />
      {[0, 1, 2, 3, 4].map((k) => (
        <text key={k} x={left - 10} y={y(step * k) + 4} textAnchor="end" className="rp-axis">{money(step * k, currency, { compact: true })}</text>
      ))}
      {r.perDay.map((d, i) => {
        const x = left + i * slot + (slot - bw) / 2, h = (base - top) * (d.variable / max);
        const isPeak = r.peak?.day === d.day;
        return (
          <g key={d.day}>
            {d.variable > 0 && <rect x={x} y={base - h} width={bw} height={h} rx="3" fill="url(#rp-var)" opacity={isPeak ? 1 : 0.82} />}
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
    <div className="rp-cats" data-many={rows.length > 8 || undefined}>
      {rows.map((r) => {
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
          <Kpi label={t("Income (net)")} value={money(r.income, currency)} tone="in" delta={r.prev.has ? delta(r.income, r.prev.income, currency, before) : null} deltaGood={r.income >= r.prev.income} />
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
      <Foot page={1} pages={4}>
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

/** Page 2 of the monthly report: your wealth — investments, accounts, balance sheet, benchmarks. */
export function WealthSheet({ w, month, data, who }: { w: WealthMonth; month: Date; data: FinanceData; who: string }) {
  const currency = data.profile.currency_code;
  const before = monthName(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const tone = (v: number | null) => (v == null ? undefined : v >= 0 ? "1" : "0");
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
              {w.holdings.map((x) => (
                <li key={x.holding.id}>
                  <span className="rp-h-name">{x.holding.name || x.holding.symbol} <small>{x.holding.symbol}</small></span>
                  <Spark values={x.series} up={(x.pct ?? 0) >= 0} />
                  <b>{money(x.end ?? 0, currency)}</b>
                  <em data-good={tone(x.pct)}>{signedPct(x.pct)}</em>
                </li>
              ))}
              <li className="rp-total">
                <span>{t("Total")}</span>
                <span />
                <b>{money(w.invEnd, currency)}</b>
                <em data-good={tone(w.invPct)}>{signedPct(w.invPct)}</em>
              </li>
            </ul>
          </div>
        )}

        <div className="rp-block">
          <div className="rp-block-head"><h3>{t("Benchmarks")}</h3></div>
          <table className="rp-table rp-bench">
            <thead><tr><th /><th>{monthName(month)}</th><th>{t("{year} so far", { year: String(month.getFullYear()) })}</th></tr></thead>
            <tbody>
              <tr><td>{t("Your equity")}</td><td data-good={tone(w.equityPct)}>{signedPct(w.equityPct)}</td><td data-good={tone(w.equityYear)}>{signedPct(w.equityYear)}</td></tr>
              {w.holdings.length > 0 && <tr><td>{t("Your investments")}</td><td data-good={tone(w.invPct)}>{signedPct(w.invPct)}</td><td data-good={tone(w.invYear)}>{signedPct(w.invYear)}</td></tr>}
              {w.hasShares && <tr><td>{t("Your shares")}</td><td data-good={tone(w.sharesPct)}>{signedPct(w.sharesPct)}</td><td data-good={tone(w.sharesYear)}>{signedPct(w.sharesYear)}</td></tr>}
              <tr><td>{t("World market (MSCI World)")}</td><td data-good={tone(w.market?.month ?? null)}>{signedPct(w.market?.month ?? null)}</td><td data-good={tone(w.market?.year ?? null)}>{signedPct(w.market?.year ?? null)}</td></tr>
              <tr><td>{t("Savings rate")}</td><td>{w.savingsRate == null ? "—" : pct(w.savingsRate)}</td><td /></tr>
            </tbody>
          </table>
          <p className="rp-caption">{t("World market: the iShares MSCI World ETF (IWDA) in euros — compare it with your shares (crypto and metals left out). A comparison, not advice.")}</p>
        </div>
      </div>
      <Foot page={2} pages={4}>
        <span>{t("Equity at the end of {month}", { month: monthName(month) })}</span>
        <b>{money(w.sheet.equity, currency)}</b>
        {w.equityPct != null && <small data-good={w.sheet.equity >= w.prev.equity ? "1" : "0"}>{signedPct(w.equityPct)}</small>}
      </Foot>
    </section>
  );
}

/** The money on the accounts through the month: amounts up the side, days along the bottom, the lowest day marked. */
function LiquidityLine({ start, days, total, currency }: { start: number; days: number[]; total: number; currency: string }) {
  const W = 700, H = 135, left = 78, right = 10, top = 10, bottom = 24;
  const vals = [start, ...days];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => left + (i / total) * (W - left - right);
  const y = (v: number) => top + (H - top - bottom) * (1 - (v - lo) / span);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const low = days.reduce((m, v, i) => (v < days[m] ? i : m), 0);
  // Gridlines: the highest, the lowest, the middle — and zero when the line crosses it.
  const ticks = [hi, (hi + lo) / 2, lo, ...(lo < 0 && hi > 0 ? [0] : [])];
  const dayTicks = [1, 8, 15, 22, total].filter((d, i, a) => a.indexOf(d) === i && d <= total);
  const short = (v: number) => money(Math.round(v), currency).replace(/[.,]00(?=\D*$)/, "");
  return (
    <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("On your accounts through the month")}>
      <defs>
        <linearGradient id="rp-liq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#40c8e0" stopOpacity="0.3" />
          <stop offset="1" stopColor="#40c8e0" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className="rp-grid" stroke={v === 0 ? "#e5484d" : undefined} strokeDasharray={v === 0 ? "3 3" : undefined} />
          <text x={left - 8} y={y(v) + 4} textAnchor="end" className="rp-axis rp-axis-s">{short(v)}</text>
        </g>
      ))}
      <path d={`${line} L${x(vals.length - 1)},${H - bottom} L${x(0)},${H - bottom} Z`} fill="url(#rp-liq-fill)" />
      <path d={line} fill="none" stroke="#1592ad" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} className="rp-base" />
      {dayTicks.map((d) => (
        <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="rp-axis rp-axis-s">{d}</text>
      ))}
      {days.length > 1 && (
        <>
          <circle cx={x(low + 1)} cy={y(days[low])} r="4" fill="#fff" stroke="#e5484d" strokeWidth="2" />
          <text x={Math.min(Math.max(x(low + 1), left + 50), W - 60)} y={Math.max(y(days[low]) - 9, 12)} textAnchor="middle" className="rp-axis rp-axis-s rp-low">{t("lowest {amount}", { amount: money(days[low], currency) })}</text>
        </>
      )}
    </svg>
  );
}

/** The money clock, still and on paper: the month's income as 24 hours. */
function PrintClock({ clock, currency }: { clock: MoneyClockData; currency: string }) {
  const R = 100, Wd = 24, M = 130;
  const pt = (h: number, r: number) => {
    const a = ((h / 24) * 360 - 90) * (Math.PI / 180);
    return [M + r * Math.cos(a), M + r * Math.sin(a)];
  };
  const c = 2 * Math.PI * R;
  const arc = (key: string, from: number, hours: number, color: string) => (
    <circle key={key} cx={M} cy={M} r={R} fill="none" stroke={color} strokeWidth={Wd} strokeDasharray={`${Math.max((hours / 24) * c - 1.2, 0.1)} ${c}`} strokeDashoffset={-(from / 24) * c} transform={`rotate(-90 ${M} ${M})`} />
  );
  const kept = clock.keptFrom != null ? 24 - clock.keptFrom : 0;
  const end = clock.keptFrom ?? 24;
  const [hx1, hy1] = pt(end, R - Wd / 2 - 6), [hx2, hy2] = pt(end, R + Wd / 2 + 4);
  const dur = (h: number) => {
    const d = duration(h);
    return d.h ? t("{h} h {m} min", { h: d.h, m: d.m }) : t("{m} min", { m: d.m });
  };
  return (
    <div className="rp-clock">
      <div className="rp-clock-dial">
        <svg viewBox="0 0 260 260" aria-hidden>
          <circle cx={M} cy={M} r={R} fill="none" stroke="#f0f0f5" strokeWidth={Wd} />
          {Array.from({ length: 24 }, (_, h) => {
            const [x1, y1] = pt(h, R + Wd / 2 + 3), [x2, y2] = pt(h, R + Wd / 2 + (h % 6 ? 6 : 10));
            return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b5b8c6" strokeWidth={h % 6 ? 0.8 : 1.6} />;
          })}
          {[0, 6, 12, 18].map((h) => {
            const [x, y] = pt(h, R - Wd / 2 - 17);
            return <text key={h} x={x} y={y + 4} textAnchor="middle" className="rp-axis rp-axis-s">{clockTime(h)}</text>;
          })}
          {clock.slices.map((s) => arc(s.key, s.from, Math.min(s.hours, 24 - Math.min(s.from, 24)), s.color))}
          {kept > 0 && arc("kept", clock.keptFrom!, kept, "#22c55e")}
          <line x1={hx1} y1={hy1} x2={hx2} y2={hy2} stroke="#12131a" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="rp-clock-mid">
          {clock.keptFrom != null ? (
            <>
              <small>{t("You work for yourself from")}</small>
              <b>{clockTime(clock.keptFrom)}</b>
              <span>{t("{time} a day is yours", { time: dur(kept) })}</span>
            </>
          ) : (
            <>
              <small>{t("Your day ran out")}</small>
              <b style={{ color: "#d0353a" }}>+{dur(clock.overHours)}</b>
              <span>{t("spent beyond your income")}</span>
            </>
          )}
        </div>
      </div>
      <ul className="rp-clock-list">
        {clock.slices.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} />
            <span>{s.name}</span>
            <small>{clockTime(s.from)}–{clockTime(s.to)}</small>
            <b>{dur(s.hours)}</b>
            <em>{money(s.amount, currency)}</em>
          </li>
        ))}
        {kept > 0 && (
          <li className="rp-clock-kept">
            <i style={{ background: "#22c55e" }} />
            <span>{t("For yourself")}</span>
            <small>{clockTime(clock.keptFrom!)}–24:00</small>
            <b>{dur(kept)}</b>
            <em>{money(clock.kept, currency)}</em>
          </li>
        )}
      </ul>
    </div>
  );
}

/** One side of the balance sheet, each line with what it is made of. */
function BalanceSide({ title, lines, before, total, totalBefore, prevLabel, debt, currency }: { title: string; lines: BalanceLine[]; before: BalanceLine[]; total: number; totalBefore: number; prevLabel: string; debt?: boolean; currency: string }) {
  // Lines at zero (an empty post, nothing prepaid) say nothing on paper.
  const shown = lines.filter((l) => Math.abs(l.value) > 0.005);
  const was = new Map(before.map((l) => [l.id, l]));
  // Up is good for what you own, down is good for what you owe.
  const good = (d: number) => (Math.abs(d) < 0.005 ? undefined : (d > 0) !== !!debt ? "1" : "0");
  const change = (now: number, then: number | undefined) => {
    if (then == null) return <em />;
    const d = now - then;
    return <em data-good={good(d)}>{Math.abs(d) < 0.005 ? "—" : money(d, currency, { signed: true })}</em>;
  };
  return (
    <div className="rp-block">
      <h3>{title}</h3>
      <ul className="rp-list rp-bal">
        <li className="rp-bal-head"><span /><small>{t("Now")}</small><small>{t("vs {month}", { month: prevLabel })}</small></li>
        {shown.length === 0 && <li className="rp-more">{t("No debts")}</li>}
        {shown.map((l) => {
          const prev = was.get(l.id);
          const parts = new Map((prev?.parts ?? []).map((p) => [p.id, p.value]));
          return (
            <Fragment key={l.id}>
              <li>
                <span>{l.name}</span>
                <b>{money(l.value, currency)}</b>
                {change(l.value, prev?.value ?? 0)}
              </li>
              {(l.parts ?? []).filter((p) => Math.abs(p.value) > 0.005).map((p) => (
                <li key={p.id} className="rp-bal-part">
                  <span>{p.name}</span>
                  <small>{money(p.value, currency)}</small>
                  {change(p.value, parts.get(p.id))}
                </li>
              ))}
            </Fragment>
          );
        })}
        <li className="rp-total">
          <span>{t("Total")}</span>
          <b>{money(total, currency)}</b>
          {change(total, totalBefore)}
        </li>
      </ul>
    </div>
  );
}

/** Page 3 of the monthly report: your money clock and your accounts through the month. */
export function MoneySheet({ w, month, data, who }: { w: WealthMonth; month: Date; data: FinanceData; who: string }) {
  const currency = data.profile.currency_code;
  const clock = useMoneyClock(data, month);
  const cost = clock ? workCost(clock.income, w.days, clock.slices) : null;
  return (
    <section className="rp-page">
      <Head kicker={t("Monthly report")} title={t("Your money · {month}", { month: monthYear(month) })} who={who} currency={currency} />
      <div className="rp-body">
        <div className="rp-block">
          <div className="rp-block-head">
            <h3>{t("Your money clock")}</h3>
            {clock && <span className="rp-legend">{t("{income} came in: {perDay} a day.", { income: money(clock.income, currency), perDay: money(clock.income / w.days, currency) })}</span>}
          </div>
          {clock ? <PrintClock clock={clock} currency={currency} /> : <p className="rp-caption">{t("No income booked in {month} — the clock needs your income to fill the day.", { month: monthYear(month) })}</p>}
        </div>

        <div className="rp-block">
          <div className="rp-block-head"><h3>{t("On your accounts through the month")}</h3></div>
          <LiquidityLine start={w.liqStart} days={w.liquidity} total={w.days} currency={currency} />
        </div>

        {cost && cost.rows.length > 0 && (
          <div className="rp-block">
            <div className="rp-block-head">
              <h3>{t("What it cost you")}</h3>
              <span className="rp-legend">{t("An hour of your work: {work} net · an hour around the clock: {real}.", { work: money(cost.perWorkHour, currency), real: money(cost.perRealHour, currency) })}</span>
            </div>
            <div className="rp-kpis">
              <Kpi label={t("Work hours")} value={workTime(cost.total.workHours)} tone="out" note={t("{n} working days, at 40 hours a week", { n: days1(cost.total.workDays) })} />
              <Kpi label={t("Around the clock")} value={t("{n} days", { n: days1(cost.total.realDays) })} tone="plain" note={t("of the month's {days} days", { days: w.days })} />
              <Kpi label={t("For yourself")} value={t("{n} days", { n: days1(cost.freeDays) })} tone="in" />
            </div>
            <table className="rp-table">
              <thead><tr><th /><th>{t("Amount")}</th><th>{t("Work hours")}</th><th>{t("Around the clock")}</th></tr></thead>
              <tbody>
                {cost.rows.map((r) => (
                  <tr key={r.key}>
                    <td><i className="rp-dot" style={{ background: r.color }} />{r.name}</td>
                    <td>{money(r.amount, currency)}</td>
                    <td>{workTime(r.workHours)}</td>
                    <td>{workTime(r.realHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Foot page={3} pages={4} />
    </section>
  );
}

/** Page 2 of the annual report: the year's money clock — a year's income as
 *  one day of 24 hours — and what the year's spending cost in work hours
 *  (Bart, 19 Nov: "I don't see the clock" in the annual report). */
function YearMoneySheet({ data, year, now, who, page, pages }: { data: FinanceData; year: number; now: Date; who: string; page: number; pages: number }) {
  const currency = data.profile.currency_code;
  const { clock, days } = useYearClock(data, year, now);
  // A year's income: the work hours are the year's (so far), not a month's.
  const cost = clock ? workCost(clock.income, days, clock.slices, workHoursIn(days)) : null;
  return (
    <section className="rp-page">
      <Head kicker={t("Annual report")} title={t("Your money · {month}", { month: String(year) })} who={who} currency={currency} />
      <div className="rp-body">
        <div className="rp-block">
          <div className="rp-block-head">
            <h3>{t("Your money clock")}</h3>
            {clock && <span className="rp-legend">{t("{income} came in: {perDay} a day.", { income: money(clock.income, currency), perDay: money(clock.income / days, currency) })}</span>}
          </div>
          {clock ? <PrintClock clock={clock} currency={currency} /> : <p className="rp-caption">{t("No income booked in {month} — the clock needs your income to fill the day.", { month: String(year) })}</p>}
        </div>

        {cost && cost.rows.length > 0 && (
          <div className="rp-block">
            <div className="rp-block-head">
              <h3>{t("What it cost you")}</h3>
              <span className="rp-legend">{t("An hour of your work: {work} net · an hour around the clock: {real}.", { work: money(cost.perWorkHour, currency), real: money(cost.perRealHour, currency) })}</span>
            </div>
            <div className="rp-kpis">
              <Kpi label={t("Work hours")} value={workTime(cost.total.workHours)} tone="out" note={t("{n} working days, at 40 hours a week", { n: days1(cost.total.workDays) })} />
              <Kpi label={t("Around the clock")} value={t("{n} days", { n: days1(cost.total.realDays) })} tone="plain" note={t("of the year's {days} days", { days })} />
              <Kpi label={t("For yourself")} value={t("{n} days", { n: days1(cost.freeDays) })} tone="in" />
            </div>
            <table className="rp-table">
              <thead><tr><th /><th>{t("Amount")}</th><th>{t("Work hours")}</th><th>{t("Around the clock")}</th></tr></thead>
              <tbody>
                {cost.rows.map((r) => (
                  <tr key={r.key}>
                    <td><i className="rp-dot" style={{ background: r.color }} />{r.name}</td>
                    <td>{money(r.amount, currency)}</td>
                    <td>{workTime(r.workHours)}</td>
                    <td>{workTime(r.realHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Foot page={page} pages={pages} />
    </section>
  );
}

/** Page 4 of the monthly report: the balance sheet line by line, against the month before. */
export function BalanceSheetPage({ month, data, now, who }: { month: Date; data: FinanceData; now: Date; who: string }) {
  const currency = data.profile.currency_code;
  const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const sheet = balanceSheet(data, now, month);
  const prev = balanceSheet(data, now, prevMonth);
  const prevLabel = monthName(prevMonth);
  const d = sheet.equity - prev.equity;
  return (
    <section className="rp-page">
      <Head kicker={t("Monthly report")} title={t("Balance sheet · {month}", { month: monthYear(month) })} who={who} currency={currency} />
      <div className="rp-body">
        <BalanceSide title={t("What you own")} lines={sheet.assets} before={prev.assets} total={sheet.totalAssets} totalBefore={prev.totalAssets} prevLabel={prevLabel} currency={currency} />
        <BalanceSide title={t("What you owe")} lines={sheet.liabilities} before={prev.liabilities} total={sheet.totalDebt} totalBefore={prev.totalDebt} prevLabel={prevLabel} debt currency={currency} />
        <div className="rp-equity-band">
          <span>{t("Equity at the end of {month}", { month: monthName(month) })}</span>
          <b>{money(sheet.equity, currency)}</b>
        </div>
        <p className="rp-caption">{t("Change since the end of {month}", { month: prevLabel })}: <b className="rp-chg" data-good={d >= 0 ? "1" : "0"}>{money(d, currency, { signed: true })}</b></p>
      </div>
      <Foot page={4} pages={4} />
    </section>
  );
}

/** Equity through the year, from where it started. */
/** A value at the end of each month of the year, from where it started (31
 *  December before): amounts up the side, months along the bottom — like the
 *  monthly report's accounts chart (Bart, 19 Nov: "these need an x-y axis"). */
function YearAxisLine({ start, values, color, currency, id }: { start: number; values: number[]; color: string; currency: string; id: string }) {
  const W = 330, H = 112, left = 56, right = 8, top = 8, bottom = 18;
  const vals = [start, ...values];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => left + (i / 12) * (W - left - right);
  const y = (v: number) => top + (H - top - bottom) * (1 - (v - lo) / span);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = hi - lo < 0.5 ? [hi] : [hi, (hi + lo) / 2, lo, ...(lo < 0 && hi > 0 ? [0] : [])];
  const short = (v: number) => money(Math.round(v), currency).replace(/[.,]00(?=\D*$)/, "");
  return (
    <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className="rp-grid" stroke={v === 0 ? "#e5484d" : undefined} strokeDasharray={v === 0 ? "3 3" : undefined} />
          <text x={left - 6} y={y(v) + 4} textAnchor="end" className="rp-axis rp-axis-s">{short(v)}</text>
        </g>
      ))}
      <path d={`${line} L${x(vals.length - 1)},${H - bottom} L${x(0)},${H - bottom} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} className="rp-base" />
      {[0, 2, 4, 6, 8, 10].map((m) => (
        <text key={m} x={x(m + 1)} y={H - 6} textAnchor="middle" className="rp-axis rp-axis-s">{shortMonth(new Date(2000, m, 1))}</text>
      ))}
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r="4" fill={color} />
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

/** Page 3 of the annual report: your wealth month by month against the world market. */
function YearWealthSheet({ w, year, currency, who, page, pages }: { w: WealthYear; year: number; currency: string; who: string; page: number; pages: number }) {
  const tone = (v: number | null) => (v == null ? undefined : v >= 0 ? "1" : "0");
  const invStart = w.months[0] ? w.months[0].inv / (1 + (w.months[0].invPct ?? 0)) : 0;
  return (
    <section className="rp-page">
      <Head kicker={t("Annual report")} title={t("Your wealth · {month}", { month: String(year) })} who={who} currency={currency} />
      <div className="rp-body">
        <div className="rp-kpis rp-kpis-4">
          <Kpi label={t("Your equity")} value={signedPct(w.equityYear)} tone="kept" note={t("{year} so far", { year: String(year) })} />
          <Kpi label={w.hasShares ? t("Your shares") : t("Your investments")} value={w.hasShares ? signedPct(w.sharesYear) : w.hasInv ? signedPct(w.invYear) : "—"} tone="plain" note={t("{year} so far", { year: String(year) })} />
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
              <YearAxisLine start={invStart} values={w.months.map((m) => m.inv)} color="#6e5bea" currency={currency} id="rp-yl-inv" />
            </div>
          )}
          <div className="rp-block">
            <h3>{t("On your accounts")}</h3>
            <YearAxisLine start={w.liqStart} values={w.months.map((m) => m.liq)} color="#1592ad" currency={currency} id="rp-yl-liq" />
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
                {w.hasShares && <th>{t("Your shares")}</th>}
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
                  {w.hasShares && <td data-good={tone(m.sharesPct)}>{signedPct(m.sharesPct)}</td>}
                  <td data-good={tone(m.market)}>{signedPct(m.market)}</td>
                  <td>{money(m.liq, currency)}</td>
                </tr>
              ))}
              <tr className="rp-bs-eq">
                <td>{t("{year} so far", { year: String(year) })}</td>
                <td>{money(w.months.at(-1)?.equity ?? 0, currency)}</td>
                <td data-good={tone(w.equityYear)}>{signedPct(w.equityYear)}</td>
                {w.hasInv && <td data-good={tone(w.invYear)}>{signedPct(w.invYear)}</td>}
                {w.hasShares && <td data-good={tone(w.sharesYear)}>{signedPct(w.sharesYear)}</td>}
                <td data-good={tone(w.marketYear)}>{signedPct(w.marketYear)}</td>
                <td>{money(w.months.at(-1)?.liq ?? w.liqStart, currency)}</td>
              </tr>
            </tbody>
          </table>
          <p className="rp-caption">{t("World market: the iShares MSCI World ETF (IWDA) in euros. A comparison, not advice.")}</p>
        </div>
      </div>
      <Foot page={page} pages={pages} />
    </section>
  );
}

/** A month on the annual report: booked, this month live (so far), or a
 *  month ahead as the forecast. */
export type ReportMonth = { income: number; spent: number; kind?: "booked" | "live" | "forecast" };

export function YearSheets({ y, months, data, who, wealth, now }: { y: YearCloseData; months: ReportMonth[]; data: FinanceData; who: string; wealth?: WealthYear; now: Date }) {
  // 1 the year · 2 your money (clock) · 3 for your tax return · 4 your wealth (when there is any)
  const pages = wealth?.months.length ? 4 : 3;
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
            <Kpi label={t("Income (net)")} value={money(w.income, currency)} tone="in" delta={last ? delta(w.income, last.income, currency, String(y.year - 1)) : null} deltaGood={!last || w.income >= last.income} />
            <Kpi label={t("Spent")} value={money(w.spent, currency)} tone="out" delta={last ? delta(w.spent, last.spent, currency, String(y.year - 1)) : null} deltaGood={!last || w.spent <= last.spent} />
            <Kpi label={t("Kept aside")} value={money(w.saved, currency, { signed: true })} tone="kept" delta={last ? delta(w.saved, last.saved, currency, String(y.year - 1)) : null} deltaGood={!last || w.saved >= last.saved} />
            <Kpi label={t("Savings rate")} value={pct(Math.max(w.savingsRate, 0))} tone="plain" note={t("goal {pct}", { pct: pct(SAVINGS_GOAL) })} />
          </div>

          <div className="rp-block">
            <div className="rp-block-head">
              <h3>{t("Month by month")}</h3>
              <span className="rp-legend">
                <i className="rp-l-in" /> {t("Income (net)")} <i className="rp-l-out" /> {t("Spent")}
              </span>
            </div>
            <MonthsChart months={months} currency={currency} />
          </div>

          <div className="rp-cols">
            <div className="rp-block">
              <h3>{t("Equity")}</h3>
              <YearAxisLine start={w.equityStart} values={w.equityByMonth} color="#14b8a6" currency={currency} id="rp-yl-eq" />
              <p className="rp-caption">
                {money(w.equityStart, currency)} → <b>{money(w.equityEnd, currency)}</b>{" "}
                <span data-good={w.equityChange >= 0 ? "1" : "0"} className="rp-chg">({money(w.equityChange, currency, { signed: true })})</span>
              </p>
            </div>
            <div className="rp-block">
            <h3>{t("Where it went")}</h3>
            <div className="rp-shares" data-many={(w.all ?? w.top).length > 6 || undefined}>
              {(w.all ?? w.top).map((c) => {
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
                  <th>{t("Income (net)")}</th>
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

      <YearMoneySheet data={data} year={y.year} now={now} who={who} page={2} pages={pages} />

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
        <Foot page={3} pages={pages} />
      </section>
      {wealth && pages === 4 && <YearWealthSheet w={wealth} year={y.year} currency={currency} who={who} page={4} pages={4} />}
    </>
  );
}
