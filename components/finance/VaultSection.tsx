"use client";

import { intlLocale, t } from "@/lib/i18n";
import { CloudUpload, Download, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { MIN_PASSPHRASE, open, seal } from "@/lib/finance/vault";
import type { FinanceData } from "@/lib/finance/types";
import { useFinance } from "./FinanceProvider";
import Sheet from "./Sheet";
import SignIn from "./SignIn";

// Settings › Encrypted copy (local mode): put an end-to-end encrypted copy
// of the private data in the user's account, or restore it. The passphrase
// never leaves the browser and is never stored (lib/finance/vault.ts); the
// server holds only ciphertext (supabase/migrations/0009). Uploading needs
// the passphrase twice — a typo would lock the copy for good.

type Info = { updated_at: string; bytes: number } | null;

export default function VaultSection() {
  const { source, storedData, restoreLocal } = useFinance();
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [info, setInfo] = useState<Info | undefined>(undefined);
  const [mode, setMode] = useState<null | "upload" | "restore">(null);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [signIn, setSignIn] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) setSignIn(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session) return;
    supabase
      .from("encrypted_vaults")
      .select("updated_at, bytes")
      .maybeSingle()
      .then(({ data, error }) => setInfo(error ? null : ((data as Info) ?? null)));
  }, [supabase, session]);

  if (source !== "local" || !supabase) return null;

  const reset = () => {
    setMode(null);
    setPass("");
    setPass2("");
  };

  async function upload() {
    if (!supabase || !session) return;
    if (pass.length < MIN_PASSPHRASE) return setMsg({ kind: "error", text: t("Use at least {n} characters.", { n: MIN_PASSPHRASE }) });
    if (pass !== pass2) return setMsg({ kind: "error", text: t("The two passphrases are not the same.") });
    setBusy(true);
    setMsg(null);
    try {
      const sealed = await seal(storedData(), pass);
      const { data, error } = await supabase
        .from("encrypted_vaults")
        .upsert({ user_id: session.user.id, ...sealed, updated_at: new Date().toISOString() })
        .select("updated_at, bytes")
        .single();
      if (error) throw error;
      setInfo(data as Info);
      setMsg({ kind: "ok", text: t("Encrypted and uploaded. Only your passphrase can open it.") });
      reset();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!supabase || !session) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.from("encrypted_vaults").select("ciphertext, iv, salt, kdf").single();
      if (error) throw error;
      const restored = await open<FinanceData>(data, pass);
      const n = restored.transactions?.length ?? 0;
      if (!confirm(t("Replace the data on this Mac with the encrypted copy ({n} transactions)?", { n }))) return;
      restoreLocal(restored);
      setMsg({ kind: "ok", text: t("Restored from your encrypted copy.") });
      reset();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const when = info ? new Date(info.updated_at).toLocaleString(intlLocale(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <section className="pf-card pf-vault" style={{ padding: 18, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span className="pf-vault-icon"><LockKeyhole size={18} /></span>
        <div style={{ display: "grid", gap: 4 }}>
          <strong>{t("Encrypted copy in your account")}</strong>
          <span style={{ fontSize: "0.82rem", color: "var(--pf-ink-2)" }}>
            {t("Your data is encrypted on this Mac with a passphrase only you know. The server only stores unreadable data — nobody, including us, can open it. Forget the passphrase and the copy is lost.")}
          </span>
        </div>
      </div>

      {!session ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="pf-chip" style={{ padding: "8px 14px" }} onClick={() => setSignIn(true)}>
            {t("Sign in to your account")}
          </button>
          <span style={{ fontSize: "0.78rem", color: "var(--pf-ink-3)" }}>{t("Your local data stays on this Mac; signing in only gives the copy a place.")}</span>
        </div>
      ) : (
        <>
          <div className="pf-vault-status" data-has={!!info}>
            <ShieldCheck size={15} />
            {info === undefined ? t("Checking…") : info ? t("Last encrypted copy: {when} · {kb} kB", { when: when!, kb: Math.max(1, Math.round(info.bytes / 1024)) }) : t("No encrypted copy yet")}
            <span style={{ marginLeft: "auto", color: "var(--pf-ink-3)" }}>{session.user.email}</span>
          </div>

          {mode === null && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="pf-button pf-vault-btn" onClick={() => { setMode("upload"); setMsg(null); }}>
                <CloudUpload size={16} /> {info ? t("Update encrypted copy") : t("Upload encrypted")}
              </button>
              {info && (
                <button type="button" className="pf-chip pf-vault-btn" onClick={() => { setMode("restore"); setMsg(null); }}>
                  <Download size={16} /> {t("Restore on this Mac")}
                </button>
              )}
            </div>
          )}

          {mode && (
            <form
              className="pf-vault-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (mode === "upload") upload();
                else restore();
              }}
            >
              <input className="pf-input" type="password" autoComplete={mode === "upload" ? "new-password" : "current-password"} autoFocus placeholder={t("Passphrase")} value={pass} onChange={(e) => setPass(e.target.value)} />
              {mode === "upload" && (
                <>
                  <input className="pf-input" type="password" autoComplete="new-password" placeholder={t("Passphrase again")} value={pass2} onChange={(e) => setPass2(e.target.value)} />
                  <div className="pf-vault-meter" data-ok={pass.length >= MIN_PASSPHRASE}>
                    <span style={{ width: `${Math.min(pass.length / 20, 1) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-3)" }}>{t("At least {n} characters. A sentence of a few words is strong and easy to remember.", { n: MIN_PASSPHRASE })}</span>
                </>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button className="pf-button" disabled={busy || !pass}>
                  {busy ? t("Working…") : mode === "upload" ? t("Encrypt and upload") : t("Decrypt and restore")}
                </button>
                <button type="button" className="pf-chip" style={{ padding: "8px 14px" }} onClick={reset}>
                  {t("Cancel")}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {msg && <p style={{ margin: 0, fontSize: "0.82rem", color: msg.kind === "ok" ? "var(--pf-green)" : "var(--pf-red)" }}>{msg.text}</p>}

      <Sheet open={signIn} onClose={() => setSignIn(false)} label={t("Sign in to your account")}>
        {signIn && <SignIn />}
      </Sheet>
    </section>
  );
}
