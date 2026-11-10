"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Check, Crown } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { money } from "@/lib/finance/format";
import { TRIAL_DAYS, type BillingStatus, type PlanKey, type PlanPrice } from "@/lib/billing/plans";
import { intlLocale, t } from "@/lib/i18n";

// Settings › Personal Finance Premium: pick a plan and start the free trial
// (Stripe Checkout), or — with Premium — see until when and manage it
// (Stripe's customer portal; a subscription from an app store is managed
// there). Hidden until billing is set up (the prices route answers 503).

const PLAN_LABEL: Record<PlanKey, string> = { monthly: "Monthly", yearly: "Yearly", "2year": "2 years" };

const date = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" });

export default function SubscriptionCard() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [prices, setPrices] = useState<PlanPrice[] | null>(null);
  const [test, setTest] = useState(false);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plan, setPlan] = useState<PlanKey>("yearly");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  // When a trial started now would end (shown under the button).
  const [trialEnds] = useState(() => new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString());

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    fetch("/api/billing/prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { prices: PlanPrice[]; test: boolean } | null) => {
        if (!j?.prices.length) return;
        setPrices(j.prices);
        setTest(j.test);
      })
      .catch(() => {});
  }, []);

  const call = async (path: string, method: "GET" | "POST", body?: object) => {
    const r = await fetch(path, { method, headers: { Authorization: `Bearer ${session?.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? t("Something went wrong."));
    return j;
  };

  // Status, and — back from Checkout — hand the subscription over first.
  useEffect(() => {
    if (!session || !prices) return;
    const q = new URLSearchParams(location.search);
    const back = q.get("billing"), sessionId = q.get("session_id");
    if (back) history.replaceState(null, "", `${location.pathname}#subscription`);
    (async () => {
      try {
        if (back === "success" && sessionId) {
          setStatus(await call("/api/billing/sync", "POST", { session_id: sessionId }));
          setMsg({ kind: "ok", text: t("Welcome to Premium! Your free trial has started.") });
        } else {
          setStatus(await call("/api/billing/status", "GET"));
          if (back === "cancel") setMsg({ kind: "ok", text: t("No problem — nothing was charged.") });
        }
      } catch (err) {
        setMsg({ kind: "error", text: (err as Error).message });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, prices]);

  if (!prices) return null;

  async function go(path: string, body?: object) {
    setBusy(true);
    setMsg(null);
    try {
      const { url } = await call(path, "POST", body);
      location.href = url;
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
      setBusy(false);
    }
  }

  const monthly = prices.find((p) => p.key === "monthly");
  const chosen = prices.find((p) => p.key === plan) ?? prices[0];
  const perMonth = (p: PlanPrice) => p.amount / p.months;
  const saving = (p: PlanPrice) => (monthly && p.months > 1 ? 1 - perMonth(p) / monthly.amount : 0);

  return (
    <section id="subscription" className="pf-card pf-sub" style={{ padding: 20, scrollMarginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Crown size={20} color="#ffd60a" />
        <h2 style={{ fontSize: "1.05rem", fontWeight: 650, flex: 1 }}>{t("Personal Finance Premium")}</h2>
        {test && <span className="pf-sub-test">{t("Test mode")}</span>}
      </div>

      {status?.active ? (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <p className="pf-sub-on">
            <Check size={16} /> {status.trial ? t("Free trial") : t("Premium is active")}
            {status.plan && <span> · {t(PLAN_LABEL[status.plan])}</span>}
          </p>
          {status.expires && (
            <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>
              {status.cancelled
                ? t("Cancelled — Premium stays until {date}.", { date: date(status.expires) })
                : status.trial
                  ? t("Free until {date}; then it renews.", { date: date(status.expires) })
                  : t("Renews on {date}.", { date: date(status.expires) })}
            </p>
          )}
          {status.store === "stripe" ? (
            <button className="pf-button" style={{ justifySelf: "start" }} disabled={busy} onClick={() => go("/api/billing/portal")}>{t("Manage subscription")}</button>
          ) : (
            <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("Bought in the app — manage it in the App Store or Google Play.")}</p>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("All dashboards on all your devices. Try it {n} days for free; cancel any time.", { n: TRIAL_DAYS })}</p>
          <div className="pf-sub-plans" role="radiogroup" aria-label={t("Plan")}>
            {prices.map((p) => (
              <button key={p.key} type="button" role="radio" aria-checked={p.key === plan} className="pf-sub-plan" onClick={() => setPlan(p.key)}>
                <span className="pf-sub-plan-name">{t(PLAN_LABEL[p.key])}</span>
                <b className="pf-rounded">{money(p.amount, p.currency)}</b>
                <span className="pf-sub-plan-per">{p.months > 1 ? t("{amount} a month", { amount: money(perMonth(p), p.currency) }) : t("billed monthly")}</span>
                {saving(p) >= 0.05 && <span className="pf-sub-save">{t("Save {pct}", { pct: `${Math.round(saving(p) * 100)}%` })}</span>}
                {p.key === "2year" && <span className="pf-sub-only">{t("Web only")}</span>}
              </button>
            ))}
          </div>
          {session ? (
            <>
              <button className="pf-button pf-sub-go" disabled={busy} onClick={() => go("/api/billing/checkout", { plan })}>
                {busy ? t("One moment…") : t("Start {n}-day free trial", { n: TRIAL_DAYS })}
              </button>
              <p style={{ color: "var(--pf-ink-3)", fontSize: "0.75rem" }}>
                {t("Free until {date}, then {amount} — unless you cancel before. Payment is handled by Stripe.", { date: date(trialEnds), amount: money(chosen.amount, chosen.currency) })}
              </p>
            </>
          ) : (
            <p className="pf-close-note">{t("Sign in to start your free trial — Premium is tied to your account, so it works on every device.")}</p>
          )}
        </div>
      )}
      {msg && <p className="pf-readout" style={{ marginTop: 10, fontSize: "0.82rem", color: msg.kind === "error" ? "var(--pf-red)" : "var(--pf-green)" }}>{msg.text}</p>}
    </section>
  );
}
