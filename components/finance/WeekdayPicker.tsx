"use client";

import { intlLocale, t } from "@/lib/i18n";
import { startDays, type CheckinInterval } from "@/lib/finance/checkin";

// The weekdays a check-in comes round: two for twice a week, one for
// weekly. Seven pills, Monday first; picking a third day for twice a week
// lets go of the one picked longest ago. The caption says what it means
// ("Tuesday–Friday and Saturday–Monday").

const ORDER = [1, 2, 3, 4, 5, 6, 0];
// 2024-01-01 was a Monday: Monday + i days gives each weekday's name.
const nameOf = (wd: number, style: "short" | "long") => {
  const s = new Date(2024, 0, 1 + ((wd + 6) % 7)).toLocaleDateString(intlLocale(), { weekday: style });
  return s.charAt(0).toLocaleUpperCase(intlLocale()) + s.slice(1);
};

/** "Monday–Wednesday and Thursday–Sunday" for the chosen start days. */
export function periodsLabel(interval: CheckinInterval, days?: number[] | null) {
  if (interval === "daily") return t("Every day");
  const starts = startDays(interval, days);
  const parts = starts.map((d, i) => {
    const next = starts[(i + 1) % starts.length];
    const end = (next + 6) % 7;
    return end === d ? nameOf(d, "long") : `${nameOf(d, "long")}–${nameOf(end, "long")}`;
  });
  return parts.length === 2 ? t("{a} and {b}", { a: parts[0], b: parts[1] }) : parts[0];
}

export default function WeekdayPicker({ interval, days, onChange }: { interval: Exclude<CheckinInterval, "daily">; days?: number[] | null; onChange: (days: number[]) => void }) {
  const picked = startDays(interval, days);
  const want = interval === "twice-weekly" ? 2 : 1;
  const tap = (d: number) => {
    if (picked.includes(d)) return;
    // The order picked in: the newest last, so the oldest goes first.
    const kept = (days && days.length === want ? days : picked).filter((x) => x !== d);
    onChange([...kept.slice(kept.length - (want - 1)), d].slice(-want));
  };
  return (
    <div className="pf-wd">
      <div className="pf-wd-row" role="group" aria-label={want === 2 ? t("Pick two days") : t("Pick a day")}>
        {ORDER.map((d) => (
          <button key={d} type="button" aria-pressed={picked.includes(d)} aria-label={nameOf(d, "long")} onClick={() => tap(d)}>
            {nameOf(d, "short")}
          </button>
        ))}
      </div>
      <span key={picked.join()} className="pf-wd-caption">{periodsLabel(interval, picked)}</span>
    </div>
  );
}
