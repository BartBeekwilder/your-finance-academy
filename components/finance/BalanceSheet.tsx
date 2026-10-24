"use client";

import { t } from "@/lib/i18n";
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
const DEBT_COLORS = ["#ff453a", "#ff9f0a", "#ff375f", "#ffd60a", "#ac8e68", "#ff6961", "#e5484d"];
export const EQUITY = "#40c8e0";

function colorFor(side: "asset" | "debt", i: number) {
  return side === "asset" ? ASSET_COLORS[i % ASSET_COLORS.length] : DEBT_COLORS[i % DEBT_COLORS.length];
}

/** The colour of every post in a sheet, as the bars draw it (by position
 *  among the positive posts per side), so other charts can match. */
export function balanceColors(sheet: Sheet) {
  const m = new Map<string, string>();
  sheet.assets.filter((l) => l.value > 0).forEach((l, i) => m.set(l.id, colorFor("asset", i)));
  sheet.liabilities.filter((l) => l.value > 0).forEach((l, i) => m.set(l.id, colorFor("debt", i)));
  m.set("equity", EQUITY);
  return m;
}

/** Change against the previous month, or null when there's nothing to compare. */
function delta(line: BalanceLine, prev: BalanceLine[] | undefined) {
  const before = prev?.find((p) => p.id === line.id);
  if (!before) return null;
  const d = line.value - before.value;
  return Math.abs(d) < 0.005 ? null : d;
}

export function BalanceBars({
  sheet,
  prev,
  currency,
  label,
  header = true,
  legend: showLegend = true,
  vertical = false,
  picked = null,
  onPick,
}: {
  sheet: Sheet;
  prev?: Sheet;
  currency: string;
  label?: string;
  /** The equity headline (off where the page shows its own). */
  header?: boolean;
  /** Names and amounts under the bars (off where the table follows). */
  legend?: boolean;
  /** Two upright columns side by side with the legend beside them (compact
   *  dashboard card), like a balance sheet drawn as two stacks. */
  vertical?: boolean;
  /** A post picked elsewhere (the 2D view): it stays lit. */
  picked?: string | null;
  /** Clicking a segment picks that post (side: assets or debt + equity). */
  onPick?: (id: string, side: "assets" | "funding") => void;
}) {
  const [hover, setHover] = useState<{ name: string; value: number; color: string } | null>(null);
  const total = Math.max(sheet.totalAssets, sheet.totalDebt + Math.max(sheet.equity, 0), 1);
  const assets = sheet.assets.filter((l) => l.value > 0);
  const right = [
    ...sheet.liabilities.filter((l) => l.value > 0).map((l, i) => ({ ...l, color: colorFor("debt", i) })),
    ...(sheet.equity > 0 ? [{ id: "equity", name: t("Equity"), value: sheet.equity, kind: "auto" as const, color: EQUITY }] : []),
  ];
  const eqDelta = prev ? sheet.equity - prev.equity : null;
  const shown = hover;

  const assetLines = assets.map((l, i) => ({ ...l, color: colorFor("asset", i) }));
  const debtLines = right.filter((l) => l.id !== "equity");
  const legend = (lines: (BalanceLine & { color: string })[], title: string, total: number, max = Infinity) => (
    <div className="pf-bal-legend">
      <div className="pf-bal-legend-head">
        <span>{title}</span>
        <b className="pf-rounded">{money(total, currency)}</b>
      </div>
      {[...lines].sort((a, b) => (max < Infinity ? b.value - a.value : 0)).slice(0, max).map((l) => (
        <div
          key={l.id}
          className="pf-bal-legend-row"
          data-lit={hover?.name === l.name}
          onMouseEnter={() => setHover({ name: l.name, value: l.value, color: l.color })}
          onMouseLeave={() => setHover(null)}
        >
          <span className="pf-bal-dot" style={{ background: l.color }} />
          <span className="pf-bal-name">{l.name}</span>
          <span className="pf-rounded">{money(l.value, currency)}</span>
        </div>
      ))}
      {lines.length > max && <div className="pf-bal-legend-more">{t("+{n} more", { n: lines.length - max })}</div>}
    </div>
  );

  const row = (lines: (BalanceLine & { color: string })[], side: string) => (
    <div className="pf-bal-bar" data-vertical={vertical} data-pickable={!!onPick} aria-label={side} onMouseLeave={() => setHover(null)}>
      {lines.map((l, i) => (
        <span
          key={l.id}
          className="pf-bal-seg"
          data-equity={l.id === "equity"}
          data-lit={hover ? hover.name === l.name : picked === l.id}
          onClick={onPick ? () => onPick(l.id, lines === assetLines ? "assets" : "funding") : undefined}
          title={`${l.name} ${money(l.value, currency)}`}
          style={{ flexBasis: `${(l.value / total) * 100}%`, background: l.color, animationDelay: `${(vertical ? 200 : 0) + i * 60}ms` }}
          onMouseEnter={() => setHover({ name: l.name, value: l.value, color: l.color })}
        />
      ))}
    </div>
  );

  if (vertical) {
    return (
      <div className="pf-bal-v">
        <div className="pf-bal-v-cols">
          <div className="pf-bal-v-col">
            {row(assetLines, t("Assets"))}
            <span className="pf-bal-side">{t("Assets")}</span>
          </div>
          <div className="pf-bal-v-col">
            {row(right, t("Liabilities and equity"))}
            <span className="pf-bal-side">{t("Debt + equity")}</span>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10, alignContent: "start", minWidth: 0 }}>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--pf-ink-2)" }}>{t("Equity")}{label ? ` · ${label}` : ""}</div>
            <div className="pf-rounded" style={{ fontSize: "1.5rem", fontWeight: 700, color: sheet.equity >= 0 ? EQUITY : "var(--pf-red)" }}>{money(sheet.equity, currency)}</div>
            {eqDelta !== null && Math.abs(eqDelta) >= 0.005 && (
              <div style={{ fontSize: "0.68rem", color: eqDelta >= 0 ? "var(--pf-green)" : "var(--pf-red)" }}>{t("{amount} since last month", { amount: money(eqDelta, currency, { signed: true }) })}</div>
            )}
          </div>
          <div className="pf-bal-t">
            <div className="pf-bal-t-side">
              {legend(assetLines, t("Assets"), sheet.totalAssets, 5)}
              <div className="pf-bal-t-total">
                <span>{t("Total")}</span>
                <b className="pf-rounded">{money(sheet.totalAssets, currency)}</b>
              </div>
            </div>
            <div className="pf-bal-t-side">
              {debtLines.length > 0 ? (
                legend(debtLines, t("Liabilities"), sheet.totalDebt, 4)
              ) : (
                <div className="pf-bal-legend">
                  <div className="pf-bal-legend-head">
                    <span>{t("Liabilities")}</span>
                    <b className="pf-rounded">{money(0, currency)}</b>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-3)" }}>
                    {t("No debts entered.")}{" "}
                    <a href="/app/balance" style={{ color: "var(--pf-brand-b)" }}>{t("Add a loan or mortgage")}</a>
                  </span>
                </div>
              )}
              <div
                className="pf-bal-legend-row pf-bal-t-equity"
                data-lit={hover?.name === t("Equity")}
                onMouseEnter={() => setHover({ name: t("Equity"), value: sheet.equity, color: EQUITY })}
                onMouseLeave={() => setHover(null)}
              >
                <span className="pf-bal-dot" style={{ background: EQUITY }} />
                <span className="pf-bal-name">{t("Equity")}</span>
                <span className="pf-rounded" style={{ color: sheet.equity >= 0 ? EQUITY : "var(--pf-red)" }}>{money(sheet.equity, currency)}</span>
              </div>
              <div className="pf-bal-t-total">
                <span>{t("Total")}</span>
                <b className="pf-rounded">{money(sheet.totalDebt + sheet.equity, currency)}</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: header ? "space-between" : "flex-end", alignItems: "baseline", gap: 12, flexWrap: "wrap", minHeight: 18 }}>
        {header && (
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{t("Equity")}{label ? ` · ${label}` : ""}</div>
            <div className="pf-rounded" style={{ fontSize: "1.6rem", fontWeight: 700, color: sheet.equity >= 0 ? EQUITY : "var(--pf-red)" }}>
              {money(sheet.equity, currency)}
            </div>
            {eqDelta !== null && Math.abs(eqDelta) >= 0.005 && (
              <div style={{ fontSize: "0.7rem", color: eqDelta >= 0 ? "var(--pf-green)" : "var(--pf-red)" }}>{t("{amount} since last month", { amount: money(eqDelta, currency, { signed: true }) })}</div>
            )}
          </div>
        )}
        <span key={shown?.name ?? "idle"} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", textAlign: "right" }}>
          {shown ? (
            <>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: shown.color, marginRight: 6 }} />
              {shown.name} · <b style={{ color: "var(--pf-ink)" }}>{money(shown.value, currency)}</b> · {Math.round((shown.value / Math.max(sheet.totalAssets, 1)) * 100)}%
            </>
          ) : (
            <>
              {t("Own")} <b style={{ color: "var(--pf-ink)" }}>{money(sheet.totalAssets, currency)}</b> {t("· owe")} <b style={{ color: "var(--pf-ink)" }}>{money(sheet.totalDebt, currency)}</b>
            </>
          )}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 10px", alignItems: "center" }}>
        <span className="pf-bal-side">{t("Assets")}</span>
        {row(assetLines, t("Assets"))}
        <span className="pf-bal-side">{t("Debt + equity")}</span>
        {row(right, t("Liabilities and equity"))}
      </div>
      {showLegend && (
        <div className="pf-bal-legends">
          {legend(assetLines, t("Assets"), sheet.totalAssets)}
          {legend(debtLines, t("Liabilities"), sheet.totalDebt)}
        </div>
      )}
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
        <h3 className="pf-bal-head">{t("Assets")}</h3>
        {sheet.assets.map((l) => (
          <Line key={l.id} line={l} d={delta(l, prev?.assets)} color={colorFor("asset", sheet.assets.filter((a) => a.value > 0).indexOf(l))} currency={currency} edit={edit} />
        ))}
        {edit && <AddRow onAdd={() => edit.onAdd("asset")} label={t("Add asset")} />}
        <div className="pf-bal-spacer" />
        <Total label={t("Total")} value={sheet.totalAssets} currency={currency} balanced={balanced} />
      </div>
      <div className="pf-bal-col">
        <h3 className="pf-bal-head">{t("Liabilities")}</h3>
        {sheet.liabilities.map((l) => (
          <Line key={l.id} line={l} d={delta(l, prev?.liabilities)} color={colorFor("debt", sheet.liabilities.filter((a) => a.value > 0).indexOf(l))} currency={currency} edit={edit} />
        ))}
        {edit && <AddRow onAdd={() => edit.onAdd("liability")} label={t("Add liability")} />}
        <div className="pf-bal-subtotal">
          <span>{t("Total liabilities")}</span>
          <span className="pf-rounded">{money(sheet.totalDebt, currency)}</span>
        </div>
        <div className="pf-bal-equity" data-neg={sheet.equity < 0}>
          <span>{t("Equity")}</span>
          <span className="pf-rounded" style={{ color: sheet.equity >= 0 ? EQUITY : "var(--pf-red)" }}>
            {money(sheet.equity, currency)}
            {prev && Math.abs(sheet.equity - prev.equity) >= 0.005 && (
              <small style={{ color: sheet.equity >= prev.equity ? "var(--pf-green)" : "var(--pf-red)" }}>{money(sheet.equity - prev.equity, currency, { signed: true })}</small>
            )}
          </span>
        </div>
        <div className="pf-bal-spacer" />
        <Total label={t("Total")} value={sheet.totalDebt + sheet.equity} currency={currency} balanced={balanced} />
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
          <span className="pf-bal-check" title={t("Assets = liabilities + equity")}>
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
          {line.kind === "auto" && <em>{t("auto")}</em>}
        </span>
      )}
      {/* Always present, so the amount columns line up row to row. */}
      <small className="pf-bal-delta">{d !== null ? money(d, currency, { signed: true }) : ""}</small>
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
      autoFocus={value === t("New post")}
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
