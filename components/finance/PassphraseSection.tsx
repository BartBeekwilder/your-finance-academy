"use client";

import { t } from "@/lib/i18n";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { MIN_PASSPHRASE } from "@/lib/finance/vault";
import { useFinance } from "./FinanceProvider";

// Settings › Extra protection (signed in): the account's copy is saved
// without a passphrase by default, readable only by the account. Adding a
// passphrase encrypts it end to end in the browser (vault.ts) — then the
// app asks for it when it opens and locks itself when left alone. Taking it
// off needs the passphrase once, to prove it's yours.

export default function PassphraseSection() {
  const { source, vaultProtected, setPassphrase } = useFinance();
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (source !== "vault") return null;

  const reset = () => {
    setOpen(false);
    setPass("");
    setPass2("");
    setError(null);
  };

  async function go() {
    setError(null);
    if (!vaultProtected) {
      if (pass.length < MIN_PASSPHRASE) return setError(t("Use at least {n} characters.", { n: MIN_PASSPHRASE }));
      if (pass !== pass2) return setError(t("The two passphrases are not the same."));
    }
    setBusy(true);
    try {
      await setPassphrase(vaultProtected ? null : pass, vaultProtected ? pass : undefined);
      setDone(vaultProtected ? t("Passphrase removed. The app now opens without it.") : t("Passphrase added. Your data is now end-to-end encrypted."));
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pf-card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 650, display: "flex", alignItems: "center", gap: 8 }}>
        {vaultProtected ? <LockKeyhole size={17} /> : <ShieldCheck size={17} />}
        {t("Extra protection")}
      </h2>
      <p style={{ margin: "4px 0 14px", fontSize: "0.82rem", color: "var(--pf-ink-2)" }}>
        {vaultProtected
          ? t("Your data is end-to-end encrypted with your passphrase: nobody can read it without it. The app asks for it when it opens and locks itself after 15 minutes.")
          : t("Your data is saved in your account and only you can open it, by signing in. Add a passphrase to encrypt it end to end as well: then nobody can read it without the passphrase, and the app asks for it when it opens.")}
      </p>
      {done && !open && <p key={done} className="pf-readout" style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--pf-green)" }}>{done}</p>}
      {open ? (
        <form className="pf-readout" style={{ display: "grid", gap: 10, maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <input
            className="pf-input"
            type="password"
            autoFocus
            autoComplete={vaultProtected ? "current-password" : "new-password"}
            placeholder={vaultProtected ? t("Current passphrase") : t("Passphrase")}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          {!vaultProtected && (
            <>
              <input className="pf-input" type="password" autoComplete="new-password" placeholder={t("Passphrase again")} value={pass2} onChange={(e) => setPass2(e.target.value)} />
              <div className="pf-vault-meter" data-ok={pass.length >= MIN_PASSPHRASE}>
                <span style={{ width: `${Math.min(pass.length / 20, 1) * 100}%` }} />
              </div>
              <span className="pf-unlock-hint">{t("At least {n} characters. A sentence of a few words is strong and easy to remember.", { n: MIN_PASSPHRASE })}</span>
              <span className="pf-unlock-hint">{t("Nobody can recover a forgotten passphrase — keep it in your password manager.")}</span>
            </>
          )}
          {error && <p role="alert" style={{ margin: 0, fontSize: "0.82rem", color: "var(--pf-red)" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pf-button" disabled={busy || !pass}>
              {busy ? t("Working…") : vaultProtected ? t("Remove passphrase") : t("Add passphrase")}
            </button>
            <button type="button" className="pf-chip" onClick={reset} disabled={busy}>{t("Cancel")}</button>
          </div>
        </form>
      ) : (
        <button type="button" className="pf-chip" style={{ padding: "8px 14px" }} onClick={() => { setDone(null); setOpen(true); }}>
          {vaultProtected ? t("Remove passphrase") : t("Add a passphrase")}
        </button>
      )}
    </section>
  );
}
