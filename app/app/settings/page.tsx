"use client";

import { intlLocale, LANGUAGES, setLang, t, useLang } from "@/lib/i18n";
import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import BrandMark from "@/components/finance/BrandMark";
import { useFinance } from "@/components/finance/FinanceProvider";
import { CURRENCIES, currencyName, currencySymbol } from "@/lib/finance/currencies";
import { money } from "@/lib/finance/format";
import { setBackgroundMotion, setLiveDecimals, setMotionMode, useBackgroundMotion, useLiveDecimals, useMotionMode, type LiveDecimals, type MotionMode } from "@/lib/motion";
import { setShowAxes, useCategoryAreas, setCategoryAreas, useShowAxes } from "@/lib/prefs";
import Segmented from "@/components/finance/Segmented";
import VaultSection from "@/components/finance/VaultSection";
import HouseholdSection from "@/components/finance/HouseholdSection";
import { resetNavOrder } from "@/components/finance/AppNav";

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
      setStatus({ kind: "saved", text: source === "demo" ? t("Changed for this demo") : source === "local" ? t("Saved on this Mac") : t("Saved — your other devices follow") });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    }
    setSaving(null);
  }

  return (
    <div style={{ display: "grid", gap: 28, maxWidth: 860 }}>
      <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.1rem)", fontWeight: 700 }}>{t("Settings")}</h1>

      <Section title={t("Currency")} hint={t("How amounts are shown everywhere. Existing amounts aren't converted.")}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <BrandMark size={56} currency={current} />
          <div>
            <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{money(1234.56, current)}</div>
            <div key={status?.text ?? "idle"} className="pf-readout" style={{ fontSize: "0.8rem", color: status?.kind === "error" ? "var(--pf-red)" : "var(--pf-ink-3)" }}>
              {status?.text ?? t("Example amount")}
            </div>
          </div>
        </div>
        <div className="pf-currency-grid" role="radiogroup" aria-label={t("Currency")}>
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
                <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currencyName(c.code, intlLocale(), c.name)}</span>
              </span>
              {c.code === current && <Check size={16} className="pf-currency-check" />}
              {saving === c.code && <span className="pf-currency-saving" aria-hidden />}
            </button>
          ))}
        </div>
      </Section>

      <ChartsSection />

      <Section title={t("Menu")}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--pf-ink-2)" }}>{t("Drag the tabs in the sidebar to put them in your own order.")}</span>
          <button className="pf-chip" onClick={resetNavOrder} style={{ padding: "8px 14px" }}>
            {t("Standard order")}
          </button>
        </div>
      </Section>

      <LanguageSection />

      <Section title={t("Account")}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{source === "demo" ? t("Demo") : source === "local" ? t("Local data") : email}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--pf-ink-3)" }}>
              {source === "demo" ? t("Demo data — nothing is saved") : source === "local" ? t("Only on this Mac — not uploaded") : t("Signed in · your data syncs to your other devices")}
            </div>
          </div>
          <button className="pf-chip" onClick={signOut} style={{ padding: "8px 14px" }}>
            {source === "demo" ? t("Leave demo") : source === "local" ? t("Close local data") : t("Sign out")}
          </button>
        </div>
      </Section>

      <PaydaySection />

      <HouseholdSection />

      <VaultSection />

      <MotionSection />
    </div>
  );
}

/** The app's language — kept in this browser; also how amounts and dates
 *  are written. The iOS app follows the iPhone's own language setting. */
function LanguageSection() {
  const current = useLang();
  return (
    <Section title={t("Language")} hint={t("Kept on this device. Amounts and dates follow the language.")}>
      <div className="pf-currency-grid" role="radiogroup" aria-label={t("Language")}>
        {LANGUAGES.map((l) => (
          <button key={l.code} type="button" role="radio" aria-checked={l.code === current} className="pf-currency" onClick={() => setLang(l.code)}>
            <span className="pf-currency-symbol pf-rounded" style={{ fontSize: "0.7rem" }}>{l.code.slice(0, 2).toUpperCase()}</span>
            <span style={{ display: "grid", textAlign: "left", minWidth: 0 }}>
              <b style={{ fontSize: "0.85rem" }}>{l.name}</b>
            </span>
            {l.code === current && <Check size={16} className="pf-currency-check" />}
          </button>
        ))}
      </div>
    </Section>
  );
}

/** Chart preferences — kept in this browser. */
function ChartsSection() {
  const showAxes = useShowAxes();
  const areas = useCategoryAreas();
  return (
    <Section title={t("Charts")} hint={t("Kept on this device.")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{t("Spending and income by category")}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--pf-ink-3)" }}>{t("Per day or month as stacked areas with a line per category, or as stacked bars.")}</div>
        </div>
        <Segmented
          label={t("Category chart style")}
          value={areas ? "areas" : "bars"}
          onChange={(v) => setCategoryAreas(v === "areas")}
          options={[{ value: "areas", label: t("Areas") }, { value: "bars", label: t("Bars") }]}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{t("Values on chart axes")}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--pf-ink-3)" }}>{t("The amounts down the left of every chart, like €10K · €5K · €0.")}</div>
        </div>
        <Segmented
          label={t("Values on chart axes")}
          value={showAxes ? "on" : "off"}
          onChange={(v) => setShowAxes(v === "on")}
          options={[{ value: "off", label: t("Off") }, { value: "on", label: t("On") }]}
        />
      </div>
    </Section>
  );
}

/** How much the app moves: full, light (for a slower computer) or still,
 *  and the drifting background on its own. Kept per browser. */
function MotionSection() {
  const mode = useMotionMode();
  const background = useBackgroundMotion();
  const decimals = useLiveDecimals();
  const hint: Record<MotionMode, string> = {
    full: t("Live amounts tick smoothly, the background drifts, glows pulse."),
    light: t("Live amounts update once a second, the background moves slowly with fewer lines, glows play once. Uses much less processor."),
    off: t("Everything holds still. Amounts update when you open a page."),
  };
  return (
    <Section title={t("Animations")} hint={t("Kept on this device.")}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span>{t("Motion")}</span>
            <Segmented
              label={t("Motion")}
              value={mode}
              onChange={setMotionMode}
              options={[
                { value: "full", label: t("Full") },
                { value: "light", label: t("Light") },
                { value: "off", label: t("Off") },
              ]}
            />
          </div>
          <span key={mode} className="pf-readout" style={{ fontSize: "0.78rem", color: "var(--pf-ink-3)" }}>{hint[mode]}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", opacity: mode === "off" ? 0.45 : 1 }}>
          <span style={{ flex: "1 1 240px", maxWidth: 440 }}>
            {t("Live decimals")}
            <span style={{ display: "block", fontSize: "0.78rem", color: "var(--pf-ink-3)" }}>
              {t("Digits after the comma on the live amounts. Fewer digits update less often and use less processor.")}
            </span>
          </span>
          <Segmented
            label={t("Live decimals")}
            value={String(decimals)}
            onChange={(v) => setLiveDecimals(Number(v) as LiveDecimals)}
            options={(["2", "3", "4", "5"] as const).map((v) => ({ value: v, label: v }))}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", opacity: mode === "off" ? 0.45 : 1 }}>
          <span>
            {t("Moving background")}
            <span style={{ display: "block", fontSize: "0.78rem", color: "var(--pf-ink-3)" }}>{t("The drifting neon lines behind the app.")}</span>
          </span>
          <Segmented
            label={t("Moving background")}
            value={background && mode !== "off" ? "on" : "off"}
            onChange={(v) => setBackgroundMotion(v === "on")}
            options={[{ value: "off", label: t("Off") }, { value: "on", label: t("On") }]}
          />
        </div>
      </div>
    </Section>
  );
}

const PAYDAYS = [1, 15, 20, 23, 24, 25, 28];

/** The day the salary comes in: dates new salary entries and the
 *  Income page's "Payday". */
function PaydaySection() {
  const { data, updateProfile } = useFinance();
  const day = data.profile.payday_day;
  const set = (d: number) => void updateProfile({ payday_day: Math.min(Math.max(Math.round(d), 1), 31) });
  return (
    <Section title={t("Payday")} hint={t("The day your salary comes in. New salary entries start on this day; changing a salary's date can update it too.")}>
      <div className="pf-ob-days">
        {PAYDAYS.map((d) => (
          <button key={d} type="button" aria-pressed={day === d} onClick={() => set(d)}>
            {d}
          </button>
        ))}
        <input
          inputMode="numeric"
          aria-label={t("Other day")}
          placeholder="…"
          defaultValue={day && !PAYDAYS.includes(day) ? String(day) : ""}
          key={day ?? "none"}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (n >= 1 && n <= 31 && n !== day) set(n);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          style={day && !PAYDAYS.includes(day) ? { background: "linear-gradient(135deg, var(--pf-brand-a), var(--pf-brand-b))", borderColor: "transparent" } : undefined}
        />
      </div>
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
