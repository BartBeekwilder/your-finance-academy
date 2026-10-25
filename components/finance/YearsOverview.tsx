"use client";

import { t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { yearForecast } from "@/lib/finance/calc";
import { historyBack, yearTotals, type YearTotal } from "@/lib/finance/compare";
import { money } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";

// The dashboard's Years view, in place of the live Month / Year tiles:
// income, spending and balance per calendar year. This year shows what's
// entered so far as a solid bar and the forecast for the rest of the year as
// a dashed cap. Earlier years use imported year totals where there are no
// transactions, and samples only for years with no data at all
// (lib/finance/compare). Pointing at a bar reads it out.

const GREEN = "#30d158", RED = "#ff453a", BLUE = "#0a84ff";

type Row = { key: "income" | "spent" | "balance"; title: string; color: string };

export default function YearsOverview({ data, now, currency, back: backProp }: { data: FinanceData; now: Date; currency: string; back?: number }) {
  // As far back as the history goes (at least four years; samples fill in).
  const back = backProp ?? historyBack(data, now, 4);
  const years = useMemo(() => yearTotals(data, now, yearForecast(data, now), { back, sample: true }), [data, now, back]);
  const first = years[0].year, last = years[years.length - 1].year;
  const rows: Row[] = [
    { key: "income", title: t("Income"), color: GREEN },
    { key: "spent", title: t("Spent"), color: RED },
    { key: "balance", title: t("Balance"), color: BLUE },
  ];
  return (
    <div className="pf-card pf-yrs" style={{ overflow: "hidden", display: "grid", gridTemplateRows: "repeat(3, 1fr)" }}>
      {rows.map((r) => (
        <YearsRow key={r.key} row={r} years={years} currency={currency} span={`${first}–${last}`} />
      ))}
    </div>
  );
}

function parts(y: YearTotal, key: Row["key"]) {
  if (key === "income") return { done: y.income, ahead: y.incomeAhead };
  if (key === "spent") return { done: y.spent, ahead: y.spentAhead };
  return { done: y.income - y.spent, ahead: y.incomeAhead - y.spentAhead };
}

function YearsRow({ row, years, currency, span }: { row: Row; years: YearTotal[]; currency: string; span: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = years.map((y) => parts(y, row.key));
  const totals = vals.map((v) => v.done + v.ahead);
  const cur = years.length - 1;
  const expected = totals[cur];
  const prev = totals[cur - 1];
  const change = prev ? (expected - prev) / Math.abs(prev) : null;
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  const total = totals.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...vals.map((v) => Math.max(Math.abs(v.done), Math.abs(v.done + v.ahead))));
  const neg = vals.some((v) => v.done + v.ahead < 0 || v.done < 0);
  // With negative years (balance), zero sits in the middle.
  const zero = neg ? 50 : 100;
  const scale = neg ? 50 : 100;
  const good = row.key === "spent" ? (change ?? 0) <= 0 : (change ?? 0) >= 0;
  const sel = hover ?? cur;
  const s = vals[sel];
  const color = row.key === "balance" ? (expected >= 0 ? BLUE : RED) : row.color;

  return (
    <div className="pf-yrs-row" style={{ ["--c" as string]: color }}>
      <div className="pf-yrs-head">
        <span className="pf-yrs-title"><i style={{ background: color }} /> {row.title} · {span}</span>
        <span key={sel} className="pf-readout pf-yrs-read">
          <b>{years[sel].year}</b> {money(s.done + s.ahead, currency)}
          {s.ahead !== 0 && <em> · {t("{amount} so far", { amount: money(s.done, currency) })}</em>}
          {years[sel].sample && <em> · {t("sample")}</em>}
          {years[sel].yearly && <em> · {t("year total")}</em>}
          {row.key !== "spent" && years[sel].incomeMissing && <em> · {t("no income data")}</em>}
        </span>
      </div>
      <div className="pf-yrs-main">
        <div style={{ display: "grid", gap: 4, alignContent: "start" }}>
          <span className="pf-rounded pf-yrs-big" style={{ color }}>{money(expected, currency)}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{t("Expected this year")}</span>
          {change != null && Number.isFinite(change) && (
            <span className="pf-yrs-chip" data-good={good}>
              {change >= 0 ? "+" : "−"}{Math.abs(Math.round(change * 100))}% {t("vs {year}", { year: years[cur - 1].year })}
            </span>
          )}
        </div>
        <div className="pf-yrs-bars" onMouseLeave={() => setHover(null)}>
          {neg && <span className="pf-yrs-zero" />}
          {vals.map((v, i) => {
            const full = v.done + v.ahead;
            const h = (Math.abs(v.done) / max) * scale;
            const hAhead = (Math.abs(full) / max) * scale;
            const down = full < 0;
            return (
              <div key={years[i].year} className="pf-yrs-col" data-sel={i === sel} data-sample={years[i].sample} onMouseEnter={() => setHover(i)} style={{ ["--i" as string]: i }}>
                <div className="pf-yrs-track">
                  {v.ahead !== 0 && (
                    <span className="pf-yrs-bar pf-yrs-ahead" style={down ? { top: `${zero}%`, height: `${hAhead}%` } : { bottom: `${100 - zero}%`, height: `${hAhead}%` }} />
                  )}
                  <span
                    className="pf-yrs-bar"
                    style={{
                      ...(v.done < 0 ? { top: `${zero}%` } : { bottom: `${100 - zero}%` }),
                      height: `${h}%`,
                      background: row.key === "balance" ? (v.done < 0 ? RED : BLUE) : row.color,
                    }}
                  />
                </div>
                <span className="pf-yrs-label">{years.length > 6 && i !== sel && i !== 0 && i !== cur ? `’${String(years[i].year).slice(2)}` : years[i].year}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="pf-yrs-foot">
        {t("Average per year")} <b className="pf-rounded">{money(avg, currency)}</b> · {t("Total")} <b className="pf-rounded">{money(total, currency)}</b>
      </div>
    </div>
  );
}
