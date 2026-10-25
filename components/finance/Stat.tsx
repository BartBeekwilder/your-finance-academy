import { t } from "@/lib/i18n";
import type { ReactNode } from "react";
/** A headline figure in a card: label, big number, optional hint, and an
 *  optional `progress` (share of an expected total) as a thin line that
 *  fills in on first paint, with its percentage. */
export default function Stat({
  label,
  value,
  color,
  hint,
  progress,
  side,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
  progress?: { share: number; of: string };
  /** Something small beside the number (e.g. ExpectedBar). */
  side?: ReactNode;
}) {
  return (
    <div className="pf-card" style={{ padding: 16, display: side ? "flex" : undefined, gap: 14, alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{label}</div>
      <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</div>
      {hint && <div style={{ fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>{hint}</div>}
      {progress && (
        <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
          <div className="pf-stat-track">
            <span style={{ width: `${Math.min(progress.share, 1) * 100}%`, background: color ?? "var(--pf-ink-2)" }} />
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--pf-ink-3)" }}>
            <b className="pf-rounded" style={{ color: "var(--pf-ink-2)" }}>{Math.round(progress.share * 100)}%</b> {t("of {total}", { total: progress.of })}
          </div>
        </div>
      )}
      </div>
      {side}
    </div>
  );
}

/** A small upright bar: what's in so far (solid) inside what's expected
 *  (dashed outline), with the share — the Expenses "Expected" tile. */
export function ExpectedBar({ done, expected, color = "var(--pf-red)" }: { done: number; expected: number; color?: string }) {
  const share = expected > 0 ? Math.min(done / expected, 1) : 0;
  return (
    <div className="pf-expbar" style={{ ["--c" as string]: color }} aria-hidden>
      <div className="pf-expbar-track">
        <span style={{ height: `${share * 100}%` }} />
      </div>
      <b className="pf-rounded">{Math.round(share * 100)}%</b>
    </div>
  );
}
