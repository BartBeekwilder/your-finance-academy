const cache = new Map<string, Intl.NumberFormat>();

export function money(value: number, currency = "EUR", opts: { compact?: boolean; signed?: boolean } = {}) {
  const key = `${currency}|${opts.compact}|${opts.signed}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: opts.compact ? 1 : 2,
      signDisplay: opts.signed ? "exceptZero" : "auto",
    });
    cache.set(key, f);
  }
  return f.format(value);
}

export const monthYear = (d: Date) =>
  d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export const shortMonth = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });

export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
