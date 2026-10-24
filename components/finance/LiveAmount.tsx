"use client";

import { useRef } from "react";
import { money } from "@/lib/finance/format";
import { tickerMs, useLiveDecimals } from "@/lib/motion";

/** A live currency amount shown to five decimals: the normal amount in
 *  cents, then three small digits for the fractions of a cent. Both come
 *  from one truncated figure, so the small digits are the real continuation
 *  of the number — when they roll over 999 → 000 the cent ticks up (or down,
 *  for a falling value). Rounding the cents instead would make the cent move
 *  at …500 and the digits look disconnected. Used by the net worth ticker
 *  and the Income/Spent/Balance tiles. Settings › Animations can cut the
 *  small digits to two, one or none (Live decimals 4 / 3 / 2; 4 by default).
 *
 *  Each digit rolls like an odometer: only the digits that change slide in
 *  (up while the amount rises, down while it falls), taking about one tick,
 *  so the steps read as one continuous movement. */
export default function LiveAmount({
  value,
  currency,
  size,
  color,
}: {
  value: number;
  currency: string;
  size: string;
  color?: string;
}) {
  // Work in thousandths of a cent, truncated toward zero, so the cents and
  // the trailing digits are cut from the same number.
  const milli = Math.trunc(value * 100_000);
  const cents = Math.trunc(milli / 1000);
  const sub = Math.abs(milli - cents * 1000);
  // A value between -1 and 0 cents truncates to 0; keep its minus sign.
  const shown = cents === 0 && milli < 0 ? -0 : cents / 100;
  const decimals = useLiveDecimals();
  const small = decimals > 2 ? String(Math.trunc(sub / 10 ** (5 - decimals))).padStart(decimals - 2, "0") : "";

  // Direction of travel since the last render, for the roll.
  const last = useRef<number | null>(null);
  const dir = last.current === null || value >= last.current ? "up" : "down";
  last.current = value;

  return (
    <span
      className="pf-rounded pf-roll"
      data-dir={dir}
      style={{ display: "inline-flex", alignItems: "baseline", color, fontVariantNumeric: "tabular-nums", ["--roll" as string]: `${Math.min(tickerMs(decimals), 400)}ms` }}
    >
      <span style={{ fontSize: size, fontWeight: 700, lineHeight: 1.15 }}>
        <Digits text={money(shown, currency)} />
      </span>
      {small && (
        <span style={{ fontSize: `calc(${size} * 0.45)`, fontWeight: 600, opacity: 0.6 }}>
          <Digits text={small} />
        </span>
      )}
    </span>
  );
}

/** Characters keyed by their place from the right plus their value, so a
 *  digit that changes is a new element and plays the roll; the rest stay. */
function Digits({ text }: { text: string }) {
  const chars = [...text];
  return (
    <>
      {chars.map((ch, i) => {
        const place = chars.length - i;
        return /\d/.test(ch) ? (
          <span key={`${place}-${ch}`} className="pf-roll-d">
            {ch}
          </span>
        ) : (
          <span key={`${place}-${ch}`}>{ch}</span>
        );
      })}
    </>
  );
}
