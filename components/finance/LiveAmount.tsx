import { money } from "@/lib/finance/format";

/** A currency amount followed by three small "streaming" digits — the
 *  fractions of a cent below the displayed value, taken from the real live
 *  figure, so they spin while money accrues and freeze when nothing moves.
 *  Used by the net worth ticker and the Income/Spent/Balance tiles. */
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
  const subCent = Math.floor(Math.abs(value * 100 - Math.trunc(value * 100)) * 1000);
  return (
    <span className="pf-rounded" style={{ display: "inline-flex", alignItems: "baseline", gap: 1, color }}>
      <span style={{ fontSize: size, fontWeight: 700, lineHeight: 1.15 }}>{money(value, currency)}</span>
      <span style={{ fontSize: `calc(${size} * 0.4)`, fontWeight: 600, opacity: 0.55 }}>
        {String(subCent).padStart(3, "0")}
      </span>
    </span>
  );
}
