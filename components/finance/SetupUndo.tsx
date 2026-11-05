"use client";

import { useMemo, useState } from "react";
import { useFinance } from "./FinanceProvider";
import type { FinanceData } from "@/lib/finance/types";

// Undo the setup (onboarding) on an account that already had data: every
// row changed in the chosen minutes of today is taken out again — unless it
// was already there in the backup file on this computer (dev:
// /api/local-data), then that earlier version comes back. The profile
// fields the setup sets come back from the backup too, and the setup marker
// goes. Removals are tracked as deletions, so other devices drop them too.
// Shown in Settings only on localhost (dev), for the account owner.

type Row = { id: string; updated_at?: string; name?: string; note?: string | null; [k: string]: unknown };
const PROFILE_KEYS = ["currency_code", "expected_net_monthly", "expected_gross_monthly", "payday_day", "household", "checkin_interval", "checkin_days"] as const;

export default function SetupUndo() {
  const { data, source, rewrite } = useFinance();
  const [backup, setBackup] = useState<FinanceData | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  // Today's changes, per minute (local time), per collection.
  const minutes = useMemo(() => {
    const today = new Date();
    const key = (iso: string) => {
      const d = new Date(iso);
      return d.toDateString() === today.toDateString() ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : null;
    };
    const out = new Map<string, { n: number; names: string[] }>();
    for (const [c, v] of Object.entries(data)) {
      if (!Array.isArray(v) || c === "deletions") continue;
      for (const r of v as Row[]) {
        const k = r?.updated_at ? key(r.updated_at) : null;
        if (!k) continue;
        const e = out.get(k) ?? { n: 0, names: [] };
        e.n++;
        if (e.names.length < 8) e.names.push(`${c}: ${String(r.name ?? r.note ?? r.code ?? r.id).slice(0, 40)}`);
        out.set(k, e);
      }
    }
    return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  if (source !== "vault" && source !== "local") return null;

  async function loadBackup() {
    setError("");
    try {
      const r = await fetch("/api/local-data", { cache: "no-store" });
      if (!r.ok) throw new Error(`Backup file not available (${r.status}).`);
      setBackup((await r.json()) as FinanceData);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const inWindow = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (d.toDateString() !== new Date().toDateString()) return false;
    const k = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return picked.includes(k);
  };

  // What the undo would do, per collection.
  const plan = (() => {
    const remove: string[] = [], restore: string[] = [];
    for (const [c, v] of Object.entries(data)) {
      if (!Array.isArray(v) || c === "deletions") continue;
      const old = new Map(((backup as unknown as Record<string, Row[]> | null)?.[c] ?? []).map((r) => [r.id, r]));
      for (const r of v as Row[]) {
        if (!inWindow(r?.updated_at)) continue;
        const label = `${c}: ${String(r.name ?? r.note ?? r.code ?? r.id).slice(0, 40)}`;
        if (old.has(r.id)) restore.push(label);
        else remove.push(label);
      }
    }
    return { remove, restore };
  })();

  function run() {
    if (!backup || !picked.length) return;
    const stamp = new Date().toISOString();
    rewrite((d) => {
      const out: Record<string, unknown> = { ...d };
      for (const [c, v] of Object.entries(d)) {
        if (!Array.isArray(v) || c === "deletions") continue;
        const old = new Map(((backup as unknown as Record<string, Row[]>)[c] ?? []).map((r) => [r.id, r]));
        out[c] = (v as Row[]).flatMap((r) => {
          if (!inWindow(r?.updated_at)) return [r];
          const before = old.get(r.id);
          return before ? [{ ...before, updated_at: stamp }] : [];
        });
      }
      const profile = { ...d.profile } as Record<string, unknown>;
      const oldProfile = (backup.profile ?? {}) as unknown as Record<string, unknown>;
      for (const k of PROFILE_KEYS) {
        if (k in oldProfile) profile[k] = oldProfile[k];
        else delete profile[k];
      }
      delete profile.onboarding;
      out.profile = profile;
      return out as unknown as FinanceData;
    });
    setDone(`Removed ${plan.remove.length}, restored ${plan.restore.length} from the backup, profile fields restored, setup marker removed.`);
  }

  return (
    <section className="pf-card" style={{ display: "grid", gap: 10, border: "1px solid rgba(255,105,97,.35)" }}>
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Undo the setup (onboarding)</h2>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--pf-ink-2)" }}>
        Pick the minute(s) the setup was saved. Rows changed then are removed — or, if they were already in the backup file on this computer, put back as they were there. Profile settings the setup changes come back from the backup.
      </p>
      <div style={{ display: "grid", gap: 6 }}>
        {minutes.length === 0 && <span style={{ fontSize: "0.85rem" }}>No changes today.</span>}
        {minutes.map(([k, e]) => (
          <label key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.82rem" }}>
            <input type="checkbox" checked={picked.includes(k)} onChange={(ev) => setPicked(ev.target.checked ? [...picked, k] : picked.filter((x) => x !== k))} />
            <span><b>{k}</b> · {e.n} changes — {e.names.slice(0, 4).join(" · ")}{e.n > 4 ? " …" : ""}</span>
          </label>
        ))}
      </div>
      {!backup ? (
        <button type="button" className="pf-chip" style={{ justifySelf: "start" }} onClick={() => void loadBackup()}>Load the backup file (for what to put back)</button>
      ) : (
        <span style={{ fontSize: "0.8rem", color: "var(--pf-green)" }}>Backup file loaded.</span>
      )}
      {picked.length > 0 && backup && (
        <div style={{ fontSize: "0.8rem", display: "grid", gap: 4, maxHeight: 220, overflowY: "auto", padding: 8, borderRadius: 10, background: "rgba(255,255,255,.04)" }}>
          <b>Will remove ({plan.remove.length}):</b>
          <span style={{ color: "var(--pf-ink-2)" }}>{plan.remove.join(" · ") || "—"}</span>
          <b>Will put back from the backup ({plan.restore.length}):</b>
          <span style={{ color: "var(--pf-ink-2)" }}>{plan.restore.join(" · ") || "—"}</span>
        </div>
      )}
      {error && <p className="pf-unlock-error">{error}</p>}
      <button type="button" className="pf-button" style={{ justifySelf: "start", background: "#ff453a", position: "sticky", bottom: 12 }} disabled={!backup || !picked.length || (!plan.remove.length && !plan.restore.length)} onClick={run}>
        Undo the setup for the picked minutes ({plan.remove.length} remove · {plan.restore.length} put back)
      </button>
      {done && <p style={{ margin: 0, color: "var(--pf-green)", fontSize: "0.85rem" }}>{done} Saved to your account automatically.</p>}
    </section>
  );
}
