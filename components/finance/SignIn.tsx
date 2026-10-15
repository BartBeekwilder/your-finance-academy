"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

// Passwordless sign-in: Supabase emails a one-time link that lands back on
// /app already signed in. The same account will sign in on iOS and Android,
// so data and subscription follow the person, not the device.

export default function SignIn({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/app` },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  return (
    <div style={{ minHeight: "70dvh", display: "grid", placeItems: "center" }}>
      <div className="pf-card" style={{ width: "100%", maxWidth: 400, padding: 28, display: "grid", gap: 16, borderRadius: 18 }}>
        <span className="pf-brand-mark" style={{ width: 44, height: 44, borderRadius: 12 }} />
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700 }}>Personal Finance</h1>
          <p style={{ margin: "4px 0 0", color: "var(--pf-ink-2)" }}>
            Sign in to see the same budgets and transactions as on your iPhone.
          </p>
        </div>

        {state === "sent" ? (
          <p className="pf-card" style={{ padding: 14, margin: 0, background: "rgba(48,209,88,.12)" }}>
            Check <strong>{email}</strong> for a sign-in link. You can close this tab — the link opens the app signed in.
          </p>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <label htmlFor="pf-email" style={{ fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>Email</label>
            <input
              id="pf-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pf-input"
            />
            <button className="pf-button" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            {state === "error" && <p style={{ margin: 0, color: "var(--pf-red)", fontSize: "0.85rem" }}>{error}</p>}
          </form>
        )}

        <button onClick={onDemo} className="pf-link">Look around with demo data first</button>
      </div>
    </div>
  );
}
