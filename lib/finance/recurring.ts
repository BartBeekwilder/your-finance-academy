import type { FinanceData, Transaction } from "./types";

// Fixed costs book themselves: a monthly fixed cost (the mortgage, a
// subscription) is copied into the next month on the same day as last
// month, once that day has come. So the Spent tile, the charts and the
// balance sheet count it from the start of the month, ticking through the
// month like any fixed cost.
//
// Monthly = it carries a recurrence_id (Onboarding, earlier copies), or the
// same fixed cost (category + description) was also there the month before.
// A yearly payment entered once isn't repeated.
// Already there = a fixed cost in that month with the same recurrence_id,
// or the same category + description (entered by hand).
// Each copy has an id made from (recurrence, month), so a copy that was
// deleted never comes back: the id is in the deletions (local) or still in
// the database (Supabase refuses the insert).

// Own tiny helpers (no imports beyond types), so the rules can be tested
// with plain node and ported 1:1.
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const inMonth = (t: Transaction, m: Date) => {
  const d = new Date(t.date);
  return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
};
const fixedCosts = (txs: Transaction[], m: Date) =>
  txs.filter((t) => t.type === "expense" && t.is_fixed_expense && !t.deleted_at && !t.advance && !t.spread_months && !t.spread_of && inMonth(t, m));
const same = (a: Transaction, b: Transaction) => a.category_id === b.category_id && (a.note ?? "") === (b.note ?? "");

/** A UUID that is always the same for the same text (FNV-1a, four seeds). */
export function stableId(text: string): string {
  const part = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  const hex = part(0x811c9dc5) + part(0x01000193) + part(0x9e3779b9) + part(0x85ebca6b);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** This month's fixed costs that are due by `now` but not booked yet. Only
 *  this month: earlier months are history (the month close points out a
 *  fixed cost that's missing there). */
export function dueFixedCosts(data: Pick<FinanceData, "transactions"> & { deletions?: { id: string }[] }, now: Date): Transaction[] {
  const gone = new Set((data.deletions ?? []).map((d) => d.id));
  const ids = new Set(data.transactions.map((t) => t.id));
  const month = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const prev = fixedCosts(data.transactions, new Date(now.getFullYear(), now.getMonth() - 1, 1, 12));
  const before = fixedCosts(data.transactions, new Date(now.getFullYear(), now.getMonth() - 2, 1, 12));
  const here = fixedCosts(data.transactions, month);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const out: Transaction[] = [];
  for (const src of prev) {
    if (!src.recurrence_id && !before.some((b) => same(b, src))) continue;
    const chain = src.recurrence_id ?? src.id;
    if (here.some((t) => t.recurrence_id === chain || same(t, src))) continue;
    const day = Math.min(new Date(src.date).getDate(), days);
    if (day > now.getDate()) continue; // not due yet
    const id = stableId(`${chain}|${key(month)}`);
    if (ids.has(id) || gone.has(id)) continue;
    out.push({
      ...src,
      id,
      date: new Date(now.getFullYear(), now.getMonth(), day, 12).toISOString(),
      recurrence_id: chain,
      repaid_at: null,
      updated_at: now.toISOString(),
      deleted_at: null,
    });
    ids.add(id);
  }
  return out;
}
