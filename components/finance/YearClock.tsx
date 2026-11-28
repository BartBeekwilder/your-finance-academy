"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { expectedByCategory, live, spendByCategory, summarize, yearForecast } from "@/lib/finance/calc";
import { cap, money } from "@/lib/finance/format";
import { dateOf, yearClock, yearTips, type YearClock as Clock, type YearRow, type YearTip } from "@/lib/finance/yearClock";
import type { FinanceData } from "@/lib/finance/types";
import { intlLocale, t } from "@/lib/i18n";
import Segmented from "./Segmented";

// The year clock (Bart, 28 Nov): the year's income as the whole year. Each
// cost takes the days its share takes, biggest first — "until 3 April you
// work for your home" — and from one day on you work for yourself. This
// year as expected: what's booked so far, the rest of the year as the
// forecast (the same expectation as Expenses). Tips: a variable cost cut
// back moves that day forward; pointing at a tip shows where it would land.

const KEPT = "#4ade80";
const OVER = "#ff453a";
const hex = (c: string | null | undefined) => (!c ? "#8e8e93" : c.startsWith("#") ? c : `#${c}`);

/** "20 Okt" / "Oct 20": the locale's order, the month with a capital. */
function dayMonth(d: Date) {
  return new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "short" })
    .formatToParts(d)
    .map((p) => (p.type === "month" ? cap(p.value) : p.value))
    .join("");
}

/** This year's income and spending per top category: finished months as
 *  booked, this month and the months ahead as expected. */
export function useYearRows(data: FinanceData, now: Date): { income: number; rows: YearRow[] } {
  const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  return useMemo(() => {
    const y = now.getFullYear(), cur = now.getMonth();
    const cats = new Map(live(data.categories).map((c) => [c.id, c]));
    const forecast = yearForecast(data, now);
    let income = 0;
    const by = new Map<string, number>();
    const add = (id: string, v: number) => by.set(id, (by.get(id) ?? 0) + v);
    for (let m = 0; m < 12; m++) {
      const month = new Date(y, m, 1);
      if (m < cur) {
        const s = summarize(data.transactions, month);
        income += s.income;
        let counted = 0;
        for (const e of spendByCategory(data, month)) { add(e.category.id, e.spent); counted += e.spent; }
        if (s.spent - counted > 0.5) add("", s.spent - counted);
      } else {
        income += forecast[m - cur]?.income ?? 0;
        for (const [id, e] of expectedByCategory(data, month, now)) if (e.expected > 0.005) add(id, e.expected);
      }
    }
    const rows: YearRow[] = [...by].map(([id, amount]) => {
      const c = cats.get(id);
      return c
        ? { key: id, name: c.name, color: hex(c.color_hex), amount, variable: !c.is_fixed_expense }
        : { key: "uncategorized", name: t("No category"), color: "#636366", amount, variable: true };
    });
    return { income, rows };
  }, [data, day]); // eslint-disable-line react-hooks/exhaustive-deps
}

const SIZE = 320, MID = SIZE / 2, R = 118, W = 26;
const xy = (frac: number, r: number) => {
  const a = frac * 2 * Math.PI - Math.PI / 2;
  return [MID + r * Math.cos(a), MID + r * Math.sin(a)] as const;
};

function Dial({ clock, today, preview, active, setActive }: { clock: Clock; today: number | null; preview: YearTip | null; active: string | null; setActive: (k: string | null) => void }) {
  const L = clock.length, C = 2 * Math.PI * R;
  const total = Math.min(clock.slices.reduce((a, s) => a + s.days, 0) + (clock.freeFrom != null ? L - clock.freeFrom : 0), 2 * L);
  const sweep = 2.8;
  const delay = (d: number) => `${(d / Math.max(total, L)) * sweep}s`;
  const dur = (d: number) => `${Math.max((d / Math.max(total, L)) * sweep, 0.12)}s`;
  const arc = (key: string, from: number, days: number, color: string, r = R, width = W, dim = false) => {
    const c = 2 * Math.PI * r;
    const len = Math.max((days / L) * c - 1.4, 0.1);
    return (
      <circle
        key={key}
        cx={MID} cy={MID} r={r} fill="none" stroke={color} strokeWidth={width}
        strokeDasharray={`${len} ${c}`} strokeDashoffset={-(from / L) * c}
        transform={`rotate(-90 ${MID} ${MID})`}
        className="pf-yc-arc"
        style={{ animationDelay: delay(from), animationDuration: dur(days), opacity: dim ? 0.28 : 1, ["--len" as string]: `${len}`, ["--c" as string]: `${c}` }}
        onPointerEnter={() => setActive(key)}
        onPointerLeave={() => setActive(null)}
      />
    );
  };
  const months = Array.from({ length: 12 }, (_, m) => {
    const d = new Date(clock.year, m, 1);
    const day = Math.round((d.getTime() - new Date(clock.year, 0, 1).getTime()) / 86_400_000);
    return { m, day, label: cap(d.toLocaleDateString(intlLocale(), { month: "narrow" })) };
  });
  const free = clock.freeFrom;
  const shown = clock.slices.find((s) => s.key === active);
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="pf-yc-dial" role="img" aria-label={t("Your year clock")}>
      <circle cx={MID} cy={MID} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={W} />
      {/* Month ticks and initials around the year. */}
      {months.map(({ m, day, label }) => {
        const [x1, y1] = xy(day / L, R + W / 2 + 2), [x2, y2] = xy(day / L, R + W / 2 + 8);
        const [lx, ly] = xy((day + 15) / L, R + W / 2 + 17);
        return (
          <g key={m}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
            <text x={lx} y={ly + 3.5} textAnchor="middle" className="pf-yc-month">{label}</text>
          </g>
        );
      })}
      {clock.slices.map((s) => arc(s.key, s.from, Math.min(s.days, Math.max(L - s.from, 0)), s.color, R, W, !!active && active !== s.key))}
      {free != null && arc("kept", free, L - free, KEPT, R, W, !!active && active !== "kept")}
      {/* Costs past New Year's Eve: a red ring outside, as far as they run on. */}
      {clock.overDays > 0 && arc("over", 0, Math.min(clock.overDays, L), OVER, R + W / 2 + 26, 5)}
      {/* Where a tip would move the day. */}
      {preview && preview.freeFrom != null && (() => {
        const [a1, b1] = xy(preview.freeFrom / L, R - W / 2 - 6), [a2, b2] = xy(preview.freeFrom / L, R + W / 2 + 6);
        return <line x1={a1} y1={b1} x2={a2} y2={b2} stroke={preview.color} strokeWidth={3} strokeLinecap="round" className="pf-yc-preview" />;
      })()}
      {/* Today. */}
      {today != null && (() => {
        const [a1, b1] = xy(today / L, R - W / 2 - 10), [a2, b2] = xy(today / L, R + W / 2 + 2);
        return (
          <g className="pf-yc-today">
            <line x1={a1} y1={b1} x2={a2} y2={b2} stroke="#fff" strokeWidth={1.6} />
            <circle cx={a1} cy={b1} r={3} fill="#fff" />
          </g>
        );
      })()}
      {/* The middle: the day you work for yourself — or what you point at. */}
      <foreignObject x={MID - 82} y={MID - 56} width={164} height={112}>
        <div className="pf-yc-mid">
          {shown ? (
            <>
              <span style={{ color: shown.color }}>{shown.name}</span>
              <b className="pf-rounded">{t("Until {date}", { date: dayMonth(dateOf(clock.year, Math.min(shown.to, L - 1))) })}</b>
              <small>{t("{n} days of work", { n: Math.round(shown.days) })}</small>
            </>
          ) : preview && preview.freeFrom != null ? (
            <>
              <span style={{ color: preview.color }}>{t("For yourself from")}</span>
              <b className="pf-rounded" style={{ color: preview.color }}>{dayMonth(dateOf(clock.year, preview.freeFrom))}</b>
              <small>{t("{n} days sooner", { n: Math.round(preview.daysSooner) })}</small>
            </>
          ) : free != null ? (
            <>
              <span>{t("For yourself from")}</span>
              <b className="pf-rounded" style={{ color: KEPT }}>{dayMonth(dateOf(clock.year, free))}</b>
              <small>{t("{n} days for yourself", { n: Math.round(L - free) })}</small>
            </>
          ) : (
            <>
              <span>{t("No day for yourself")}</span>
              <b className="pf-rounded" style={{ color: OVER }}>{t("+{n} days", { n: Math.round(clock.overDays) })}</b>
              <small>{t("Your costs run on into {year}", { year: String(clock.year + 1) })}</small>
            </>
          )}
        </div>
      </foreignObject>
    </svg>
  );
}

export function YearClockCard({ data, now, currency }: { data: FinanceData; now: Date; currency: string }) {
  const { income, rows } = useYearRows(data, now);
  const year = now.getFullYear();
  const clock = useMemo(() => yearClock(year, income, rows, { key: "rest", name: t("Small costs"), color: "#8e8e93" }), [year, income, rows]);
  const [cut, setCut] = useState<"0.1" | "0.25" | "0.5">("0.25");
  const tips = useMemo(() => (clock ? yearTips(clock, rows, Number(cut)) : []), [clock, rows, cut]);
  const [active, setActive] = useState<string | null>(null);
  const [tipOn, setTipOn] = useState<string | null>(null);
  const preview = tips.find((x) => x.key === tipOn) ?? null;
  const today = Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000);
  const pct = Math.round(Number(cut) * 100);

  return (
    <section className="pf-card pf-clk-card pf-yc">
      <div className="pf-clk-head">
        <div>
          <h2 className="pf-section-title" style={{ margin: 0 }}>{t("Your year clock")}</h2>
          <p>{t("This year's income as the whole year: until which day you work for each cost, biggest first — and from which day for yourself.")}</p>
        </div>
        <span className="pf-yc-year">{t("{year}, expected", { year: String(year) })}</span>
      </div>
      {!clock ? (
        <p className="pf-clk-empty">{t("No income expected this year yet — the year clock needs your income to fill the year.")}</p>
      ) : (
        <>
          <div className="pf-yc-body">
            <Dial clock={clock} today={today} preview={preview} active={active} setActive={setActive} />
            <ul className="pf-yc-rows">
              {clock.slices.map((s) => (
                <li key={s.key} data-on={active === s.key || undefined} onPointerEnter={() => setActive(s.key)} onPointerLeave={() => setActive(null)}>
                  <i style={{ background: s.color }} />
                  <span className="pf-yc-name">{s.name}</span>
                  <span className="pf-yc-dates">{dayMonth(dateOf(year, s.from))} – {dayMonth(dateOf(year, Math.min(s.to, clock.length - 1)))}</span>
                  <b className="pf-rounded">{t("{n} d", { n: Math.max(1, Math.round(s.days)) })}</b>
                </li>
              ))}
              {clock.freeFrom != null && (
                <li className="pf-yc-kept" data-on={active === "kept" || undefined} onPointerEnter={() => setActive("kept")} onPointerLeave={() => setActive(null)}>
                  <i style={{ background: KEPT }} />
                  <span className="pf-yc-name">{t("For yourself")}</span>
                  <span className="pf-yc-dates">{dayMonth(dateOf(year, clock.freeFrom))} – {dayMonth(new Date(year, 11, 31))}</span>
                  <b className="pf-rounded">{t("{n} d", { n: Math.round(clock.length - clock.freeFrom) })}</b>
                </li>
              )}
            </ul>
          </div>

          {tips.length > 0 && (
            <div className="pf-yc-tips">
              <div className="pf-yc-tips-head">
                <span><Sparkles size={14} /> {t("Sooner for yourself")}</span>
                <Segmented size="sm" label={t("Spend less")} value={cut} onChange={setCut} options={[{ value: "0.1", label: "−10%" }, { value: "0.25", label: "−25%" }, { value: "0.5", label: "−50%" }]} />
              </div>
              <div className="pf-yc-tiplist">
                {tips.map((tip) => (
                  <button
                    key={tip.key}
                    type="button"
                    className="pf-yc-tip"
                    style={{ ["--c" as string]: tip.color }}
                    data-on={tipOn === tip.key || undefined}
                    onPointerEnter={() => setTipOn(tip.key)}
                    onPointerLeave={() => setTipOn(null)}
                    onFocus={() => setTipOn(tip.key)}
                    onBlur={() => setTipOn(null)}
                    onClick={() => setTipOn(tipOn === tip.key ? null : tip.key)}
                  >
                    <b>{t("{pct}% less on {name}", { pct, name: tip.name })}</b>
                    <span>
                      {tip.freeFrom != null
                        ? t("saves {amount} this year — for yourself from {date}, {n} days sooner", { amount: money(tip.saves, currency), date: dayMonth(dateOf(year, tip.freeFrom)), n: Math.round(tip.daysSooner) })
                        : t("saves {amount} this year — {n} days fewer short", { amount: money(tip.saves, currency), n: Math.round(tip.daysSooner) })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <small className="pf-clk-foot">
            {t("{income} expected this year, {spent} expected costs. Booked up to today, the rest expected.", { income: money(clock.income, currency), spent: money(clock.spent, currency) })}
          </small>
        </>
      )}
    </section>
  );
}
