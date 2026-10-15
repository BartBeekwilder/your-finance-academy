"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/finance/format";

/** A budget bar that carries its own numbers.
 *  - Within budget: fills in the category colour; "€X spent" inside the
 *    fill, "€Y left · Z%" in the empty part.
 *  - Over budget: the scale stretches to the amount spent, so the budget
 *    becomes a visible limit line; the part past it is red with moving
 *    stripes and reads "€Y over · Z%".
 *  - Variable categories: a dashed "today" tick marks where an even spend
 *    of the budget would be at this point in the month.
 *  - Fixed categories (rent, utilities — paid in one go): the bar shows how
 *    much has been *used* so far, i.e. what was paid spread evenly over the
 *    month (≈ 50% on the 15th, ticking live, same rule as the Spent tile).
 *    The rest of what's been paid shows as a translucent "paid, not yet
 *    used" segment, and budget that wasn't paid at all as a faint green
 *    "under budget" end.
 *  Bars grow in from the left on first paint. Styles: .pf-bbar* in CSS. */
export default function BudgetBar({
  spent,
  budget,
  color,
  currency,
  monthFraction,
  fixedMonthStart,
}: {
  spent: number;
  budget: number;
  color: string;
  currency: string;
  /** Share of the month elapsed (0–1), for the "today" pace tick on
   *  variable categories. */
  monthFraction?: number;
  /** Set for fixed-cost categories: the month's first day. The bar then
   *  shows use-to-date instead of the lump sum paid. */
  fixedMonthStart?: Date;
}) {
  const fraction = useMonthFraction(fixedMonthStart);
  const fixed = fixedMonthStart !== undefined;
  const used = fixed ? spent * fraction : spent;

  const over = used > budget;
  const scale = Math.max(budget, used) || 1;
  const fill = Math.min(used, budget) / scale;
  const paid = fixed ? Math.min(spent, budget) / scale : 0;
  const limit = budget / scale;
  const pct = budget > 0 ? Math.round((used / budget) * 100) : 0;
  const pace = monthFraction !== undefined && !fixed && !over ? (budget * monthFraction) / scale : null;
  const aheadOfPace = pace !== null && used / scale > pace;

  return (
    <div
      className="pf-bbar"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={budget}
      aria-valuenow={used}
      aria-label={`${money(used, currency)} ${fixed ? "used" : "spent"} of ${money(budget, currency)} budget${over ? `, ${money(used - budget, currency)} over` : ""}`}
      style={{ ["--c" as string]: color }}
    >
      {fixed && paid > fill && <span className="pf-bbar-paid" style={{ width: `${paid * 100}%` }} title={`${money(spent, currency)} paid`} />}
      {fixed && !over && spent < budget && (
        // The part of the budget that wasn't needed at all this month.
        <span className="pf-bbar-under" style={{ left: `${paid * 100}%` }} title={`${money(budget - spent, currency)} under budget`} />
      )}
      <span className="pf-bbar-fill" style={{ width: `${fill * 100}%` }} />
      {over && <span className="pf-bbar-over" style={{ left: `${limit * 100}%`, width: `${(1 - limit) * 100}%` }} />}
      {over && <span className="pf-bbar-limit" style={{ left: `${limit * 100}%` }} title={`Budget ${money(budget, currency)}`} />}
      {pace !== null && pace > 0.02 && pace < 0.98 && (
        <span className="pf-bbar-pace" data-ahead={aheadOfPace} style={{ left: `${pace * 100}%` }} title="Even pace for today" />
      )}

      <span className="pf-bbar-text">
        <span className="pf-rounded">
          {money(used, currency)} {fixed ? "used" : "spent"}
        </span>
        <span className="pf-rounded" style={{ opacity: over ? 1 : 0.75 }}>
          {over
            ? `${money(used - budget, currency)} over · ${pct}%`
            : fixed
              ? // "To go" = paid but not yet used; an unpaid part of the
                // budget (the empty end of the bar) is called out as such.
                `${money(spent - used, currency)} to go · ${spent < budget ? `${money(budget - spent, currency)} under budget` : `${pct}%`}`
              : `${money(budget - used, currency)} left · ${pct}%`}
        </span>
      </span>
    </div>
  );
}

/** Fraction of the month elapsed, re-read every second; 1 when not needed. */
function useMonthFraction(monthStart?: Date) {
  const [now, setNow] = useState(() => Date.now());
  const active = monthStart !== undefined;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!monthStart) return 1;
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1).getTime();
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).getTime();
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}
