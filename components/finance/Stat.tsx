/** A headline figure in a card: label, big number, optional hint. */
export default function Stat({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <div className="pf-card" style={{ padding: 16 }}>
      <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{label}</div>
      <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</div>
      {hint && <div style={{ fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>{hint}</div>}
    </div>
  );
}
