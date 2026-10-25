import { t } from "@/lib/i18n";
import { live } from "./calc";
import type { FinanceData } from "./types";

// One category as the whole picture: the Expenses page's category tiles
// narrow the page to a category this way. Its subcategories become groups
// of their own (in their own colour, or a shade of the category's), the
// spend booked straight on the category shows as "<name> (general)", and
// only that spending (and its budgets) remains — so every chart on the page
// works unchanged and stacks by subcategory.

export function scopeToCategory(data: FinanceData, id: string): FinanceData {
  const cats = live(data.categories);
  const top = cats.find((c) => c.id === id);
  if (!top) return data;
  const subs = cats.filter((c) => c.parent_id === id).sort((a, b) => a.sort_order - b.sort_order);
  const ids = new Set([id, ...subs.map((s) => s.id)]);
  const categories = [
    { ...top, parent_id: null, name: subs.length ? t("{name} (general)", { name: top.name }) : top.name },
    ...subs.map((s, i) => ({
      ...s,
      parent_id: null,
      color_hex: s.color_hex.toLowerCase() === top.color_hex.toLowerCase() ? shade(top.color_hex, i + 1) : s.color_hex,
    })),
  ];
  return {
    ...data,
    categories,
    transactions: data.transactions.filter((x) => x.type === "expense" && x.category_id && ids.has(x.category_id)),
    budgets: data.budgets.filter((b) => b.category_id && ids.has(b.category_id)),
  };
}

/** A lighter or darker step of a hex colour (no #) for the i-th sub. */
function shade(hex: string, i: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const steps = [0.45, 0.3, 0.6, 0.2, 0.7];
  const k = steps[(i - 1) % steps.length];
  const to = i % 2 ? 255 : 0;
  return rgb.map((v) => Math.round(v + (to - v) * k).toString(16).padStart(2, "0")).join("").toUpperCase();
}
