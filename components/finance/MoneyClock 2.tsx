"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n";
import { money, monthYear } from "@/lib/finance/format";
import { live, num, spendByCategory, spendByCategoryYear, summarize } from "@/lib/finance/calc";
import { clockTime, duration, moneyClock, type ClockRow, type MoneyClock as Clock } from "@/lib/finance/moneyClock";
import type { FinanceData } from "@/lib/finance/types";
import CategoryIcon from "./CategoryIcon";
import Segmented from "./Segmented";

// The money clock (Bart, 19 Nov): a month's income as one day of 24 hours,
// the biggest costs first, the rest is time for yourself. The dial draws
// itself slice by slice behind a sweeping hand; pointing at a slice (or its
// row) names it in the middle. Key figures shows a picker for the month;
// the Month Wrapped shows the wrapped month.

const KEPT = "#4ade80";
/** Category colours are stored with or without the "#". */
const hex = (c: string | null | undefined) => (!c ? "#8e8e93" : c.startsWith("#") ? c : `#${c}`);
const OVER = "#ff453a";

/** The month's clock from the books: income in, spending per top category. */
export function useMoneyClock(data: FinanceData, month: Date): Clock | null {
  return useMemo(() => {
    const s = summarize(data.transactions, month);
    const cats = spendByCategory(data, month);
    const rows: ClockRow[] = cats.map((c) => ({ key: c.category.id, name: c.category.name, color: hex(c.category.color_hex), amount: c.spent }));
    // Spending without a category still took its share of the day.
    const loose = s.spent - cats.reduce((a, c) => a + c.spent, 0);
    if (loose > 0.5) rows.push({ key: "uncategorized", name: t("No category"), color: "#636366", amount: loose });
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return moneyClock(s.income, rows, days, { key: "rest", name: t("Small costs"), color: "#8e8e93" });
  }, [data, month]);
}

const R = 118, W = 26, SIZE = 300, MID = SIZE / 2;
const angle = (h: number) => (h / 24) * 360 - 90;
const at = (h: number, r: number) => {
  const a = (angle(h) * Math.PI) / 180;
  return [MID + r * Math.cos(a), MID + r * Math.sin(a)];
};

export function ClockDial({ clock, currency, icons, compact = false }: { clock: Clock; currency: string; icons?: Map<string, { icon: string; color_hex: string }>; compact?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const total = Math.min(clock.slices.reduce((a, s) => a + s.hours, 0) + (clock.keptFrom != null ? 24 - clock.keptFrom : 0), 48);
  const sweep = 2.6; // seconds for the whole day
  const delay = (h: number) => `${(h / Math.max(total, 24)) * sweep}s`;
  const dur = (h: number) => `${Math.max((h / Math.max(total, 24)) * sweep, 0.12)}s`;
  const shown = clock.slices.find((s) => s.key === active);
  const keptHours = clock.keptFrom != null ? 24 - clock.keptFrom : 0;
  // The hand stops where the day turns yours — or where it ran out.
  const end = clock.keptFrom != null ? clock.keptFrom : Math.min(24 + clock.overHours, 48);

  const arc = (key: string, from: number, hours: number, color: string, r = R, width = W) => {
    const len = Math.max((hours / 24) * 2 * Math.PI * r - 1.2, 0.1);
    const c = 2 * Math.PI * r;
    return (
      <circle
        key={key}
        className="pf-clk-arc"
        cx={MID} cy={MID} r={r}
        fill="none" stroke={color} strokeWidth={width}
        strokeDashoffset={-(from / 24) * c}
        transform={`rotate(-90 ${MID} ${MID})`}
        data-dim={active && active !== key ? "" : undefined}
        style={{ ["--len" as string]: `${len}px`, ["--c" as string]: `${c}px`, animationDelay: delay(from), animationDuration: dur(hours) }}
        onMouseEnter={() => setActive(key)}
        onMouseLeave={() => setActive(null)}
      />
    );
  };

  return (
    <div className={`pf-clk${compact ? " pf-clk-compact" : ""}`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="pf-clk-svg" role="img" aria-label={t("Your money clock")}>
        <defs>
          <radialGradient id="pf-clk-face" cx="50%" cy="40%" r="60%">
            <stop offset="0" stopColor="rgba(255,255,255,0.07)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.01)" />
          </radialGradient>
        </defs>
        <circle cx={MID} cy={MID} r={R + W / 2 + 10} fill="url(#pf-clk-face)" stroke="rgba(255,255,255,0.08)" />
        <circle cx={MID} cy={MID} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={W} />
        {/* Hour ticks, the quarters labelled. */}
        {Array.from({ length: 24 }, (_, h) => {
          const [x1, y1] = at(h, R + W / 2 + 3);
          const [x2, y2] = at(h, R + W / 2 + (h % 6 === 0 ? 9 : 6));
          return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.28)" strokeWidth={h % 6 === 0 ? 1.6 : 0.8} strokeLinecap="round" />;
        })}
        {[0, 6, 12, 18].map((h) => {
          const [x, y] = at(h, R - W / 2 - 13);
          return <text key={h} x={x} y={y} className="pf-clk-hour" textAnchor="middle" dominantBaseline="central">{clockTime(h)}</text>;
        })}
        {clock.slices.map((s) => arc(s.key, s.from, Math.min(s.hours, 24 - Math.min(s.from, 24)), s.color))}
        {keptHours > 0 && arc("kept", clock.keptFrom!, keptHours, KEPT)}
        {/* Past midnight: an inner red ring for what was spent beyond the income. */}
        {clock.overHours > 0 && arc("over", 0, Math.min(clock.overHours, 24), OVER, R - W - 4, 8)}
        <g className="pf-clk-hand" style={{ ["--end" as string]: `${(end / 24) * 360}deg`, animationDuration: `${sweep}s` }}>
          <line x1={MID} y1={MID - R + W / 2 + 4} x2={MID} y2={MID - R - W / 2 - 2} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={MID} cy={MID - R - W / 2 - 4} r={3.5} fill="#fff" />
        </g>
      </svg>
      <div className="pf-clk-center" aria-live="polite">
        {shown ? (
          <>
            <small>{shown.name}</small>
            <b className="pf-rounded">{fmtDur(shown.hours)}</b>
            <span>{clockTime(shown.from)}–{clockTime(shown.to)}</span>
            <span>{t("{amount} a day", { amount: money(shown.perDay, currency) })}</span>
          </>
        ) : active === "kept" ? (
          <>
            <small>{t("For yourself")}</small>
            <b className="pf-rounded" style={{ color: KEPT }}>{fmtDur(keptHours)}</b>
            <span>{money(clock.kept, currency)}</span>
          </>
        ) : clock.keptFrom != null ? (
          <>
            <small>{t("You work for yourself from")}</small>
            <b className="pf-rounded" style={{ color: KEPT }}>{clockTime(clock.keptFrom)}</b>
            <span>{t("{time} a day is yours", { time: fmtDur(keptHours) })}</span>
          </>
        ) : (
          <>
            <small>{t("Your day ran out")}</small>
            <b className="pf-rounded" style={{ color: OVER }}>+{fmtDur(clock.overHours)}</b>
            <span>{t("spent beyond your income")}</span>
          </>
        )}
      </div>
      {!compact && (
        <ul className="pf-clk-list">
          {clock.slices.map((s, i) => {
            const cat = icons?.get(s.key);
            return (
              <li key={s.key} data-on={active === s.key ? "" : undefined} style={{ ["--d" as string]: `${0.4 + i * 0.06}s` }} onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)}>
                {cat ? <CategoryIcon icon={cat.icon} colorHex={cat.color_hex} size={26} /> : <i className="pf-clk-dot" style={{ background: s.color }} />}
                <span className="pf-clk-name">{s.name}</span>
                <span className="pf-clk-when">{clockTime(s.from)}–{clockTime(s.to)}</span>
                <b className="pf-rounded">{fmtDur(s.hours)}</b>
              </li>
            );
          })}
          {keptHours > 0 && (
            <li className="pf-clk-kept" data-on={active === "kept" ? "" : undefined} onMouseEnter={() => setActive("kept")} onMouseLeave={() => setActive(null)}>
              <i className="pf-clk-dot" style={{ background: KEPT }} />
              <span className="pf-clk-name">{t("For yourself")}</span>
              <span className="pf-clk-when">{clockTime(clock.keptFrom!)}–24:00</span>
              <b className="pf-rounded">{fmtDur(keptHours)}</b>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function fmtDur(h: number) {
  const d = duration(h);
  return d.h ? t("{h} h {m} min", { h: d.h, m: d.m }) : t("{m} min", { m: d.m });
}

/** A year's clock: the year so far (up to [now]) or a past year in full. */
export function useYearClock(data: FinanceData, year: number, now: Date): { clock: Clock | null; days: number } {
  return useMemo(() => {
    const current = year === now.getFullYear();
    const end = current ? now : new Date(year, 11, 31, 23, 59, 59);
    const tx = live(data.transactions).filter((x) => { const d = new Date(x.date); return d.getFullYear() === year && d <= end; });
    let income = 0, spent = 0;
    for (const x of tx) {
      if (x.type === "income") income += num(x.amount);
      else if (!x.advance) spent += num(x.amount);
    }
    const cats = spendByCategoryYear({ ...data, transactions: tx }, year);
    const rows: ClockRow[] = cats.map((c) => ({ key: c.category.id, name: c.category.name, color: hex(c.category.color_hex), amount: c.spent }));
    const loose = spent - cats.reduce((a, c) => a + c.spent, 0);
    if (loose > 0.5) rows.push({ key: "uncategorized", name: t("No category"), color: "#636366", amount: loose });
    const days = Math.max(Math.round((end.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000), 1);
    return { clock: moneyClock(income, rows, days, { key: "rest", name: t("Small costs"), color: "#8e8e93" }), days };
  }, [data, year, now]);
}

/** Key figures: the clock of a month (the last full month to start with)
 *  or of a year (this year so far to start with). */
export function MoneyClockCard({ data, now, currency }: { data: FinanceData; now: Date; currency: string }) {
  const [view, setView] = useState<"month" | "year">("month");
  const [back, setBack] = useState(1);
  const [yearBack, setYearBack] = useState(0);
  const y = now.getFullYear(), m = now.getMonth(), dd = now.getDate();
  const month = useMemo(() => new Date(y, m - back, 1), [y, m, back]);
  // Today (end of day): the year so far, stable while the page ticks.
  const day = useMemo(() => new Date(y, m, dd, 23, 59, 59), [y, m, dd]);
  const monthClock = useMoneyClock(data, month);
  const year = y - yearBack;
  const yearly = useYearClock(data, year, day);
  const clock = view === "month" ? monthClock : yearly.clock;
  const days = view === "month" ? new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() : yearly.days;
  const icons = useMemo(() => new Map(live(data.categories).map((c) => [c.id, { icon: c.icon, color_hex: c.color_hex }])), [data.categories]);
  const first = useMemo(() => {
    const d = live(data.transactions).map((x) => x.date).sort()[0];
    return d ? new Date(d) : null;
  }, [data.transactions]);
  const canBack = view === "month" ? !!first && month > new Date(first.getFullYear(), first.getMonth(), 1) : !!first && year > first.getFullYear();
  const canForward = view === "month" ? back > 1 : yearBack > 0;
  const label = view === "month" ? monthYear(month) : year === y ? t("{year} so far", { year: String(year) }) : String(year);
  return (
    <section className="pf-card pf-clk-card">
      <div className="pf-clk-head">
        <div>
          <h2 className="pf-section-title" style={{ margin: 0 }}>{t("Your money clock")}</h2>
          <p>{t("Your income as one day of 24 hours: until when you work for each cost, biggest first — and from when for yourself.")}</p>
        </div>
        <div className="pf-clk-controls">
          <Segmented label={t("Period")} value={view} onChange={setView} options={[{ value: "month", label: t("Month") }, { value: "year", label: t("Year") }]} />
          <div className="pf-clk-month">
            <button type="button" aria-label={view === "month" ? t("Previous month") : t("Previous year")} disabled={!canBack} onClick={() => (view === "month" ? setBack((b) => b + 1) : setYearBack((b) => b + 1))}><ChevronLeft size={16} /></button>
            <span>{label}</span>
            <button type="button" aria-label={view === "month" ? t("Next month") : t("Next year")} disabled={!canForward} onClick={() => (view === "month" ? setBack((b) => Math.max(b - 1, 1)) : setYearBack((b) => Math.max(b - 1, 0)))}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
      {clock ? (
        <ClockDial key={`${view}-${view === "month" ? month.getTime() : year}`} clock={clock} currency={currency} icons={icons} />
      ) : (
        <p className="pf-clk-empty">{t("No income booked in {month} — the clock needs your income to fill the day.", { month: label })}</p>
      )}
      {clock && (
        <small className="pf-clk-foot">
          {t("{income} came in: {perDay} a day.", { income: money(clock.income, currency), perDay: money(clock.income / days, currency) })}
        </small>
      )}
    </section>
  );
}
