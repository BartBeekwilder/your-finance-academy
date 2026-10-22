"use client";

/** Scrubber in the brand-toggle style: gradient fill up to the chosen step,
 *  a glowing thumb, and clickable labels. Used under the donut for months
 *  (Month mode) or years with data (Year mode); when `steps` change, the
 *  labels swap with a slide-and-fade and the thumb glides to its new spot.
 *  Built on a native range input (drag, touch, click, arrow keys).
 *  Disabled steps (future months) show but can't be chosen. */
/** `faint`: selectable, but shown faded (e.g. forecast months). */
export type Step = { label: string; short?: string; full: string; disabled?: boolean; faint?: boolean };

export default function StepSlider({
  steps,
  value,
  onChange,
  label,
  animKey,
}: {
  steps: Step[];
  value: number;
  onChange: (index: number) => void;
  label: string;
  /** Changes when the set of steps changes, to replay the label swap. */
  animKey: string;
}) {
  const n = steps.length;
  // A single step sits in the middle; otherwise spread 0–100%.
  const pct = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const lastEnabled = steps.reduce((last, s, i) => (s.disabled ? last : i), 0);

  return (
    <div
      className="pf-mslider"
      style={{ ["--fill" as string]: `${pct(value)}%`, ["--avail" as string]: `${pct(lastEnabled)}%` }}
    >
      <div className="pf-mslider-rail">
        <span className="pf-mslider-avail" />
        <span className="pf-mslider-fill" />
        <input
          type="range"
          // One step: centre the thumb on a -1..1 range and lock it.
          min={n === 1 ? -1 : 0}
          max={n === 1 ? 1 : n - 1}
          step={1}
          value={n === 1 ? 0 : value}
          disabled={n === 1}
          aria-label={label}
          aria-valuetext={steps[value]?.full}
          onChange={(e) => onChange(Math.min(Number(e.target.value), lastEnabled))}
        />
      </div>
      <div key={animKey} className="pf-mslider-labels pf-labels-swap">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            disabled={s.disabled}
            data-on={i === value}
            data-faint={s.faint || undefined}
            onClick={() => onChange(i)}
            style={{ left: `${pct(i)}%`, animationDelay: `${i * 25}ms` }}
            aria-label={s.full}
          >
            <span className="pf-label-long">{s.label}</span>
            <span className="pf-label-short">{s.short ?? s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
