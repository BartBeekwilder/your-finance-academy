"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { useFinance } from "./FinanceProvider";

// Settings › Your data (GDPR): take everything with you — the whole books as
// JSON, the transactions as CSV for a spreadsheet — or delete the account
// and everything in it. Deleting asks for the email address first; a running
// paid subscription has to be cancelled before (the server checks).

const stamp = () => new Date().toISOString().slice(0, 10);

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function YourDataSection() {
  const { storedData, source, email, deleteAccount } = useFinance();
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signedIn = source === "vault" || source === "supabase";

  function exportJson() {
    download(`personal-finance-${stamp()}.json`, "application/json", JSON.stringify(storedData(), null, 2));
  }

  function exportCsv() {
    const d = storedData();
    const cats = new Map(d.categories.map((c) => [c.id, c.name]));
    const accounts = new Map(d.accounts.map((a) => [a.id, a.name]));
    const rows = d.transactions
      .filter((x) => !x.deleted_at)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x) => [x.date.slice(0, 10), x.type, x.amount, cats.get(x.category_id ?? "") ?? "", x.note ?? "", accounts.get(x.account_id ?? "") ?? "", x.is_fixed_expense ? "fixed" : ""].map(cell).join(","));
    download(`personal-finance-transactions-${stamp()}.csv`, "text/csv", ["date,type,amount,category,note,account,fixed", ...rows].join("\n") + "\n");
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="pf-card" style={{ padding: 20, display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 650 }}>{t("Your data")}</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--pf-ink-3)" }}>{t("Take everything with you, or delete it for good.")}</p>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="pf-chip" style={{ padding: "8px 14px", display: "inline-flex", gap: 8, alignItems: "center" }} onClick={exportJson}>
          <Download size={15} /> {t("Download everything (JSON)")}
        </button>
        <button type="button" className="pf-chip" style={{ padding: "8px 14px", display: "inline-flex", gap: 8, alignItems: "center" }} onClick={exportCsv}>
          <FileSpreadsheet size={15} /> {t("Transactions as CSV")}
        </button>
      </div>

      {signedIn && (
        <div className="pf-danger">
          {!asking ? (
            <button type="button" className="pf-link pf-danger-link" onClick={() => setAsking(true)}>
              <Trash2 size={14} /> {t("Delete my account…")}
            </button>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <b>{t("Delete your account?")}</b>
              <p style={{ fontSize: "0.85rem", color: "var(--pf-ink-2)" }}>
                {t("Your account and all your data are deleted on every device. This can't be undone. Download your data first if you want to keep it.")}
              </p>
              <label style={{ display: "grid", gap: 6, fontSize: "0.8rem", color: "var(--pf-ink-2)" }}>
                {t("Type {email} to confirm", { email: email ?? "" })}
                <input className="pf-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
              </label>
              {error && <p style={{ color: "var(--pf-red)", fontSize: "0.85rem" }}>{error}</p>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="pf-button pf-danger-button" disabled={busy || !email || typed.trim().toLowerCase() !== email.toLowerCase()} onClick={() => void remove()}>
                  {busy ? t("One moment…") : t("Delete my account for good")}
                </button>
                <button type="button" className="pf-link" onClick={() => { setAsking(false); setTyped(""); setError(""); }}>{t("Cancel")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
