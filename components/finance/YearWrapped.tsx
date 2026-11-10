"use client";

import { intlLocale, t } from "@/lib/i18n";
import { money, monthName, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import type { YearWrap } from "@/lib/finance/yearWrapped";
import CategoryIcon from "./CategoryIcon";
import { Count, EquityLine, Fact, Stat, WrappedStory, type Card } from "./MonthWrapped";
import { pct } from "./Portfolio";

// Year Wrapped: the closed year as story cards, in the same frame as Month
// Wrapped — the year's savings, month by month, where it went, the
// investments, equity over the year and the year in facts.

const month = (year: number, i: number) => new Date(year, i, 1);

export default function YearWrapped({ w, data, currency }: { w: YearWrap; data: FinanceData; currency: string }) {
  const cards: Card[] = [
    { key: "intro", bg: "linear-gradient(160deg, #4a1d8f 0%, #1d1240 55%, #0d0d14 100%)", body: <Intro w={w} currency={currency} /> },
    ...(w.activeMonths ? [{ key: "months", bg: "linear-gradient(160deg, #0f5c4a 0%, #0b2c26 55%, #0d0d14 100%)", body: <Months w={w} currency={currency} /> }] : []),
    ...(w.top.length ? [{ key: "where", bg: "linear-gradient(160deg, #8f1d4a 0%, #3d1027 55%, #0d0d14 100%)", body: <Where w={w} data={data} currency={currency} /> }] : []),
    ...(w.investments ? [{ key: "inv", bg: "linear-gradient(160deg, #10427f 0%, #0c2340 55%, #0d0d14 100%)", body: <Investments w={w} currency={currency} /> }] : []),
    { key: "equity", bg: "linear-gradient(160deg, #6b4a0f 0%, #2e2109 55%, #0d0d14 100%)", body: <Equity w={w} currency={currency} /> },
    { key: "facts", bg: "linear-gradient(160deg, #3d3d48 0%, #1b1b22 55%, #0d0d14 100%)", body: <Facts w={w} currency={currency} /> },
  ];
  return <WrappedStory cards={cards} />;
}

function Intro({ w, currency }: { w: YearWrap; currency: string }) {
  const ly = w.lastYear;
  const better = ly ? w.saved - ly.saved : 0;
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("Your {year}", { year: String(w.year) })}</span>
      <h3 className="pf-wr-title">{w.saved >= 0 ? t("This is what you kept aside this year.") : t("This year more went out than came in.")}</h3>
      <div className="pf-wr-huge" style={{ color: w.saved >= 0 ? "#7dffa5" : "#ff8a80" }}>
        <Count value={w.saved} currency={currency} signed />
      </div>
      <div className="pf-wr-trio">
        <Stat label={t("In")} value={<Count value={w.income} currency={currency} />} />
        <Stat label={t("Out")} value={<Count value={w.spent} currency={currency} />} />
        <Stat label={t("Savings rate")} value={<span className="pf-rounded">{Math.round(w.savingsRate * 100)}%</span>} />
      </div>
      {ly && (
        <p className="pf-wr-line">
          {better >= 0 ? t("{amount} more than the year before.", { amount: money(better, currency) }) : t("{amount} less than the year before.", { amount: money(-better, currency) })}
        </p>
      )}
    </div>
  );
}

/** Twelve bars from a zero line: up green for a month in the plus, down
 *  red for one that cost more; the best month glows. */
function Months({ w, currency }: { w: YearWrap; currency: string }) {
  const max = Math.max(...w.savedByMonth.map(Math.abs), 1);
  const up = Math.max(...w.savedByMonth, 0) / max, down = Math.max(...w.savedByMonth.map((v) => -v), 0) / max;
  // The zero line sits where the tallest bar up and down both fit.
  const zero = up + down > 0 ? up / (up + down) : 1;
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("Month by month")}</span>
      <h3 className="pf-wr-title">{w.best ? t("{month} was your best month.", { month: monthName(month(w.year, w.best.i)) }) : t("A year in twelve months.")}</h3>
      <div className="pf-yw-months" style={{ ["--zero" as string]: zero }}>
        {w.savedByMonth.map((v, i) => (
          <div key={i} className="pf-yw-month" data-best={w.best?.i === i} title={`${monthName(month(w.year, i))}: ${money(v, currency, { signed: true })}`}>
            <span className="pf-yw-col">
              <i data-neg={v < 0} style={{ ["--h" as string]: Math.abs(v) / max / (up + down || 1), ["--d" as string]: `${0.15 + i * 0.06}s` }} />
            </span>
            <span className="pf-yw-label">{shortMonth(month(w.year, i)).slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <p className="pf-wr-line">
        {t("{n} of {total} months in the plus.", { n: w.plusMonths, total: w.activeMonths })}
        {w.best && <> {t("Best: {month}, {amount}.", { month: monthName(month(w.year, w.best.i)), amount: money(w.best.saved, currency, { signed: true }) })}</>}
      </p>
      {w.toughest && w.toughest.i !== w.best?.i && (
        <p className="pf-wr-line pf-wr-dim">{t("Toughest: {month}, {amount}.", { month: monthName(month(w.year, w.toughest.i)), amount: money(w.toughest.saved, currency, { signed: true }) })}</p>
      )}
    </div>
  );
}

function Where({ w, data, currency }: { w: YearWrap; data: FinanceData; currency: string }) {
  const rows = w.top.map((r) => ({ ...r, category: data.categories.find((c) => c.id === r.id) })).filter((r) => r.category);
  if (!rows.length) return null;
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("Where it went")}</span>
      <h3 className="pf-wr-title">{t("{name} took the most this year.", { name: rows[0].category!.name })}</h3>
      <div className="pf-wr-list">
        {rows.map((r, k) => (
          <div key={r.id} className="pf-wr-bar" style={{ ["--d" as string]: `${0.15 + k * 0.12}s` }}>
            <span className="pf-wr-rank">{k + 1}</span>
            <CategoryIcon icon={r.category!.icon} colorHex={r.category!.color_hex} size={30} />
            <span className="pf-wr-bar-name">
              {r.category!.name}
              <i style={{ width: `${Math.max(r.share * 100, 2)}%`, background: `#${r.category!.color_hex}` }} />
            </span>
            <b className="pf-rounded">{money(r.spent, currency)}</b>
            <span className="pf-wr-dim">{Math.round(r.share * 100)}%</span>
          </div>
        ))}
      </div>
      {w.biggest && (
        <p className="pf-wr-line">
          {t("Biggest single expense: {what} — {amount}.", { what: w.biggest.note || t("no description"), amount: money(w.biggest.amount, currency) })}
        </p>
      )}
    </div>
  );
}

function Investments({ w, currency }: { w: YearWrap; currency: string }) {
  const inv = w.investments!;
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("Investments in {year}", { year: String(w.year) })}</span>
      <h3 className="pf-wr-title">{inv.change >= 0 ? t("Your investments grew.") : t("A dip for your investments.")}</h3>
      <div className="pf-wr-huge" style={{ color: inv.change >= 0 ? "#7dffa5" : "#ff8a80" }}>
        <Count value={inv.change} currency={currency} signed /> <span className="pf-wr-huge-pct">{pct(inv.share)}</span>
      </div>
      <div className="pf-wr-trio">
        <Stat label={t("Start of the year")} value={<Count value={inv.start} currency={currency} />} />
        <Stat label={t("End of the year")} value={<Count value={inv.end} currency={currency} />} />
      </div>
    </div>
  );
}

function Equity({ w, currency }: { w: YearWrap; currency: string }) {
  const series = [{ month: new Date(w.year - 1, 11, 1), equity: w.equityStart }, ...w.equityByMonth.map((equity, i) => ({ month: month(w.year, i), equity }))];
  const color = w.equityChange >= 0 ? "#ffd27d" : "#ff8a80";
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("Equity")}</span>
      <h3 className="pf-wr-title">{w.equityChange >= 0 ? t("Richer than a year ago.") : t("A little less than a year ago.")}</h3>
      <div className="pf-wr-huge" style={{ color }}>
        <Count value={w.equityChange} currency={currency} signed />
      </div>
      <p className="pf-wr-line">{t("Your equity at the end of {year}: {amount}.", { year: String(w.year), amount: money(w.equityEnd, currency) })}</p>
      <EquityLine series={series} color={color} currency={currency} />
    </div>
  );
}

function Facts({ w, currency }: { w: YearWrap; currency: string }) {
  const day = w.facts.topDay;
  return (
    <div className="pf-wr-body">
      <span className="pf-wr-kicker">{t("{year} in facts", { year: String(w.year) })}</span>
      <h3 className="pf-wr-title">{t("A few things worth knowing.")}</h3>
      <div className="pf-wr-facts">
        <Fact big={String(w.facts.expenses)} text={t("expenses entered")} />
        <Fact big={String(w.facts.noSpend)} text={t("days without spending")} />
        {day && <Fact big={money(day.amount, currency)} text={t("on {day}, your most expensive day", { day: `${day.date.toLocaleDateString(intlLocale(), { weekday: "long" })} ${day.date.getDate()} ${monthName(day.date)}` })} />}
        <Fact big={money(w.fixed, currency)} text={t("in fixed costs")} />
        <Fact big={`${w.facts.closes} / 12`} text={t("months closed")} />
        {w.facts.badges > 0 && <Fact big={String(w.facts.badges)} text={t("badges earned")} />}
      </div>
    </div>
  );
}
