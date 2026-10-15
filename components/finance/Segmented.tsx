"use client";

import { useState } from "react";

/** The brand toggle: a glass pill with a slowly orbiting violet→teal rim
 *  and a glowing gradient thumb. Switching moves the thumb like liquid —
 *  the leading edge shoots ahead, the trailing edge catches up a beat later
 *  (so it stretches in flight and springs back) — and a glint sweeps
 *  across it as it lands. Styles: .pf-seg* in finance.css. */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  // Direction of the last move decides which edge leads.
  const [dir, setDir] = useState<"left" | "right">("right");
  const [moves, setMoves] = useState(0);
  const n = options.length;

  const pick = (i: number) => {
    if (i === index) return;
    setDir(i > index ? "right" : "left");
    setMoves((m) => m + 1);
    onChange(options[i].value);
  };

  return (
    <div role="tablist" aria-label={label} className="pf-seg" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
      <span
        className="pf-seg-thumb"
        data-dir={dir}
        style={{ left: `calc(${(index / n) * 100}% + 3px)`, right: `calc(${((n - 1 - index) / n) * 100}% + 3px)` }}
        aria-hidden
      >
        {/* Keyed so the glint replays on every move (not on first paint). */}
        {moves > 0 && <span key={moves} className="pf-seg-glint" />}
      </span>
      {options.map((o, i) => (
        <button key={o.value} role="tab" aria-selected={i === index} className="pf-seg-option" onClick={() => pick(i)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
