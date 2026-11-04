"use client";

import { t } from "@/lib/i18n";
import { live, monthToDate, spendByCategory, spendByCategoryYear, summarize, yearForecast } from "@/lib/finance/calc";
import { upcomingFixedCosts } from "@/lib/finance/recurring";
import { money } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import CategoryIcon from "./CategoryIcon";
import type { Mode } from "./LiveTiles";

// The Expenses page's category tiles: "All" and one tile per category with
// what it took this month (or this year), its share of all spending and of
// the income over the same period (as entered). Picking one hands
// the page to that category (scopeToCategory); picking it again, or All,
// gives the whole picture back.

export default function CategoryTiles({ data, now, mode, currency, selected, onSelect }: {
  data: FinanceData;
  now: Date;
  mode: Mode;
  currency: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = (mode === "month" ? spendByCategory(data, month) : spendByCategoryYear(data, now)).map((r) => ({ category: r.category, spent: r.spent }));
  const total = rows.reduce((s, r) => s + r.spent, 0);
  // "% of income": against the month's income — this month the expected
  // income (salary + side income), since the salary may not be in yet; a
  // finished month what came in. The year: finished months + this month.
  const today = new Date();
  const isThisMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const monthIncome = (m: Date) => {
    const entered = summarize(data.transactions, m).income;
    const current = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
    return current ? Math.max(entered, yearForecast(data, today)[0]?.income ?? entered) : entered;
  };
  const income =
    mode === "month"
      ? isThisMonth ? monthIncome(month) : summarize(data.transactions, month).income
      : Array.from({ length: now.getMonth() + 1 }, (_, m) => monthIncome(new Date(now.getFullYear(), m, 1))).reduce((a, b) => a + b, 0);
  // The second ring: earned so far against spent so far, both spread over
  // the month like the live tiles — salary and fixed costs (also those still
  // to come) as the month passes, side income and variable spending as
  // booked. Only while the period shown runs through today.
  const runsToday = mode === "month" ? isThisMonth : now.getFullYear() === today.getFullYear();
  const soFar = runsToday ? toDate(data, today, rows, mode === "year") : null;
  const ofIncome = (v: number) => (income > 0 ? t("{pct}% of income", { pct: Math.round((v / income) * 100) }) : null);
  const cats = live(data.categories);
  return (
    <div className="pf-cattiles-row">
    <div className="pf-cattiles" role="tablist" aria-label={t("Categories")}>
      <button type="button" role="tab" aria-selected={selected === null} className="pf-cattile" data-on={selected === null} style={{ ["--c" as string]: "#ff453a" }} onClick={() => onSelect(null)}>
        <span className="pf-cattile-head">
          <span className="pf-cattile-all">∑</span>
          <span className="pf-cattile-name">{t("All")}</span>
        </span>
        <b className="pf-rounded">{money(total, currency)}</b>
        <span className="pf-cattile-bar"><span style={{ width: "100%" }} /></span>
        {ofIncome(total) && <span className="pf-cattile-meta pf-cattile-income" data-over={total > income}>{ofIncome(total)}</span>}
      </button>
      {rows.map(({ category: c, spent }, i) => {
        const subs = cats.filter((s) => s.parent_id === c.id).length;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={selected === c.id}
            className="pf-cattile"
            data-on={selected === c.id}
            data-dim={selected !== null && selected !== c.id}
            style={{ ["--c" as string]: `#${c.color_hex}`, animationDelay: `${i * 30}ms` }}
            onClick={() => onSelect(selected === c.id ? null : c.id)}
          >
            <span className="pf-cattile-head">
              <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={22} />
              <span className="pf-cattile-name">{c.name}</span>
            </span>
            <b className="pf-rounded">{money(spent, currency)}</b>
            <span className="pf-cattile-bar"><span style={{ width: `${total ? (spent / total) * 100 : 0}%` }} /></span>
            <span className="pf-cattile-meta">
              {t("{pct}% of spending", { pct: Math.round(total ? (spent / total) * 100 : 0) })}{subs > 0 ? ` · ${subs === 1 ? t("1 subcategory") : t("{n} subcategories", { n: subs })}` : ""}
            </span>
            {ofIncome(spent) && <span className="pf-cattile-meta pf-cattile-income">{ofIncome(spent)}</span>}
          </button>
        );
      })}
    </div>
    <div className="pf-incomerings">
    {income > 0 && <IncomeRing rows={rows} income={income} currency={currency} label={mode === "year" ? t("of this year's income spent") : t("of your income spent")} />}
    {soFar && soFar.income > 0 && <IncomeRing rows={soFar.rows} income={soFar.income} currency={currency} label={t("of the income earned so far spent")} />}
    </div>
    </div>
  );
}

/** How much of your income you've spent so far, at a glance: income is the
 *  green ring, spending eats into it in shades of red (a shade per
 *  category, each its share of income); over 100% it's all red. */
type Row = { category: { id: string; color_hex: string; name: string }; spent: number };

/** Earned and spent up to `today`, per category: this month's fixed costs
 *  (booked + still to come) × the part of the month gone, plus what's been
 *  spent variably; a year adds its finished months as entered. */
function toDate(data: FinanceData, today: Date, rows: Row[], year: boolean) {
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const f = Math.min((today.getTime() - month.getTime()) / (days * 86_400_000), 1);
  const cats = live(data.categories);
  const root = (id: string | null) => { const c = cats.find((x) => x.id === id); return c ? c.parent_id ?? c.id : null; };
  const upcoming = new Map<string, number>();
  for (const u of upcomingFixedCosts(data, today)) {
    const r = root(u.category_id);
    if (r) upcoming.set(r, (upcoming.get(r) ?? 0) + Number(u.amount));
  }
  const thisMonth = new Map(spendByCategory(data, month).map((r) => [r.category.id, r]));
  const out = rows.map((r) => {
    const m = thisMonth.get(r.category.id);
    const booked = m?.spent ?? 0, fixed = m?.fixed ?? 0;
    const spread = (fixed + (upcoming.get(r.category.id) ?? 0)) * f + (booked - fixed);
    return { category: r.category, spent: Math.max((year ? r.spent - booked : 0) + spread, 0) };
  });
  // Fixed costs still to come in a category with nothing booked yet.
  for (const [id, v] of upcoming) {
    const c = cats.find((x) => x.id === id);
    if (c && !out.some((r) => r.category.id === id)) out.push({ category: c, spent: v * f });
  }
  const pts = monthToDate(data, today).points;
  let income = pts[pts.length - 1]?.income ?? 0;
  if (year) for (let m = 0; m < today.getMonth(); m++) income += summarize(data.transactions, new Date(today.getFullYear(), m, 1)).income;
  return { rows: out.sort((a, b) => b.spent - a.spent), income };
}

function IncomeRing({ rows, income, currency, label }: { rows: Row[]; income: number; currency: string; label: string }) {
  const total = rows.reduce((s, r) => s + r.spent, 0);
  const share = total / income;
  const R = 42, C = 2 * Math.PI * R;
  let at = 0;
  const segs = rows.map((r) => {
    const len = Math.min(r.spent / income, 1) * C;
    const seg = { id: r.category.id, color: `#${r.category.color_hex}`, len, start: at };
    at += len;
    return seg;
  }).filter((x) => x.len > 0.5 && x.start < C);
  const over = share > 1;
  return (
    <div className="pf-cattile pf-incomering" data-over={over || undefined} title={t("{spent} of {income} income", { spent: money(total, currency), income: money(income, currency) })}>
      <svg viewBox="0 0 100 100" width={104} height={104} aria-hidden>
        <circle cx={50} cy={50} r={R} fill="none" stroke="rgba(48,209,88,0.55)" strokeWidth={9} />
        <g transform="rotate(-90 50 50)">
          {segs.map((g, i) => (
            <circle key={g.id} cx={50} cy={50} r={R} fill="none" stroke={over ? "#ff453a" : `hsl(${4 + (i % 4) * 7}, ${88 - (i % 3) * 10}%, ${58 - (i % 5) * 6}%)`} strokeWidth={9}
              strokeDasharray={`${Math.max(Math.min(g.len, C - g.start) - 1.2, 0.3)} ${C}`} strokeDashoffset={-g.start}
              className="pf-incomering-seg" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </g>
      </svg>
      <span className="pf-incomering-text">
        <b className="pf-rounded" style={{ color: over ? "var(--pf-red)" : undefined }}>{Math.round(share * 100)}%</b>
        <span>{label}</span>
        <em className="pf-rounded">{t("{spent} of {income}", { spent: money(total, currency), income: money(income, currency) })}</em>
      </span>
    </div>
  );
}
