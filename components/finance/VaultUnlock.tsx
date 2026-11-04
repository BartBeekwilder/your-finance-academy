"use client";

import { t } from "@/lib/i18n";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MIN_PASSPHRASE, unlock, type Unlocked } from "@/lib/finance/vault";
import { liveOnly } from "@/lib/finance/vaultMerge";
import type { FinanceData } from "@/lib/finance/types";

// After signing in: the data lives only in the encrypted vault
// (encrypted_vaults, migration 0009), so the passphrase opens it here, in the
// browser. The passphrase stays in this tab's memory while the app is open
// and is never stored or sent. No vault yet → set one up: the passphrase
// twice, and the account starts from what's in it (empty for a new one).

export default function VaultUnlock({ supabase, email, hasVault, start, onUnlocked, onSignOut }: {
  supabase: SupabaseClient;
  email: string | null;
  hasVault: boolean;
  /** No vault yet: the data a new vault starts with. */
  start: () => Promise<FinanceData>;
  onUnlocked: (data: FinanceData, vault: Unlocked, updatedAt: string) => void;
  onSignOut: () => void;
}) {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    if (pass.length < MIN_PASSPHRASE) return setError(t("Use at least {n} characters.", { n: MIN_PASSPHRASE }));
    if (!hasVault && pass !== pass2) return setError(t("The two passphrases are not the same."));
    setBusy(true);
    try {
      const vault = await unlock(pass);
      if (hasVault) {
        const { data: row, error: e } = await supabase.from("encrypted_vaults").select("ciphertext, iv, salt, kdf, updated_at").single();
        if (e) throw e;
        let data: FinanceData;
        try {
          data = await vault.open<FinanceData>(row);
        } catch {
          throw new Error(t("That passphrase doesn't open your vault."));
        }
        onUnlocked(liveOnly(data), vault, row.updated_at);
      } else {
        const data = await start();
        const sealed = await vault.seal(data);
        const { data: row, error: e } = await supabase.from("encrypted_vaults").insert(sealed).select("updated_at").single();
        if (e) throw e;
        onUnlocked(data, vault, row.updated_at);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="pf-card pf-unlock" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <span className="pf-unlock-icon"><LockKeyhole size={22} /></span>
      <h1>{hasVault ? t("Unlock your data") : t("Protect your data")}</h1>
      <p>
        {hasVault
          ? t("Your data is end-to-end encrypted. Your passphrase opens it here, in this browser — it is never sent or stored.")
          : t("Choose a passphrase. Everything is encrypted with it in your browser before it's saved; the server only ever sees unreadable data. Nobody can recover it — keep it in your password manager.")}
      </p>
      <input className="pf-input" type="password" autoComplete={hasVault ? "current-password" : "new-password"} autoFocus placeholder={t("Passphrase")} value={pass} onChange={(e) => setPass(e.target.value)} />
      {!hasVault && (
        <>
          <input className="pf-input" type="password" autoComplete="new-password" placeholder={t("Passphrase again")} value={pass2} onChange={(e) => setPass2(e.target.value)} />
          <div className="pf-vault-meter" data-ok={pass.length >= MIN_PASSPHRASE}>
            <span style={{ width: `${Math.min(pass.length / 20, 1) * 100}%` }} />
          </div>
          <span className="pf-unlock-hint">{t("At least {n} characters. A sentence of a few words is strong and easy to remember.", { n: MIN_PASSPHRASE })}</span>
        </>
      )}
      {error && <p className="pf-unlock-error" role="alert">{error}</p>}
      <button className="pf-button" disabled={busy || !pass}>
        {busy ? t("Working…") : hasVault ? t("Unlock") : t("Encrypt and start")}
      </button>
      <span className="pf-unlock-foot">
        {email}
        {" · "}
        <button type="button" className="pf-link" onClick={onSignOut}>{t("Sign out")}</button>
      </span>
    </form>
  );
}
