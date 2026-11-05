"use client";

import { intlLocale, t } from "@/lib/i18n";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { money, monthYear } from "@/lib/finance/format";
import type { Metric } from "@/lib/finance/metrics";
import { useFinance } from "./FinanceProvider";
import LiveAmount from "./LiveAmount";
import { useKeyFigures } from "./useKeyFigures";

// Key figures: the page (/app/figures) and the strip at the bottom of the
// dashboard. Everything from the books as they are now (useKeyFigures):
// the freedom number with how much of it is there and the year it's
// reached, what's being saved this month counting up by the second, a
// negative equity's way back to zero, and the figures with their rules of
// thumb (savings rate, runway, fixed costs of income, an hour of work, free
// to spend per day, equity in months of living, debt ratio).

const TONE: Record<Metric["tone"], string> = { good: "#4ade80", ok: "#fbbf24", bad: "#ff6961", neutral: "#c4b5fd" };

function fmt(m: Metric, currency: string) {
  const n = (v: number, d = 1) => v.toLocaleString(intlLocale(), { maximumFractionDigits: d, minimumFractionDigits: 0 });
  if (m.unit === "pct") return `${n(m.value * 100, 0)}%`;
  if (m.unit === "money") return money(m.value, currency);
  if (m.unit === "months") return t("{n} months", { n: n(m.value) });
  if (m.unit === "years") return t("{n} years", { n: n(m.value) });
  return n(m.value);
}

function useTick(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function MetricCard({ m, currency, i }: { m: Metric; currency: string; i: number }) {
  return (
    <div className="pf-kf-card" style={{ ["--c" as string]: TONE[m.tone], ["--d" as string]: `${i * 60}ms` }}>
      <span className="pf-kf-label">{t(m.label)}</span>
      <b className="pf-rounded pf-kf-value">{fmt(m, currency)}</b>
      {m.bar != null && <i className="pf-kf-bar"><em style={{ ["--f" as string]: Math.max(0, Math.min(1, m.bar)) }} /></i>}
      <small>{t(m.note)}</small>
    </div>
  );
}

export function KeyFiguresPage() {
  const { data } = useFinance();
  const currency = data.profile.currency_code;
  const k = useKeyFigures();
  const now = useTick(250);
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const savedSoFar = k.perSecond * ((now - start) / 1000);
  const fi = k.freedom;
  const ring = Math.max(0, Math.min(1, fi.share));
  const R = 54, C = 2 * Math.PI * R;
  const positiveAt = k.toPositive != null ? new Date(d.getFullYear(), d.getMonth() + k.toPositive, 1) : null;

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <header>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>{t("Key figures")}</h1>
        <p style={{ margin: "4px 0 0", color: "var(--pf-ink-2)" }}>{t("How you're doing, in a few numbers — live from your books.")}</p>
      </header>

      <div className="pf-kf-hero">
        <section className="pf-card pf-kf-fi">
          <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden>
            <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
            <circle cx="64" cy="64" r={R} fill="none" stroke="url(#pf-kf-g)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} transform="rotate(-90 64 64)" className="pf-kf-ring" />
            <defs>
              <linearGradient id="pf-kf-g" x1="0" x2="1"><stop offset="0" stopColor="#30d158" /><stop offset="1" stopColor="#64d2ff" /></linearGradient>
            </defs>
            <text x="64" y="70" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">{Math.round(fi.share * 100)}%</text>
          </svg>
          <div>
            <span className="pf-kf-label">{t("Your freedom number")}</span>
            <b className="pf-rounded pf-kf-big">{money(fi.target, currency)}</b>
            <small>{t("25 times what you spend in a year: from this amount, invested, you could live off about 4% a year — for good.")}</small>
            <small className="pf-kf-when">
              {fi.years == null
                ? t("Save something each month to start moving towards it.")
                : fi.years <= 0
                  ? t("You're there already.")
                  : t("You keep {left} a month. Invest that every month at 5% growth a year (a cautious average) and you reach this amount in about {n} years, in {year}.", { left: money(k.left, currency), n: Math.ceil(fi.years), year: d.getFullYear() + Math.ceil(fi.years) })}
            </small>
          </div>
        </section>

        <section className="pf-card pf-kf-live">
          <span className="pf-kf-label"><i className="pf-ob-live-dot" /> {t("Saved this month so far")}</span>
          <LiveAmount value={savedSoFar} currency={currency} size="2rem" color={savedSoFar >= 0 ? "#4ade80" : "#ff6961"} />
          <small>{t("{rate} every second — income and spending spread over the month.", { rate: new Intl.NumberFormat(intlLocale(), { style: "currency", currency, minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(k.perSecond) })}</small>
          {k.equity < 0 && (
            <div className="pf-kf-turn">
              <span>{t("Your equity turns positive in")}</span>
              <b className="pf-rounded">{k.toPositive != null ? t("{n} months", { n: k.toPositive }) : "—"}</b>
              <small>{positiveAt ? t("Around {month}, saving {left} a month.", { month: monthYear(positiveAt), left: money(k.left, currency) }) : t("Save something each month and your equity starts climbing towards zero.")}</small>
            </div>
          )}
        </section>
      </div>

      <div className="pf-kf-grid">
        {k.metrics.map((m, i) => <MetricCard key={m.key} m={m} currency={currency} i={i} />)}
      </div>

      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--pf-ink-3)" }}>
        {t("This month as expected (the same forecast as Budgets); accounts and investments as they are now, investments at market value.")}
      </p>
    </div>
  );
}

/** The dashboard's strip: four figures and a link to the page. */
export function KeyFiguresStrip() {
  const { data } = useFinance();
  const currency = data.profile.currency_code;
  const k = useKeyFigures();
  const pick = ["rate", "runway", "day", "debt"].map((key) => k.metrics.find((m) => m.key === key)).filter(Boolean) as Metric[];
  if (!pick.length) return null;
  return (
    <section className="pf-card pf-kf-strip">
      <div className="pf-kf-striphead">
        <h2 className="pf-section-title" style={{ margin: 0 }}><Sparkles size={15} /> {t("Key figures")}</h2>
        <Link href="/app/figures" className="pf-link">{t("All key figures")} <ArrowRight size={13} /></Link>
      </div>
      <div className="pf-kf-stripgrid">
        <div className="pf-kf-mini" style={{ ["--c" as string]: "#4ade80" }}>
          <span>{t("Freedom number")}</span>
          <b className="pf-rounded">{Math.round(k.freedom.share * 100)}%</b>
          <small>{t("of {amount}", { amount: money(k.freedom.target, currency) })}</small>
        </div>
        {pick.map((m) => (
          <div key={m.key} className="pf-kf-mini" style={{ ["--c" as string]: TONE[m.tone] }}>
            <span>{t(m.label)}</span>
            <b className="pf-rounded">{fmt(m, currency)}</b>
            {m.bar != null && <i className="pf-kf-bar"><em style={{ ["--f" as string]: Math.max(0, Math.min(1, m.bar)) }} /></i>}
          </div>
        ))}
      </div>
    </section>
  );
}
