"use client";

import { t } from "@/lib/i18n";
import { monthYear, shortMonth } from "@/lib/finance/format";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// A month to look at: ‹ October 2026 ▾ › — the arrows step a month, the
// label folds out a year of months to pick from (‹ 2026 › to change year).
// Months outside min…max can't be picked; months without data are faint.
// The label slides in from the side it came from.

const key = (d: Date) => d.getFullYear() * 12 + d.getMonth();

export default function MonthPicker({
  value,
  onChange,
  min,
  max,
  marked,
}: {
  value: Date;
  onChange: (month: Date) => void;
  /** First and last month that can be picked (first of the month). */
  min: Date;
  max: Date;
  /** Months that have data (the others are faint). */
  marked?: (month: Date) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(value.getFullYear());
  const [dir, setDir] = useState<"left" | "right">("left");
  const ref = useRef<HTMLDivElement>(null);

  // Open on the picked month's year; close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    setYear(value.getFullYear());
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (d: Date) => {
    if (key(d) < key(min) || key(d) > key(max) || key(d) === key(value)) return;
    setDir(key(d) > key(value) ? "right" : "left");
    onChange(d);
  };
  const step = (k: number) => pick(new Date(value.getFullYear(), value.getMonth() + k, 1));

  return (
    <div ref={ref} className="pf-mpick">
      <button type="button" className="pf-mpick-arrow" aria-label={t("Previous month")} disabled={key(value) <= key(min)} onClick={() => step(-1)}>
        <ChevronLeft size={15} strokeWidth={2.4} />
      </button>
      <button type="button" className="pf-mpick-current" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span key={key(value)} className="pf-mpick-label" data-dir={dir}>
          {monthYear(value)}
        </span>
        <ChevronDown size={13} strokeWidth={2.4} className="pf-mpick-caret" />
      </button>
      <button type="button" className="pf-mpick-arrow" aria-label={t("Next month")} disabled={key(value) >= key(max)} onClick={() => step(1)}>
        <ChevronRight size={15} strokeWidth={2.4} />
      </button>

      {open && (
        <div className="pf-mpick-pop" role="dialog" aria-label={t("Choose a month")}>
          <div className="pf-mpick-year">
            <button type="button" aria-label={t("Previous year")} disabled={year <= min.getFullYear()} onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft size={14} strokeWidth={2.4} />
            </button>
            <b key={year} className="pf-rounded">{year}</b>
            <button type="button" aria-label={t("Next year")} disabled={year >= max.getFullYear()} onClick={() => setYear((y) => y + 1)}>
              <ChevronRight size={14} strokeWidth={2.4} />
            </button>
          </div>
          <div key={year} className="pf-mpick-grid">
            {Array.from({ length: 12 }, (_, m) => {
              const d = new Date(year, m, 1);
              const out = key(d) < key(min) || key(d) > key(max);
              return (
                <button
                  key={m}
                  type="button"
                  disabled={out}
                  aria-pressed={key(d) === key(value)}
                  data-now={key(d) === key(max) || undefined}
                  data-empty={(!out && marked && !marked(d)) || undefined}
                  style={{ ["--i" as string]: m }}
                  onClick={() => {
                    pick(d);
                    setOpen(false);
                  }}
                >
                  {shortMonth(d)}
                </button>
              );
            })}
          </div>
          {key(value) !== key(max) && (
            <button
              type="button"
              className="pf-mpick-back"
              onClick={() => {
                pick(max);
                setOpen(false);
              }}
            >
              {t("Back to {month}", { month: monthYear(max) })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
