"use client";

import { t } from "@/lib/i18n";
import { live, spendByCategory, spendByCategoryYear, summarize } from "@/lib/finance/calc";
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
  const income =
    mode === "month"
      ? summarize(data.transactions, month).income
      : Array.from({ length: now.getMonth() + 1 }, (_, m) => summarize(data.transactions, new Date(now.getFullYear(), m, 1)).income).reduce((a, b) => a + b, 0);
  const ofIncome = (v: number) => (income > 0 ? t("{pct}% of income", { pct: Math.round((v / income) * 100) }) : null);
  const cats = live(data.categories);
  return (
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
  );
}
