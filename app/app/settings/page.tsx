"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import BrandMark from "@/components/finance/BrandMark";
import { useFinance } from "@/components/finance/FinanceProvider";
import { CURRENCIES, currencySymbol } from "@/lib/finance/currencies";
import { money } from "@/lib/finance/format";
import { setMotionPaused, useMotionPaused } from "@/lib/motion";
import { setShowAxes, useShowAxes } from "@/lib/prefs";
import Segmented from "@/components/finance/Segmented";

// Settings, grouped in sections so new ones slot in as the app grows.
// Currency is saved to the profile (shared with iOS); it changes how amounts
// are shown — it doesn't convert them.

export default function SettingsPage() {
  const { data, source, email, updateProfile, signOut } = useFinance();
  const current = data.profile.currency_code;
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "saved" | "error"; text: string } | null>(null);

  async function choose(code: string) {
    if (code === current || saving) return;
    setSaving(code);
    setStatus(null);
    try {
      await updateProfile({ currency_code: code });
      setStatus({ kind: "saved", text: source === "demo" ? "Changed for this demo" : "Saved — your other devices follow" });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    }
    setSaving(null);
  }

  return (
    <div style={{ display: "grid", gap: 28, maxWidth: 860 }}>
      <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.1rem)", fontWeight: 700 }}>Settings</h1>

      <Section title="Currency" hint="How amounts are shown everywhere. Existing amounts aren't converted.">
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <BrandMark size={56} currency={current} />
          <div>
            <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{money(1234.56, current)}</div>
            <div key={status?.text ?? "idle"} className="pf-readout" style={{ fontSize: "0.8rem", color: status?.kind === "error" ? "var(--pf-red)" : "var(--pf-ink-3)" }}>
              {status?.text ?? "Example amount"}
            </div>
          </div>
        </div>
        <div className="pf-currency-grid" role="radiogroup" aria-label="Currency">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              role="radio"
              aria-checked={c.code === current}
              className="pf-currency"
              disabled={saving !== null}
              onClick={() => choose(c.code)}
            >
              <span className="pf-currency-symbol pf-rounded">{currencySymbol(c.code)}</span>
              <span style={{ display: "grid", textAlign: "left", minWidth: 0 }}>
                <b style={{ fontSize: "0.85rem" }}>{c.code}</b>
                <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
              </span>
              {c.code === current && <Check size={16} className="pf-currency-check" />}
              {saving === c.code && <span className="pf-currency-saving" aria-hidden />}
            </button>
          ))}
        </div>
      </Section>

      <ChartsSection />

      <Section title="Account">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{source === "demo" ? "Demo" : email}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--pf-ink-3)" }}>
              {source === "demo" ? "Demo data — nothing is saved" : "Signed in · your data syncs to your other devices"}
            </div>
          </div>
          <button className="pf-chip" onClick={signOut} style={{ padding: "8px 14px" }}>
            {source === "demo" ? "Leave demo" : "Sign out"}
          </button>
        </div>
      </Section>

      {process.env.NODE_ENV === "development" && <DevelopmentSection />}
    </div>
  );
}

/** Chart preferences — kept in this browser. */
function ChartsSection() {
  const showAxes = useShowAxes();
  return (
    <Section title="Charts" hint="Kept on this device.">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>Values on chart axes</div>
          <div style={{ fontSize: "0.8rem", color: "var(--pf-ink-3)" }}>The amounts down the left of every chart, like €10K · €5K · €0.</div>
        </div>
        <Segmented
          label="Values on chart axes"
          value={showAxes ? "on" : "off"}
          onChange={(v) => setShowAxes(v === "on")}
          options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]}
        />
      </div>
    </Section>
  );
}

function DevelopmentSection() {
  const paused = useMotionPaused();
  return (
    <Section title="Development" hint="Only on the local version.">
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={paused} onChange={(e) => setMotionPaused(e.target.checked)} />
        Pause animations <span style={{ color: "var(--pf-ink-3)" }}>— spares a slow computer</span>
      </label>
    </Section>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="pf-card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 650 }}>{title}</h2>
      {hint && <p style={{ margin: "4px 0 14px", fontSize: "0.82rem", color: "var(--pf-ink-2)" }}>{hint}</p>}
      {!hint && <div style={{ height: 12 }} />}
      {children}
    </section>
  );
}
