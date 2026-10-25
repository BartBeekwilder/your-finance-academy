"use client";

import { t } from "@/lib/i18n";
import { useState } from "react";
import { householdOf, SHARED, splitByPerson } from "@/lib/finance/household";
import { money, monthName, shortMonth } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import { WithYAxis } from "./YAxis";

// Income per person / who paid: January…December this year, one stacked
// bar per month in each person's colour (shared expenses in grey on top),
// and per person the total and share — this month or this year, following
// the page's Month / Year switch. Point at a month to read it.

const SHARED_COLOR = "rgba(255,255,255,0.28)";

export default function PeopleSplit({ data, now, currency, kind, mode }: { data: FinanceData; now: Date; currency: string; kind: "income" | "expense"; mode: "month" | "year" }) {
  const members = householdOf(data.profile);
  const [hover, setHover] = useState<number | null>(null);
  if (!members.length) return null;
  const year = now.getFullYear(), current = now.getMonth();
  const split = splitByPerson(data.transactions, kind, year, members);
  const groups = [
    ...members.map((m) => ({ id: m.id, name: m.name, color: m.color, values: split.get(m.id)! })),
    ...(kind === "expense" ? [{ id: SHARED, name: t("Shared"), color: SHARED_COLOR, values: split.get(SHARED)! }] : []),
  ];
  // Income without a person counts for the first member (as Quick Add does).
  if (kind === "income") split.get(SHARED)!.forEach((v, m) => (groups[0].values[m] += v));
  const totals = Array.from({ length: 12 }, (_, m) => groups.reduce((s, g) => s + g.values[m], 0));
  const max = Math.max(1, ...totals);
  const sel = hover ?? current;
  const period = (g: (typeof groups)[number]) => (mode === "month" && hover === null ? g.values[current] : hover !== null ? g.values[hover] : g.values.slice(0, current + 1).reduce((a, b) => a + b, 0));
  const periodTotal = groups.reduce((s, g) => s + period(g), 0);
  const H = 150;
  const label = hover !== null ? monthName(new Date(year, hover, 1)) : mode === "month" ? monthName(new Date(year, current, 1)) : String(year);

  return (
    <section className="pf-card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          {kind === "income" ? t("Income per person — {year}", { year }) : t("Who paid — {year}", { year })}
        </span>
        <span key={label} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
          <b style={{ color: "var(--pf-ink)" }}>{label}</b> · {money(periodTotal, currency)}
        </span>
      </div>
      <div className="pf-ppl-layout">
        <WithYAxis height={H} currency={currency} ticks={[0, 0.5, 1].map((f) => ({ value: max * f, at: f }))}>
          <div className="pf-ppl-bars" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {totals.map((tot, m) => (
              <div key={m} className="pf-ppl-col" data-sel={m === sel} data-future={m > current} onMouseEnter={() => setHover(m)}>
                <div className="pf-ppl-stack" style={{ height: `${(tot / max) * 100}%`, ["--i" as string]: m }}>
                  {groups.map((g) =>
                    g.values[m] > 0 ? <span key={g.id} style={{ height: `${(g.values[m] / (tot || 1)) * 100}%`, background: g.color }} title={`${g.name}: ${money(g.values[m], currency)}`} /> : null,
                  )}
                </div>
                {/* The month under its own bar. */}
                <span className="pf-ppl-month">{shortMonth(new Date(year, m, 1))}</span>
              </div>
            ))}
          </div>
        </WithYAxis>
        <div className="pf-ppl-legend">
          {groups.map((g) => {
            const v = period(g);
            return (
              <div key={g.id} className="pf-ppl-row">
                <i style={{ background: g.color }} />
                <span className="pf-ppl-name">{g.name}</span>
                <b className="pf-rounded">{money(v, currency)}</b>
                <span className="pf-rounded pf-ppl-pct">{periodTotal ? Math.round((v / periodTotal) * 100) : 0}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
