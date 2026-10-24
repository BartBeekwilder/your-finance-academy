"use client";

import { money } from "@/lib/finance/format";
import { useLiveDecimals } from "@/lib/motion";

/** A live currency amount shown to five decimals: the normal amount in
 *  cents, then three small digits for the fractions of a cent. Both come
 *  from one truncated figure, so the small digits are the real continuation
 *  of the number — when they roll over 999 → 000 the cent ticks up (or down,
 *  for a falling value). Rounding the cents instead would make the cent move
 *  at …500 and the digits look disconnected. Used by the net worth ticker
 *  and the Income/Spent/Balance tiles. Settings › Animations can cut the
 *  small digits to one or none (Live decimals 3 / 2). */
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

  return (
    <span className="pf-rounded" style={{ display: "inline-flex", alignItems: "baseline", color, fontVariantNumeric: "tabular-nums" }}>
      <span style={{ fontSize: size, fontWeight: 700, lineHeight: 1.15 }}>{money(shown, currency)}</span>
      {decimals > 2 && (
        <span style={{ fontSize: `calc(${size} * 0.45)`, fontWeight: 600, opacity: 0.6 }}>
          {decimals === 5 ? String(sub).padStart(3, "0") : String(Math.trunc(sub / 100))}
        </span>
      )}
    </span>
  );
}
