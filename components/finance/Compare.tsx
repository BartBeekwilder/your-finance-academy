"use client";

import { t } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { live } from "@/lib/finance/calc";
import { ALL, compareYears, cumulative, historyBack, spread, type YearRow } from "@/lib/finance/compare";
import { money, monthName, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import Segmented from "./Segmented";
import { WithYAxis } from "./YAxis";

// Comparing spending:
//   YearCompare  — one line per year over January…December for one category
//                  (or everything), per month or added up; this year bold and
//                  carried on dashed at the earlier years' average, the
//                  earlier years' range as a soft band behind it.
//   MonthCompare — one month against the same month last year (or the
//                  average of earlier years), per category, with the
//                  difference in green (less) or red (more).
// Earlier years without data show a sample (see lib/finance/compare.ts),
// marked as such, until real history is imported.

const THIS_YEAR = "#ff453a";
const PAST = ["#bf5af2", "#ff9f0a", "#64d2ff", "#30d158", "#ffd60a", "#ff6b9a", "#5e5ce6", "#a2845e", "#66d4cf", "#8e8e93", "#e8c547"];

/** A smooth line through the points (Catmull-Rom as cubic Béziers), kept
 *  above the baseline so it never dips below zero. */
function smooth(pts: [number, number][], floor: number) {
  if (pts.length < 2) return "";
  const c = (v: number) => Math.min(v, floor);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, c(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, c(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function niceTop(v: number) {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 1)));
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((k) => k * p >= v) ?? 10) * p;
}

function useCategories(data: FinanceData) {
  return useMemo(
    () => live(data.categories).filter((c) => !c.is_income_category && !c.parent_id).sort((a, b) => a.sort_order - b.sort_order),
    [data.categories],
  );
}

export function YearCompare({ data, now, currency, initial }: { data: FinanceData; now: Date; currency: string; initial?: string | null }) {
  const categories = useCategories(data);
  const [key, setKey] = useState<string>(initial ?? ALL);
  const [view, setView] = useState<"month" | "sum">("month");
  // All years of history; the three before this one shown, older ones a
  // chip away.
  const back = historyBack(data, now, 3);
  const [hidden, setHidden] = useState<Set<number>>(() => new Set(Array.from({ length: Math.max(back - 3, 0) }, (_, i) => now.getFullYear() - 4 - i)));
  const [hover, setHover] = useState<number | null>(null);
  const all = useMemo(() => compareYears(data, now, { sample: true, back }), [data, now, back]);
  const rows = all.get(key) ?? all.get(ALL)!;
  const current = now.getMonth();
  const [mine, ...earlier] = rows;
  const shownEarlier = earlier.filter((r) => !hidden.has(r.year));
  const band = spread(shownEarlier);
  // This year carried on at the earlier years' average.
  const ahead: (number | null)[] = mine.values.map((v, m) => (m >= current ? (m === current ? v : (band[m]?.avg ?? null)) : null));
  const tf = (vals: (number | null)[]) => (view === "sum" ? cumulative(vals) : vals);
  const lines = [
    ...shownEarlier.map((r, i) => ({ r, vals: tf(r.values), color: PAST[earlier.indexOf(r) % PAST.length], i })),
  ];
  const mineVals = tf(mine.values);
  const aheadVals = view === "sum" ? (() => {
    let s = mineVals[current] ?? 0;
    return ahead.map((v, m) => (m < current ? null : m === current ? s : (s += v ?? 0)));
  })() : ahead;
  const bandVals = view === "sum"
    ? (() => {
        const sums = shownEarlier.map((r) => cumulative(r.values));
        return Array.from({ length: 12 }, (_, m) => {
          const vs = sums.map((s) => s[m]).filter((v): v is number => v != null);
          return vs.length ? { min: Math.min(...vs), max: Math.max(...vs), avg: vs.reduce((a, b) => a + b, 0) / vs.length } : null;
        });
      })()
    : band;

  const H = 220, W = 1000, P = 6;
  const max = niceTop(Math.max(1, ...[...lines.flatMap((l) => l.vals), ...mineVals, ...aheadVals, ...bandVals.map((b) => b?.max ?? 0)].filter((v): v is number => v != null)));
  const x = (m: number) => (m / 11) * W;
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const pts = (vals: (number | null)[]) => vals.map((v, m) => (v == null ? null : ([x(m), y(v)] as [number, number]))).filter((p): p is [number, number] => !!p);
  const bandPath = (() => {
    const ok = bandVals.map((b, m) => (b ? { m, ...b } : null)).filter((b): b is { m: number; min: number; max: number; avg: number } => !!b);
    if (ok.length < 2) return "";
    return `${ok.map((b, i) => `${i ? "L" : "M"}${x(b.m)},${y(b.max)}`).join(" ")} ${[...ok].reverse().map((b) => `L${x(b.m)},${y(b.min)}`).join(" ")} Z`;
  })();

  // Year to date against last year over the same months.
  const ytd = (r: YearRow) => r.values.slice(0, current + 1).reduce<number>((a, v) => a + (v ?? 0), 0);
  const last = earlier[0];
  const diff = last ? ytd(mine) - ytd(last) : null;
  const sel = hover ?? current;
  const name = key === ALL ? t("All expenses") : (categories.find((c) => c.id === key)?.name ?? "");
  const anySample = earlier.some((r) => r.sample.some(Boolean));

  return (
    <section className="pf-card pf-cmp" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div className="pf-cmp-head">
        <div style={{ display: "grid", gap: 2 }}>
          <span className="pf-cmp-title">{t("Year on year")} · {name}</span>
          {diff != null && (
            <span style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>
              {t("So far this year")} <b className="pf-rounded" style={{ color: "var(--pf-ink)" }}>{money(ytd(mine), currency)}</b> ·{" "}
              <b className="pf-rounded" style={{ color: diff <= 0 ? "var(--pf-green)" : "var(--pf-red)" }}>
                {money(Math.abs(diff), currency)} {diff <= 0 ? t("less") : t("more")}
              </b>{" "}
              {t("than {year} in the same months", { year: last.year })}
              {ytd(last) > 0 && ` (${diff <= 0 ? "−" : "+"}${Math.round(Math.abs(diff / ytd(last)) * 100)}%)`}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="pf-input pf-cmp-select" value={key} onChange={(e) => setKey(e.target.value)} aria-label={t("Category")}>
            <option value={ALL}>{t("All expenses")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Segmented size="sm" label={t("View")} value={view} onChange={setView} options={[{ value: "month", label: t("Per month") }, { value: "sum", label: t("Added up") }]} />
        </div>
      </div>

      <div className="pf-cmp-chips">
        <span className="pf-cmp-chip" data-on="true" style={{ ["--c" as string]: THIS_YEAR }}>
          <i /> {mine.year}
        </span>
        {earlier.map((r, i) => {
          const on = !hidden.has(r.year);
          const sample = r.sample.some(Boolean);
          const yearly = r.yearly.some(Boolean);
          return (
            <button
              key={r.year}
              type="button"
              className="pf-cmp-chip"
              data-on={on}
              style={{ ["--c" as string]: PAST[i % PAST.length] }}
              title={yearly ? t("From your imported year totals, spread evenly over the months") : undefined}
              onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(r.year)) n.delete(r.year); else n.add(r.year); return n; })}
            >
              <i /> {r.year}
              {sample && <em>{t("sample")}</em>}
              {yearly && !sample && <em>{t("year total")}</em>}
            </button>
          );
        })}
      </div>

      <div key={`${key}-${view}`} className="pf-readout pf-cmp-readout">
        <b>{monthName(new Date(now.getFullYear(), sel, 1))}</b>
        {[{ year: mine.year, v: sel <= current ? mineVals[sel] : aheadVals[sel], c: THIS_YEAR, f: sel > current }, ...lines.map((l) => ({ year: l.r.year, v: l.vals[sel], c: l.color, f: false }))].map((e) => (
          <span key={e.year} style={{ color: e.c }}>
            {e.year} {e.v == null ? "—" : `${e.f ? "≈ " : ""}${money(e.v, currency)}`}
          </span>
        ))}
      </div>

      <WithYAxis height={H} currency={currency} ticks={[0, 0.5, 1].map((f) => ({ value: max * f, at: (P + f * (H - 2 * P)) / H }))}>
        <div
          style={{ position: "relative", height: H }}
          onMouseLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.min(Math.max(Math.round(((e.clientX - r.left) / r.width) * 11), 0), 11));
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block", overflow: "visible" }} aria-hidden>
            {[0, 0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--pf-line)" vectorEffect="non-scaling-stroke" />)}
            {bandPath && <path d={bandPath} fill="rgba(255,255,255,0.05)" className="pf-cmp-band" />}
            {bandVals.some(Boolean) && (
              <path d={smooth(pts(bandVals.map((b) => b?.avg ?? null)), H - P)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} strokeDasharray="1 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            )}
            <g className="pf-tsl-draw">
              {lines.map((l) => (
                <path key={l.r.year} d={smooth(pts(l.vals), H - P)} fill="none" stroke={l.color} strokeWidth={2} strokeOpacity={l.r.sample.some(Boolean) ? 0.55 : 0.8} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              ))}
              <path d={smooth(pts(aheadVals), H - P)} fill="none" stroke={THIS_YEAR} strokeWidth={2.4} strokeDasharray="2 7" strokeLinecap="round" opacity={0.7} vectorEffect="non-scaling-stroke" />
              <path d={smooth(pts(mineVals), H - P)} fill="none" stroke={THIS_YEAR} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="pf-cmp-mine" />
            </g>
            <line x1={x(sel)} x2={x(sel)} y1={0} y2={H} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </svg>
          {[{ v: sel <= current ? mineVals[sel] : aheadVals[sel], c: THIS_YEAR }, ...lines.map((l) => ({ v: l.vals[sel], c: l.color }))]
            .filter((d) => d.v != null)
            .map((d, i) => (
              <span key={i} className="pf-tsl-pick" style={{ left: `${(x(sel) / W) * 100}%`, top: y(d.v!), ["--dot" as string]: d.c }} />
            ))}
        </div>
      </WithYAxis>
      <div className="pf-tsl-x" aria-hidden>
        {Array.from({ length: 12 }, (_, m) => (
          <span key={m} data-lit={m === sel} data-forecast={m > current} style={{ left: `${(x(m) / W) * 100}%`, ["--dot" as string]: "var(--pf-ink)" }}>
            {shortMonth(new Date(now.getFullYear(), m, 1))}
          </span>
        ))}
      </div>
      <div className="pf-cmp-legend">
        <span><i style={{ background: "rgba(255,255,255,0.12)" }} /> {t("Range of earlier years")}</span>
        <span><i className="pf-cmp-dots" /> {t("Their average")}</span>
        <span><i className="pf-cmp-dash" style={{ ["--c" as string]: THIS_YEAR }} /> {t("Rest of this year (forecast)")}</span>
        {anySample && <span style={{ fontStyle: "italic" }}>{t("Sample years: made from this year's numbers until you import your history")}</span>}
        {earlier.some((r) => r.yearly.some(Boolean)) && <span style={{ fontStyle: "italic" }}>{t("Earlier years: imported year totals, spread evenly over the months")}</span>}
      </div>
    </section>
  );
}

export function MonthCompare({ data, now, currency }: { data: FinanceData; now: Date; currency: string }) {
  const categories = useCategories(data);
  const current = now.getMonth();
  // The last finished month by default; this month can be picked ("so far").
  const [m, setM] = useState(Math.max(current - 1, 0));
  const [against, setAgainst] = useState<"last" | "avg">("last");
  const back = historyBack(data, now, 3);
  const all = useMemo(() => compareYears(data, now, { sample: true, back }), [data, now, back]);

  const valueFor = (key: string) => {
    const [mine, ...earlier] = all.get(key) ?? [];
    if (!mine) return null;
    const a = mine.values[m] ?? 0;
    const pool = against === "last" ? earlier.slice(0, 1) : earlier;
    const vs = pool.map((r) => r.values[m]).filter((v): v is number => v != null);
    const b = vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : 0;
    return { a, b, sample: pool.some((r) => r.sample[m]), yearly: pool.some((r) => r.yearly[m]) };
  };
  const total = valueFor(ALL);
  const lines = categories
    .map((c) => ({ c, v: valueFor(c.id) }))
    .filter((l): l is { c: (typeof categories)[number]; v: NonNullable<ReturnType<typeof valueFor>> } => !!l.v && (l.v.a > 0 || l.v.b > 0))
    .sort((p, q) => Math.max(q.v.a, q.v.b) - Math.max(p.v.a, p.v.b));
  const max = Math.max(1, ...lines.map((l) => Math.max(l.v.a, l.v.b)));
  const label = monthName(new Date(now.getFullYear(), m, 1));
  const otherLabel = against === "last" ? `${label} ${now.getFullYear() - 1}` : t("Average {month}", { month: label });
  const pct = (a: number, b: number) => (b > 0 ? `${a <= b ? "−" : "+"}${Math.round(Math.abs((a - b) / b) * 100)}%` : "");

  return (
    <section className="pf-card pf-cmp" style={{ padding: 16, display: "grid", gap: 14 }}>
      <div className="pf-cmp-head">
        <div className="pf-cmp-stepper">
          <button type="button" className="pf-icon-button" aria-label={t("Previous month")} disabled={m === 0} onClick={() => setM((v) => Math.max(v - 1, 0))}>
            <ChevronLeft size={16} />
          </button>
          <span key={m} className="pf-readout pf-cmp-title" style={{ minWidth: 150, textAlign: "center" }}>
            {label} {now.getFullYear()}
            {m === current && <small> · {t("so far")}</small>}
          </span>
          <button type="button" className="pf-icon-button" aria-label={t("Next month")} disabled={m >= current} onClick={() => setM((v) => Math.min(v + 1, current))}>
            <ChevronRight size={16} />
          </button>
        </div>
        <Segmented size="sm" label={t("Compare with")} value={against} onChange={setAgainst} options={[{ value: "last", label: t("Last year") }, { value: "avg", label: t("Average") }]} />
      </div>

      {total && (
        <div key={`${m}-${against}`} className="pf-readout pf-cmp-total">
          <span className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{money(total.a, currency)}</span>
          <span style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>
            <b className="pf-rounded" style={{ color: total.a <= total.b ? "var(--pf-green)" : "var(--pf-red)" }}>
              {money(Math.abs(total.a - total.b), currency)} {total.a <= total.b ? t("less") : t("more")} {pct(total.a, total.b)}
            </b>{" "}
            {t("than {other}", { other: otherLabel })} ({money(total.b, currency)}
            {total.sample ? ` · ${t("sample")}` : total.yearly ? ` · ${t("year total ÷ 12")}` : ""})
          </span>
        </div>
      )}

      <div key={`rows-${m}-${against}`} className="pf-cmp-rows">
        {lines.map(({ c, v }, i) => {
          const d = v.a - v.b;
          return (
            <div key={c.id} className="pf-cmp-row" style={{ ["--i" as string]: i }}>
              <span className="pf-cmp-name">{c.name}</span>
              <span className="pf-cmp-bars">
                <span className="pf-cmp-bar" style={{ width: `${(v.a / max) * 100}%`, background: `#${c.color_hex}` }} />
                <span className="pf-cmp-bar pf-cmp-bar-other" style={{ width: `${(v.b / max) * 100}%` }} />
              </span>
              <span className="pf-cmp-vals pf-rounded">
                <b>{money(v.a, currency)}</b>
                <span style={{ color: Math.abs(d) < 0.5 ? "var(--pf-ink-3)" : d < 0 ? "var(--pf-green)" : "var(--pf-red)" }}>
                  {Math.abs(d) < 0.5 ? t("same") : `${money(d, currency, { signed: true })} ${pct(v.a, v.b)}`}
                </span>
              </span>
            </div>
          );
        })}
        {!lines.length && <div style={{ color: "var(--pf-ink-2)" }}>{t("Nothing spent in this month or the one to compare with.")}</div>}
      </div>
      <div className="pf-cmp-legend">
        <span><i style={{ background: "var(--pf-ink-2)" }} /> {label} {now.getFullYear()}</span>
        <span><i style={{ background: "rgba(255,255,255,0.22)" }} /> {otherLabel}</span>
      </div>
    </section>
  );
}
