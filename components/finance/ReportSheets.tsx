"use client";

import { intlLocale, t } from "@/lib/i18n";
import { money, monthName, monthYear, shortMonth } from "@/lib/finance/format";
import type { MonthReport } from "@/lib/finance/monthReport";
import type { YearCloseData } from "@/lib/finance/yearCloseModel";
import type { FinanceData } from "@/lib/finance/types";
import BrandMark from "./BrandMark";

// The Premium reports as A4 sheets (app/app/report): a month on one page, a
// year on two (the year in numbers, then the figures for the tax return).
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
      <Foot page={1} pages={1}>
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

/** A month on the annual report: booked, this month live (so far), or a
 *  month ahead as the forecast. */
export type ReportMonth = { income: number; spent: number; kind?: "booked" | "live" | "forecast" };

export function YearSheets({ y, months, data, who }: { y: YearCloseData; months: ReportMonth[]; data: FinanceData; who: string }) {
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
        <Foot page={1} pages={2}>
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
        <Foot page={2} pages={2} />
      </section>
    </>
  );
}
