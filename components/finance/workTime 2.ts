import { intlLocale, t } from "@/lib/i18n";
import { timeParts } from "@/lib/finance/workHours";

/** Hours as a short reading in the visitor's language: "15 min", "3.5 h". */
export function workTime(hours: number): string {
  const p = timeParts(hours);
  return p.unit === "min" ? t("{m} min", { m: p.value }) : t("{n} h", { n: p.value.toLocaleString(intlLocale(), { maximumFractionDigits: 1 }) });
}

/** Days to one decimal: "4.5". */
export const days1 = (d: number) => (Math.round(d * 10) / 10).toLocaleString(intlLocale(), { maximumFractionDigits: 1 });
