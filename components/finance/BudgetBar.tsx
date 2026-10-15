import { money } from "@/lib/finance/format";

/** A budget bar that carries its own numbers.
 *  - Within budget: fills in the category colour; "€X spent" inside the
 *    fill, "€Y left · Z%" in the empty part.
 *  - Over budget: the scale stretches to the amount spent, so the budget
 *    becomes a visible limit line; the part past it is red with moving
 *    stripes and reads "€Y over · Z%".
 *  - A dashed "today" tick marks where an even spend of the budget would
 *    be at this point in the month — past it means heading over.
 *  Bars grow in from the left on first paint. Styles: .pf-bbar* in CSS. */
export default function BudgetBar({
  spent,
  budget,
  color,
  currency,
  monthFraction,
}: {
  spent: number;
  budget: number;
  color: string;
  currency: string;
  /** Share of the month elapsed (0–1), for the "today" pace tick. Leave
   *  out for fixed costs (rent is paid at once, so pace means nothing). */
  monthFraction?: number;
}) {
  const over = spent > budget;
  const scale = Math.max(budget, spent) || 1;
  const fill = Math.min(spent, budget) / scale;
  const limit = budget / scale;
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const pace = monthFraction !== undefined && !over ? (budget * monthFraction) / scale : null;
  const aheadOfPace = pace !== null && spent / scale > pace;

  return (
    <div
      className="pf-bbar"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={budget}
      aria-valuenow={spent}
      aria-label={`${money(spent, currency)} of ${money(budget, currency)} budget${over ? `, ${money(spent - budget, currency)} over` : ""}`}
      style={{ ["--c" as string]: color }}
    >
      <span className="pf-bbar-fill" style={{ width: `${fill * 100}%` }} />
      {over && <span className="pf-bbar-over" style={{ left: `${limit * 100}%`, width: `${(1 - limit) * 100}%` }} />}
      {over && <span className="pf-bbar-limit" style={{ left: `${limit * 100}%` }} title={`Budget ${money(budget, currency)}`} />}
      {pace !== null && pace > 0.02 && pace < 0.98 && (
        <span className="pf-bbar-pace" data-ahead={aheadOfPace} style={{ left: `${pace * 100}%` }} title="Even pace for today" />
      )}

      <span className="pf-bbar-text">
        <span className="pf-rounded">{money(spent, currency)} spent</span>
        <span className="pf-rounded" style={{ opacity: over ? 1 : 0.75 }}>
          {over ? `${money(spent - budget, currency)} over · ${pct}%` : `${money(budget - spent, currency)} left · ${pct}%`}
        </span>
      </span>
    </div>
  );
}
