"use client";

import { t } from "@/lib/i18n";
import { useNow } from "@/lib/motion";

import { money } from "@/lib/finance/format";

/** A budget bar that carries its own numbers.
 *  - Within budget: fills in the category colour; "€X spent" inside the
 *    fill, "€Y left · Z%" in the empty part.
 *  - The bar is always exactly the budget, on a track that leaves room on
 *    the right. Over budget it fills completely, gets a glowing limit cap,
 *    and the overspend spills OUT of the bar's end — a red striped piece as
 *    long as the overspend (fading out when it's bigger than the room left) —
 *    reading "€Y over · Z%".
 *  - Variable categories: a dashed "today" tick marks where an even spend
 *    of the budget would be at this point in the month.
 *  - Fixed categories (rent, utilities — paid in one go): the bar shows how
 *    much has been *used* so far, i.e. what was paid spread evenly over the
 *    month (≈ 50% on the 15th, ticking live, same rule as the Spent tile).
 *    The rest of what's been paid shows as a translucent "paid, not yet
 *    used" segment, and budget that wasn't paid at all as a faint green
 *    "under budget" end.
 *  - Compare (`scaleMax`): every bar on one scale — the largest budget fills
 *    the track — so the lengths show the budgets against each other. A bar
 *    too short for its numbers shows them just past its end.
 *  - Heat (`heat`, the total budget): instead of one colour the fill shows a
 *    green → amber → red gradient anchored to the whole bar, so the colour at
 *    its tip says how close you are to the limit; the tip glows in that
 *    colour and a soft sheen travels along it.
 *  Bars grow in from the left on first paint. Styles: .pf-bbar* in CSS. */
export default function BudgetBar({
  spent,
  budget,
  color,
  currency,
  monthFraction,
  fixedMonthStart,
  scaleMax,
  heat,
  forecast,
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
  /** Compare mode: the amount that fills the whole track (the largest
   *  budget on the list), so bars are sized against each other. */
  scaleMax?: number;
  /** Colour by how full the budget is (green → red), for totals. */
  heat?: boolean;
  /** A month still to come: `spent` is what's expected — drawn fainter,
   *  with a dashed edge, and labelled "expected". */
  forecast?: boolean;
}) {
  const fraction = useMonthFraction(fixedMonthStart);
  const fixed = fixedMonthStart !== undefined;
  const used = fixed ? spent * fraction : spent;

  const over = used > budget;
  const scale = budget || 1;
  const fill = Math.min(used, budget) / scale;
  const paid = fixed ? Math.min(spent, budget) / scale : 0;
  const limit = budget / scale;
  const pct = budget > 0 ? Math.round((used / budget) * 100) : 0;
  const pace = monthFraction !== undefined && !fixed && !over ? (budget * monthFraction) / scale : null;
  const aheadOfPace = pace !== null && used / scale > pace;

  // The bar's width as a share of the row (= its budget): the full track,
  // or in compare mode its budget against the largest. The overspend spills
  // past its end into whatever room is left.
  const unit = scaleMax && scaleMax > 0 ? scaleMax : scale;
  const barW = (budget / unit) * TRACK;
  const room = 100 - barW - 1;
  const spillRaw = over ? ((used - budget) / unit) * TRACK : 0;
  const capped = spillRaw > room;
  const spill = Math.min(spillRaw, room);
  // Short bars carry their numbers outside, just past the end.
  const outside = barW < 38;

  return (
    <div className="pf-bbar-row" data-outside={outside} data-forecast={forecast || undefined} data-over={over || undefined} style={{ ["--track" as string]: `${barW}%`, ["--c" as string]: color }}>
    <div
      className="pf-bbar"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={budget}
      aria-valuenow={used}
      aria-label={t("{used} of {budget} budget", { used: money(used, currency), budget: money(budget, currency) })}
      style={{ ["--c" as string]: color }}
    >
      {fixed && paid > fill && <span className="pf-bbar-paid" style={{ width: `${paid * 100}%` }} title={t("{amount} paid", { amount: money(spent, currency) })} />}
      {fixed && !over && spent < budget && (
        // The part of the budget that wasn't needed at all this month.
        <span className="pf-bbar-under" style={{ left: `${paid * 100}%` }} title={t("{v1} under budget", { v1: money(budget - spent, currency) })} />
      )}
      <span
        className="pf-bbar-fill"
        data-heat={heat || undefined}
        style={
          heat
            ? {
                width: `${fill * 100}%`,
                // The gradient spans the whole bar, whatever the fill.
                backgroundSize: `${100 / Math.max(fill, 0.001)}% 100%`,
                boxShadow: `6px 0 18px -4px ${heatAt(fill)}, 0 0 10px -2px ${heatAt(fill)}`,
              }
            : { width: `${fill * 100}%` }
        }
      />
      {over && <span className="pf-bbar-limit" style={{ left: `${limit * 100}%` }} title={t("Budget {amount}", { amount: money(budget, currency) })} />}
      {pace !== null && pace > 0.02 && pace < 0.98 && (
        <span className="pf-bbar-pace" data-ahead={aheadOfPace} style={{ left: `${pace * 100}%` }} title={t("Even pace for today")} />
      )}

      <span className="pf-bbar-text">
        <span className="pf-rounded">
          {forecast ? t("{amount} expected", { amount: money(used, currency) }) : fixed ? t("{amount} used", { amount: money(used, currency) }) : t("{amount} spent", { amount: money(used, currency) })}
        </span>
        <span className="pf-rounded" style={{ opacity: over ? 1 : 0.75 }}>
          {over
            ? `${t("{amount} over", { amount: money(used - budget, currency) })} · ${pct}%`
            : fixed
              ? // "To go" = paid but not yet used; an unpaid part of the
                // budget (the empty end of the bar) is called out as such.
                `${t("{amount} to go", { amount: money(spent - used, currency) })} · ${spent < budget ? t("{v1} under budget", { v1: money(budget - spent, currency) }) : `${pct}%`}`
              : `${t("{amount} left", { amount: money(budget - used, currency) })} · ${pct}%`}
        </span>
      </span>
    </div>
    {outside && (
      <span className="pf-bbar-outtext pf-rounded" style={{ left: `calc(${barW + spill}% + 8px)` }}>
        {forecast ? t("{amount} expected", { amount: money(used, currency) }) : fixed ? t("{amount} used", { amount: money(used, currency) }) : t("{amount} spent", { amount: money(used, currency) })}
        <span style={{ color: over ? "#ff6a5f" : "var(--pf-ink-3)" }}>
          {" · "}
          {over ? `${t("{amount} over", { amount: money(used - budget, currency) })} · ${pct}%` : `${fixed ? t("{amount} to go", { amount: money(Math.max(budget - used, 0), currency) }) : t("{amount} left", { amount: money(Math.max(budget - used, 0), currency) })} · ${pct}%`}
        </span>
      </span>
    )}
    {over && (
      <span
        className="pf-bbar-spill"
        data-capped={capped}
        style={{ width: `${spill}%` }}
        title={t("{v1} over budget", { v1: money(used - budget, currency) })}
      />
    )}
    </div>
  );
}

/** Heat gradient stops (share of the budget → colour), green to red. */
const HEAT: [number, [number, number, number]][] = [
  [0, [48, 209, 88]],
  [0.5, [140, 214, 62]],
  [0.72, [255, 204, 0]],
  [0.88, [255, 149, 0]],
  [1, [255, 69, 58]],
];

/** The heat colour at a share of the budget. */
function heatAt(f: number) {
  const x = Math.min(Math.max(f, 0), 1);
  const i = Math.max(1, HEAT.findIndex(([at]) => at >= x));
  const [a, ca] = HEAT[i - 1], [b, cb] = HEAT[i];
  const k = b === a ? 0 : (x - a) / (b - a);
  const c = ca.map((v, j) => Math.round(v + (cb[j] - v) * k));
  return `rgb(${c.join(",")})`;
}

/** Width of the bar (= the budget) as a share of the row; the rest is room
 *  for an overspend to spill into. */
const TRACK = 80;

/** Fraction of the month elapsed, re-read every second; 1 when not needed. */
function useMonthFraction(monthStart?: Date) {
  const now = useNow(1000, monthStart !== undefined);
  if (!monthStart) return 1;
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1).getTime();
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).getTime();
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}
