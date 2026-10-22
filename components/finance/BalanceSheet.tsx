"use client";

import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import type { BalanceLine, balanceSheet } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";

// The balance sheet in two forms, shared by the Balance page and the
// dashboard card:
//   BalanceBars  — compact: what you own as one bar, what you owe plus
//                  your equity as a second bar of the same length (they
//                  always balance), equity in the headline with its change
//                  since the previous month.
//   BalanceTable — full: the two columns of the spreadsheet, Assets left,
//                  Liabilities + Equity right, equal totals with a ✓. On the
//                  Balance page the user's own posts are editable in place.

export type Sheet = ReturnType<typeof balanceSheet>;

const ASSET_COLORS = ["#30d158", "#40c8e0", "#64d2ff", "#5e5ce6", "#bf5af2", "#d4af37", "#0a84ff", "#66d4cf"];
const DEBT_COLORS = ["#ff453a", "#ff6961", "#ff9f0a", "#ff7a45", "#ffb340"];
export const EQUITY = "#40c8e0";

function colorFor(side: "asset" | "debt", i: number) {
  return side === "asset" ? ASSET_COLORS[i % ASSET_COLORS.length] : DEBT_COLORS[i % DEBT_COLORS.length];
}

/** Change against the previous month, or null when there's nothing to compare. */
function delta(line: BalanceLine, prev: BalanceLine[] | undefined) {
  const before = prev?.find((p) => p.id === line.id);
  if (!before) return null;
  const d = line.value - before.value;
  return Math.abs(d) < 0.005 ? null : d;
}

export function BalanceBars({ sheet, prev, currency, label }: { sheet: Sheet; prev?: Sheet; currency: string; label?: string }) {
  const [hover, setHover] = useState<{ name: string; value: number; color: string } | null>(null);
  const total = Math.max(sheet.totalAssets, sheet.totalDebt + Math.max(sheet.equity, 0), 1);
  const assets = sheet.assets.filter((l) => l.value > 0);
  const right = [
    ...sheet.liabilities.filter((l) => l.value > 0).map((l, i) => ({ ...l, color: colorFor("debt", i) })),
    ...(sheet.equity > 0 ? [{ id: "equity", name: "Equity", value: sheet.equity, kind: "auto" as const, color: EQUITY }] : []),
  ];
  const eqDelta = prev ? sheet.equity - prev.equity : null;
  const shown = hover;

  const row = (lines: (BalanceLine & { color: string })[], side: string) => (
    <div className="pf-bal-bar" aria-label={side} onMouseLeave={() => setHover(null)}>
      {lines.map((l, i) => (
        <span
          key={l.id}
          className="pf-bal-seg"
          data-lit={hover?.name === l.name}
          title={`${l.name} ${money(l.value, currency)}`}
          style={{ flexBasis: `${(l.value / total) * 100}%`, background: l.color, animationDelay: `${i * 60}ms` }}
          onMouseEnter={() => setHover({ name: l.name, value: l.value, color: l.color })}
        />
      ))}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>Equity{label ? ` · ${label}` : ""}</div>
          <div className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 700, color: sheet.equity >= 0 ? EQUITY : "var(--pf-red)" }}>
            {money(sheet.equity, currency)}
          </div>
          {eqDelta !== null && Math.abs(eqDelta) >= 0.005 && (
            <div style={{ fontSize: "0.7rem", color: eqDelta >= 0 ? "var(--pf-green)" : "var(--pf-red)" }}>{money(eqDelta, currency, { signed: true })} since last month</div>
          )}
        </div>
        <span key={shown?.name ?? "idle"} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", textAlign: "right" }}>
          {shown ? (
            <>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: shown.color, marginRight: 6 }} />
              {shown.name} · <b style={{ color: "var(--pf-ink)" }}>{money(shown.value, currency)}</b> · {Math.round((shown.value / Math.max(sheet.totalAssets, 1)) * 100)}%
            </>
          ) : (
            <>
              Own <b style={{ color: "var(--pf-ink)" }}>{money(sheet.totalAssets, currency)}</b> · owe <b style={{ color: "var(--pf-ink)" }}>{money(sheet.totalDebt, currency)}</b>
            </>
          )}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 10px", alignItems: "center" }}>
        <span className="pf-bal-side">Assets</span>
        {row(assets.map((l, i) => ({ ...l, color: colorFor("asset", i) })), "Assets")}
        <span className="pf-bal-side">Debt + equity</span>
        {row(right, "Liabilities and equity")}
      </div>
    </div>
  );
}

type Edit = {
  onValue: (id: string, value: number) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAdd: (side: "asset" | "liability") => void;
};

export function BalanceTable({ sheet, prev, currency, edit }: { sheet: Sheet; prev?: Sheet; currency: string; edit?: Edit }) {
  const balanced = Math.abs(sheet.totalAssets - (sheet.totalDebt + sheet.equity)) < 0.01;
  return (
    <div className="pf-bal-table">
      <div className="pf-bal-col">
        <h3 className="pf-bal-head">Assets</h3>
        {sheet.assets.map((l) => (
          <Line key={l.id} line={l} d={delta(l, prev?.assets)} color={colorFor("asset", sheet.assets.filter((a) => a.value > 0).indexOf(l))} currency={currency} edit={edit} />
        ))}
        {edit && <AddRow onAdd={() => edit.onAdd("asset")} label="Add asset" />}
        <div className="pf-bal-spacer" />
        <Total label="Total" value={sheet.totalAssets} currency={currency} balanced={balanced} />
      </div>
      <div className="pf-bal-col">
        <h3 className="pf-bal-head">Liabilities</h3>
        {sheet.liabilities.map((l) => (
          <Line key={l.id} line={l} d={delta(l, prev?.liabilities)} color={colorFor("debt", sheet.liabilities.filter((a) => a.value > 0).indexOf(l))} currency={currency} edit={edit} />
        ))}
        {edit && <AddRow onAdd={() => edit.onAdd("liability")} label="Add liability" />}
        <div className="pf-bal-subtotal">
          <span>Total liabilities</span>
          <span className="pf-rounded">{money(sheet.totalDebt, currency)}</span>
        </div>
        <div className="pf-bal-equity">
          <span>Equity</span>
          <span className="pf-rounded" style={{ color: sheet.equity >= 0 ? EQUITY : "var(--pf-red)" }}>
            {money(sheet.equity, currency)}
            {prev && Math.abs(sheet.equity - prev.equity) >= 0.005 && (
              <small style={{ color: sheet.equity >= prev.equity ? "var(--pf-green)" : "var(--pf-red)" }}>{money(sheet.equity - prev.equity, currency, { signed: true })}</small>
            )}
          </span>
        </div>
        <div className="pf-bal-spacer" />
        <Total label="Total" value={sheet.totalDebt + sheet.equity} currency={currency} balanced={balanced} />
      </div>
    </div>
  );
}

function Total({ label, value, currency, balanced }: { label: string; value: number; currency: string; balanced: boolean }) {
  return (
    <div className="pf-bal-total">
      <span>{label}</span>
      <span className="pf-rounded">
        {money(value, currency)}
        {balanced && (
          <span className="pf-bal-check" title="Assets = liabilities + equity">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </span>
    </div>
  );
}

function Line({ line, d, color, currency, edit }: { line: BalanceLine; d: number | null; color: string; currency: string; edit?: Edit }) {
  const editable = edit && line.kind === "manual";
  return (
    <div className="pf-bal-line" data-auto={line.kind === "auto"} title={line.hint}>
      <span className="pf-bal-dot" style={{ background: line.value > 0 ? color : "var(--pf-ink-3)" }} />
      {editable ? (
        <TextField className="pf-bal-name" value={line.name} onCommit={(v) => v.trim() && v !== line.name && edit.onRename(line.id, v.trim())} />
      ) : (
        <span className="pf-bal-name">
          {line.name}
          {line.kind === "auto" && <em>auto</em>}
        </span>
      )}
      {d !== null && <small style={{ color: d >= 0 ? "var(--pf-ink-3)" : "var(--pf-ink-3)" }}>{money(d, currency, { signed: true })}</small>}
      {editable ? (
        <AmountField value={line.value} currency={currency} onCommit={(v) => v !== line.value && edit.onValue(line.id, v)} />
      ) : (
        <span className="pf-rounded pf-bal-value">{money(line.value, currency)}</span>
      )}
      {editable && (
        <button type="button" className="pf-bal-del" aria-label={`Remove ${line.name}`} onClick={() => edit.onDelete(line.id)}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function AddRow({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <button type="button" className="pf-bal-add" onClick={onAdd}>
      <Plus size={13} /> {label}
    </button>
  );
}

function TextField({ value, onCommit, className }: { value: string; onCommit: (v: string) => void; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className={`pf-bal-input ${className ?? ""}`}
      value={draft ?? value}
      autoFocus={value === "New post"}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

/** Shows the formatted amount; on focus the plain number to edit. Accepts
 *  Dutch and English notation (675.000 · 675000,50 · 675,000.50). */
function AmountField({ value, currency, onCommit }: { value: number; currency: string; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className="pf-bal-input pf-bal-value pf-rounded"
      inputMode="decimal"
      value={draft ?? money(value, currency)}
      onFocus={(e) => {
        setDraft(String(Math.round(value * 100) / 100).replace(".", ","));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = draft === null ? null : parseAmount(draft);
        if (v !== null) onCommit(v);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}

export function parseAmount(text: string): number | null {
  let s = text.replace(/[^\d,.\-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = /,\d{3}$/.test(s) && (s.match(/,/g)?.length ?? 0) > 1 ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
