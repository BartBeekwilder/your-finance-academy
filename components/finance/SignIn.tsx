"use client";

import { t } from "@/lib/i18n";
import { useState, type FormEvent } from "react";
import { guessCurrency } from "@/lib/finance/currencies";
import { getSupabase } from "@/lib/supabase";
import BrandMark from "./BrandMark";

// Sign-in for the web app — same options as iOS:
//   • Sign in with Apple
//   • email + password (primary), with "Create account" and "Forgot password?"
//   • "Email me a code instead": a 6-digit code, no links
// New accounts confirm their email with a 6-digit code; a forgotten password
// is reset with a code too. (The Supabase email templates send {{ .Token }}.)
// "Look around with demo data" stays available without an account.

type Step =
  | { kind: "signin" }
  | { kind: "signup" }
  | { kind: "code" }
  | { kind: "forgot" }
  | { kind: "verify"; email: string; type: "signup" | "email" | "recovery" }
  | { kind: "newPassword" };

/** Set while a password reset is in progress (read by FinanceProvider). */
export const RECOVERY_KEY = "pf-recovery";

export default function SignIn({ onDemo, onLocal, onLocalNew }: { /** Omitted: no demo link (e.g. signing in from Settings). */ onDemo?: () => void; /** Dev only: open the private data file on this computer. */ onLocal?: () => void; /** Dev only, no file yet: start one (to restore an encrypted copy). */ onLocalNew?: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "signin" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const go = (next: Step) => {
    setError("");
    setNote("");
    setCode("");
    setStep(next);
  };

  async function run(fn: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true);
    setError("");
    const { error } = await fn();
    setBusy(false);
    if (error) setError(error.message);
    return !error;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    const mail = email.trim();

    switch (step.kind) {
      case "signin":
        // On success the provider's auth listener takes over.
        await run(() => supabase.auth.signInWithPassword({ email: mail, password }));
        break;
      case "signup":
        if (await run(() => supabase.auth.signUp({ email: mail, password }))) {
          go({ kind: "verify", email: mail, type: "signup" });
          setNote(t("We emailed you a 6-digit code to confirm your address."));
        }
        break;
      case "code":
        if (await run(() => supabase.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false } }))) {
          go({ kind: "verify", email: mail, type: "email" });
          setNote(t("We emailed you a 6-digit code."));
        }
        break;
      case "forgot":
        if (await run(() => supabase.auth.resetPasswordForEmail(mail))) {
          go({ kind: "verify", email: mail, type: "recovery" });
          setNote(t("We emailed you a 6-digit code to reset your password."));
        }
        break;
      case "verify": {
        // A recovery code signs you in; this flag keeps the app on this
        // screen (see FinanceProvider) until a new password has been set.
        if (step.type === "recovery") sessionStorage.setItem(RECOVERY_KEY, "1");
        const ok = await run(() => supabase.auth.verifyOtp({ email: step.email, token: code.trim(), type: step.type }));
        if (!ok) sessionStorage.removeItem(RECOVERY_KEY);
        // Recovery signs you in; choose a new password before continuing.
        if (ok && step.type === "recovery") go({ kind: "newPassword" });
        break;
      }
      case "newPassword":
        if (await run(() => supabase.auth.updateUser({ password }))) {
          sessionStorage.removeItem(RECOVERY_KEY);
          // Now let the provider load the account.
          await supabase.auth.refreshSession();
        }
        break;
    }
  }

  async function apple() {
    const supabase = getSupabase();
    if (!supabase) return;
    await run(() => supabase.auth.signInWithOAuth({ provider: "apple", options: { redirectTo: `${location.origin}/app` } }));
  }

  const titles: Record<Step["kind"], [string, string]> = {
    signin: ["Personal Finance", t("Sign in to see the same budgets and transactions as on your iPhone.")],
    signup: [t("Create your account"), t("Your data syncs between your iPhone, iPad and the web.")],
    code: [t("Sign in with a code"), t("We'll email you a 6-digit code — no password needed.")],
    forgot: [t("Reset your password"), t("We'll email you a 6-digit code.")],
    verify: [t("Enter your code"), t("Check your email for the 6-digit code.")],
    newPassword: [t("Choose a new password"), t("At least 8 characters.")],
  };
  const [title, subtitle] = titles[step.kind];
  const needsEmail = step.kind === "signin" || step.kind === "signup" || step.kind === "code" || step.kind === "forgot";
  const needsPassword = step.kind === "signin" || step.kind === "signup" || step.kind === "newPassword";
  const cta: Record<Step["kind"], string> = {
    signin: t("Sign in"),
    signup: t("Create account"),
    code: t("Email me a code"),
    forgot: t("Email me a code"),
    verify: t("Continue"),
    newPassword: t("Save password"),
  };

  return (
    <div style={{ minHeight: "70dvh", display: "grid", placeItems: "center" }}>
      <div className="pf-card" style={{ width: "100%", maxWidth: 400, padding: 28, display: "grid", gap: 16, borderRadius: 18 }}>
        <BrandMark size={52} currency={guessCurrency()} />
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700 }}>{title}</h1>
          <p style={{ margin: "4px 0 0", color: "var(--pf-ink-2)" }}>{subtitle}</p>
        </div>

        {step.kind === "signin" && (
          <>
            <button type="button" className="pf-apple" onClick={apple} disabled={busy}>
              <svg width="16" height="18" viewBox="0 0 814 1000" aria-hidden fill="currentColor">
                <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-164-40c-76 0-103 41-166 41s-106-57-156-127C45 791 0 666 0 548 0 358 124 257 246 257c65 0 119 43 160 43 39 0 100-45 174-45 28 0 129 2 196 86zM558 158c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 2 14 2 45 0 101-30 134-72z" />
              </svg>
              {t("Sign in with Apple")}
            </button>
            <div className="pf-or"><span>{t("or")}</span></div>
          </>
        )}

        {note && <p className="pf-card" style={{ padding: 12, margin: 0, background: "rgba(48,209,88,.12)", fontSize: "0.85rem" }}>{note}</p>}

        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          {needsEmail && (
            <input
              type="email"
              required
              autoComplete="email"
              placeholder={t("Email")}
              aria-label={t("Email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pf-input"
            />
          )}
          {needsPassword && (
            <input
              type="password"
              required
              minLength={step.kind === "signin" ? undefined : 8}
              autoComplete={step.kind === "signin" ? "current-password" : "new-password"}
              placeholder={step.kind === "newPassword" ? t("New password") : t("Password")}
              aria-label={t("Password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pf-input"
            />
          )}
          {step.kind === "verify" && (
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="••••••"
              aria-label={t("Code")}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="pf-input pf-rounded pf-code"
            />
          )}
          <button className="pf-button" disabled={busy}>{busy ? t("One moment…") : cta[step.kind]}</button>
          {error && <p style={{ margin: 0, color: "var(--pf-red)", fontSize: "0.85rem" }}>{error}</p>}
        </form>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
          {step.kind === "signin" ? (
            <>
              <button type="button" className="pf-link" onClick={() => go({ kind: "signup" })}>{t("Create account")}</button>
              <button type="button" className="pf-link" onClick={() => go({ kind: "forgot" })}>{t("Forgot password?")}</button>
            </>
          ) : (
            <button type="button" className="pf-link" onClick={() => go({ kind: "signin" })}>← Back to sign in</button>
          )}
        </div>

        {step.kind === "signin" && (
          <button type="button" className="pf-link" style={{ color: "var(--pf-ink-2)" }} onClick={() => go({ kind: "code" })}>
            {t("Email me a code instead")}
          </button>
        )}

        {onLocal && (
          <button type="button" onClick={onLocal} className="pf-link pf-local-open">
            {t("Open my local data (this computer only)")}
          </button>
        )}
        {onLocalNew && (
          <button type="button" onClick={onLocalNew} className="pf-link pf-local-open" title={t("Creates an empty private file on this computer; restore your encrypted copy into it in Settings.")}>
            {t("Start local data on this computer (to restore an encrypted copy)")}
          </button>
        )}

        {onDemo && (
          <button type="button" onClick={onDemo} className="pf-link" style={{ color: "var(--pf-ink-3)" }}>
            {t("Look around with demo data first")}
          </button>
        )}
      </div>
    </div>
  );
}
