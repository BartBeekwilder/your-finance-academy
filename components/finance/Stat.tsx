import { t } from "@/lib/i18n";
/** A headline figure in a card: label, big number, optional hint, and an
 *  optional `progress` (share of an expected total) as a thin line that
 *  fills in on first paint, with its percentage. */
export default function Stat({
  label,
  value,
  color,
  hint,
  progress,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
  progress?: { share: number; of: string };
}) {
  return (
    <div className="pf-card" style={{ padding: 16 }}>
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
  );
}
