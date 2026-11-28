"use client";

import { History, RotateCcw } from "lucide-react";
import { useState } from "react";
import { intlLocale, t } from "@/lib/i18n";
import type { FinanceData } from "@/lib/finance/types";
import { useFinance, type VaultVersion } from "./FinanceProvider";

// Settings › Earlier versions (signed in): every time the account's copy is
// replaced, the copy before it is kept (the last 10, migration 0016). Here
// you can look at one — how many transactions, accounts, the newest booking —
// and put it back. Putting one back keeps today's copy in the history too, so
// it can be undone the same way. (19 Nov 2026: three sync mishaps in two days;
// until now a restore needed SQL.)

const when = (iso: string) => new Date(iso).toLocaleString(intlLocale(), { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function summary(d: FinanceData) {
  const live = <T extends { deleted_at?: string | null }>(a: T[] | undefined) => (a ?? []).filter((x) => !x.deleted_at);
  const tx = live(d.transactions);
  const newest = tx.reduce<string | null>((m, x) => (!m || x.date > m ? x.date : m), null);
  return { transactions: tx.length, accounts: live(d.accounts).length, categories: live(d.categories).length, holdings: live(d.holdings).length, newest };
}

export default function VaultHistorySection() {
  const { source, data, vaultHistory, openVaultVersion, restoreVaultVersion } = useFinance();
  const [list, setList] = useState<VaultVersion[] | null>(null);
  const [picked, setPicked] = useState<{ id: number; s: ReturnType<typeof summary> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (source !== "vault") return null;
  const now = summary(data);

  async function load() {
    setError(null);
    setDone(null);
    setBusy("list");
    try {
      setList(await vaultHistory());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function look(id: number) {
    setError(null);
    setBusy(`look-${id}`);
    try {
      setPicked({ id, s: summary(await openVaultVersion(id)) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function restore(v: VaultVersion) {
    if (!confirm(t("Put back the version of {when}? Your books become that version; today's copy is kept in this list, so you can undo it.", { when: when(v.saved_at) }))) return;
    setError(null);
    setBusy(`restore-${v.id}`);
    try {
      await restoreVaultVersion(v.id);
      setDone(t("The version of {when} is back.", { when: when(v.saved_at) }));
      setPicked(null);
      setList(await vaultHistory());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const line = (s: ReturnType<typeof summary>) =>
    t("{tx} transactions · {acc} accounts · {cat} categories · {inv} investments", { tx: s.transactions, acc: s.accounts, cat: s.categories, inv: s.holdings });

  return (
    <section className="pf-card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 650, display: "flex", alignItems: "center", gap: 8 }}>
        <History size={17} /> {t("Earlier versions")}
      </h2>
      <p style={{ margin: "4px 0 14px", fontSize: "0.82rem", color: "var(--pf-ink-2)" }}>
        {t("Every time your books are saved over, the version before is kept — the last 10. Something went wrong after a sync? Put an earlier version back.")}
      </p>
      {done && <p className="pf-readout" style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--pf-green)" }}>{done}</p>}
      {!list ? (
        <button type="button" className="pf-chip" style={{ padding: "8px 14px" }} onClick={load} disabled={busy === "list"}>
          {busy === "list" ? t("Working…") : t("Show earlier versions")}
        </button>
      ) : (
        <div className="pf-vh">
          <div className="pf-vh-row pf-vh-now">
            <div>
              <b>{t("Now")}</b>
              <small>{line(now)}</small>
            </div>
          </div>
          {list.length === 0 && <p style={{ fontSize: "0.82rem", color: "var(--pf-ink-3)" }}>{t("No earlier versions yet.")}</p>}
          {list.map((v) => (
            <div key={v.id} className="pf-vh-row" data-open={picked?.id === v.id || undefined}>
              <div>
                <b>{when(v.saved_at)}</b>
                <small>
                  {picked?.id === v.id
                    ? `${line(picked.s)}${picked.s.newest ? ` · ${t("newest booking {date}", { date: new Date(picked.s.newest).toLocaleDateString(intlLocale(), { day: "numeric", month: "short" }) })}` : ""}`
                    : `${Math.round(v.bytes / 1024)} kB`}
                </small>
              </div>
              <div className="pf-vh-actions">
                {picked?.id === v.id ? (
                  <button type="button" className="pf-button" onClick={() => restore(v)} disabled={!!busy}>
                    <RotateCcw size={14} /> {busy === `restore-${v.id}` ? t("Working…") : t("Put this version back")}
                  </button>
                ) : (
                  <button type="button" className="pf-chip" onClick={() => look(v.id)} disabled={!!busy}>
                    {busy === `look-${v.id}` ? t("Working…") : t("Look")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p role="alert" style={{ margin: "10px 0 0", fontSize: "0.82rem", color: "var(--pf-red)" }}>{error}</p>}
    </section>
  );
}
