"use client";

/** Month scrubber under the donut, in the brand-toggle style: a gradient
 *  track filled up to the chosen month, a glowing thumb, and month letters
 *  you can also click. Built on a native range input, so it works with
 *  drag, touch, click and the arrow keys. Months after `current` are
 *  shown but can't be chosen. Styles: .pf-mslider* in finance.css. */
export default function MonthSlider({
  value,
  current,
  year,
  dimmed,
  onChange,
}: {
  value: number;
  current: number;
  year: number;
  /** True while the donut shows the whole year: no month is "selected". */
  dimmed: boolean;
  onChange: (month: number) => void;
}) {
  const pct = (i: number) => (i / 11) * 100;
  const name = (i: number) => new Date(year, i, 1).toLocaleDateString("en-GB", { month: "long" });

  return (
    <div className="pf-mslider" data-dimmed={dimmed} style={{ ["--fill" as string]: `${pct(value)}%`, ["--avail" as string]: `${pct(current)}%` }}>
      <div className="pf-mslider-rail">
        <span className="pf-mslider-avail" />
        <span className="pf-mslider-fill" />
        <input
          type="range"
          min={0}
          max={11}
          step={1}
          value={value}
          aria-label="Month"
          aria-valuetext={`${name(value)} ${year}`}
          onChange={(e) => onChange(Math.min(Number(e.target.value), current))}
        />
      </div>
      <div className="pf-mslider-labels">
        {Array.from({ length: 12 }, (_, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            disabled={i > current}
            data-on={!dimmed && i === value}
            data-now={i === current}
            onClick={() => onChange(i)}
            style={{ left: `${pct(i)}%` }}
            aria-label={name(i)}
          >
            {name(i).slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}
