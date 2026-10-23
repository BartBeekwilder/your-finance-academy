import { live, num } from "./calc";
import type { MortgagePart } from "./mortgage";
import type { FinanceData, MortgagePartRow, Property } from "./types";

// Glue between the stored rows and the pure mortgage maths.

export function toPart(r: MortgagePartRow): MortgagePart {
  const [y, m, d] = r.start_date.slice(0, 10).split("-").map(Number);
  const fixed = r.fixed_until ? r.fixed_until.slice(0, 10).split("-").map(Number) : null;
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    principal: num(r.principal),
    rate: num(r.rate),
    start: new Date(y, m - 1, d || 1),
    termMonths: r.term_months,
    fixedUntil: fixed ? new Date(fixed[0], fixed[1] - 1, fixed[2] || 1) : null,
    nhg: r.nhg,
    extraMonthly: num(r.extra_monthly),
  };
}

/** Each live property with its live mortgage parts. */
export function homes(data: FinanceData): { property: Property; parts: MortgagePart[] }[] {
  const parts = live(data.mortgageParts ?? []);
  return live(data.properties ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((property) => ({
      property,
      parts: parts.filter((p) => p.property_id === property.id).sort((a, b) => a.sort_order - b.sort_order).map(toPart),
    }));
}
