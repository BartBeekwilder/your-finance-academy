import { intlLocale } from "@/lib/i18n";

const cache = new Map<string, Intl.NumberFormat>();

export function money(value: number, currency = "EUR", opts: { compact?: boolean; signed?: boolean } = {}) {
  const locale = intlLocale();
  const key = `${locale}|${currency}|${opts.compact}|${opts.signed}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
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
  d.toLocaleDateString(intlLocale(), { month: "long", year: "numeric" });

export const shortMonth = (d: Date) => d.toLocaleDateString(intlLocale(), { month: "short" });

export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" });
