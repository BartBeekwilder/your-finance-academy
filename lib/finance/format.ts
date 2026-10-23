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

/** First letter upper case: month names start with a capital everywhere
 *  (Dutch, French, Spanish… write them lower case on their own). */
export const cap = (s: string) => s.charAt(0).toLocaleUpperCase(intlLocale()) + s.slice(1);

export const monthYear = (d: Date) => cap(d.toLocaleDateString(intlLocale(), { month: "long", year: "numeric" }));

export const monthName = (d: Date) => cap(d.toLocaleDateString(intlLocale(), { month: "long" }));

export const shortMonth = (d: Date) => cap(d.toLocaleDateString(intlLocale(), { month: "short" }));

export const shortMonthYear = (d: Date) => cap(d.toLocaleDateString(intlLocale(), { month: "short", year: "numeric" }));

export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" });
