"use client";

import { t } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

// A year to look at: ‹ 2026 › — the Month view's MonthPicker for Year view.
// The label slides in from the side it came from.

export default function YearPicker({ value, onChange, min, max }: { value: number; onChange: (year: number) => void; min: number; max: number }) {
  const [dir, setDir] = useState<"left" | "right">("left");
  const step = (k: number) => {
    const next = value + k;
    if (next < min || next > max) return;
    setDir(k > 0 ? "right" : "left");
    onChange(next);
  };
  return (
    <div className="pf-mpick">
      <button type="button" className="pf-mpick-arrow" aria-label={t("Previous year")} disabled={value <= min} onClick={() => step(-1)}>
        <ChevronLeft size={15} strokeWidth={2.4} />
      </button>
      <span className="pf-mpick-current" aria-live="polite">
        <span key={value} className="pf-mpick-label pf-rounded" data-dir={dir}>{value}</span>
      </span>
      <button type="button" className="pf-mpick-arrow" aria-label={t("Next year")} disabled={value >= max} onClick={() => step(1)}>
        <ChevronRight size={15} strokeWidth={2.4} />
      </button>
    </div>
  );
}
