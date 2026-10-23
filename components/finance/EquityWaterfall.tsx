"use client";

import { t } from "@/lib/i18n";
import { useState } from "react";
import { useShowAxes } from "@/lib/prefs";
import { money } from "@/lib/finance/format";
import type { Sheet } from "./BalanceSheet";
import Segmented from "./Segmented";

// How equity moved, as a waterfall (the Net worth page's, same look):
//   Per post  — equity at the end of the month before, then a floating bar
//               per post that changed: an asset going up or a debt going
//               down lifts equity (green), the reverse lowers it (red) —
//               ending in the chosen month's equity.
//   Per month — equity on 1 January, then each month's change up to the
//               chosen month, ending in its equity.
// Bars float from the level before to the level after, grow one after
// another, and the axis is fitted to the levels. Pointing at a bar says
// what it is.

const H = 210;
type Step = { key: string; label: string; long: string; from: number; to: number; kind: "total" | "change" };
type View = "post" | "month";

export default function EquityWaterfall({
  sheet,
  prev,
  months,
  sel,
  currency,
}: {
  sheet: Sheet;
  /** The month before the chosen one. */
  prev: Sheet;
  /** Equity on 1 January, then at the end of each month up to the chosen one. */
  months: { start: number; points: { label: string; full: string; value: number }[] };
  sel: number;
  currency: string;
}) {
  const showAxes = useShowAxes();
  const [view, setView] = useState<View>("post");
  const [hover, setHover] = useState<number | null>(null);
  const steps = view === "post" ? postSteps(sheet, prev) : monthSteps(months, sel);

  const levels = steps.flatMap((s) => [s.from, s.to]);
  const lo0 = Math.min(...levels), hi0 = Math.max(...levels);
  const pad = Math.max((hi0 - lo0) * 0.15, 1);
  const step = niceStep(hi0 - lo0 + 2 * pad);
  const lo = Math.floor((lo0 - pad) / step) * step, hi = Math.ceil((hi0 + pad) / step) * step;
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const shown = hover !== null ? steps[hover] : null;
  const first = steps[0], last = steps[steps.length - 1];

  return (
    <div className="pf-card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{view === "post" ? t("How your equity moved per post") : t("How your equity moved per month")}</span>
        <Segmented
          size="sm"
          label={t("Equity waterfall")}
          value={view}
          onChange={(v) => {
            setView(v);
            setHover(null);
          }}
          options={[
            { value: "post", label: t("Per post") },
            { value: "month", label: t("Per month") },
          ]}
        />
      </div>
      <div key={hover ?? "idle"} className="pf-readout" style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)", textAlign: "right", minHeight: 18 }}>
        {shown ? (
          shown.kind === "total" ? (
            <>
              {shown.long} · <b style={{ color: "#40c8e0" }}>{money(shown.to, currency)}</b>
            </>
          ) : (
            <>
              {shown.long} · <b style={{ color: shown.to >= shown.from ? "var(--pf-green)" : "var(--pf-red)" }}>{money(shown.to - shown.from, currency, { signed: true })}</b> equity → {money(shown.to, currency)}
            </>
          )
        ) : (
          <>
            {first.long} {money(first.to, currency)} → <b style={{ color: "#40c8e0" }}>{money(last.to, currency)}</b>{" "}
            <span style={{ color: last.to >= first.to ? "var(--pf-green)" : "var(--pf-red)" }}>({money(last.to - first.to, currency, { signed: true })})</span>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showAxes ? "auto 1fr" : "1fr", gap: 8 }}>
        {showAxes && (
          <div style={{ position: "relative", height: H, fontSize: "0.6rem", color: "var(--pf-ink-3)", textAlign: "right" }}>
            {[1, 0.5, 0].map((f) => (
              <span key={f} style={{ display: "block", position: f === 1 ? "relative" : "absolute", right: 0, bottom: f === 1 ? undefined : f * H, translate: f === 1 ? "0 -50%" : "0 50%", whiteSpace: "nowrap" }}>
                {money(lo + (hi - lo) * f, currency, { compact: true })}
              </span>
            ))}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div key={`${view}${sel}`} className="pf-wf-plot" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {[0, 0.5, 1].map((f) => (
              <span key={`g${f}`} className="pf-cbar-grid" style={{ bottom: f * H }} />
            ))}
            {steps.map((s, i) => {
              const total = s.kind === "total";
              const a = total ? lo : Math.min(s.from, s.to), b = total ? s.to : Math.max(s.from, s.to);
              const up = s.to >= s.from;
              return (
                <div key={s.key} className="pf-wf-slot" data-lit={hover === i} onMouseEnter={() => setHover(i)}>
                  <span
                    className="pf-wf-bar"
                    data-kind={s.kind}
                    data-up={up}
                    style={{ bottom: `${y(a)}%`, height: `max(${y(b) - y(a)}%, 2px)`, transformOrigin: total || up ? "bottom" : "top", animationDelay: `${i * 55}ms` }}
                  />
                  {i < steps.length - 1 && <span className="pf-wf-link" style={{ bottom: `${y(s.to)}%` }} />}
                </div>
              );
            })}
          </div>
          <div key={`l${view}${sel}`} className="pf-cbar-labels pf-readout pf-wf-names">
            {steps.map((s, i) => (
              <span key={s.key} data-lit={hover === i} data-now={s.kind === "total" && i > 0} title={s.long}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function postSteps(sheet: Sheet, prev: Sheet): Step[] {
  const start = prev.equity;
  const steps: Step[] = [{ key: "start", label: t("Start"), long: t("End of last month"), from: start, to: start, kind: "total" }];
  let level = start;
  const before = new Map([...prev.assets.map((l) => [l.id, l.value] as const), ...prev.liabilities.map((l) => [l.id, -l.value] as const)]);
  const lines = [...sheet.assets.map((l) => ({ ...l, sign: 1 })), ...sheet.liabilities.map((l) => ({ ...l, sign: -1 }))];
  const seen = new Set<string>();
  for (const l of lines) {
    seen.add(l.id);
    const change = l.sign * l.value - (before.get(l.id) ?? 0);
    if (Math.abs(change) < 0.005) continue;
    const debt = l.sign < 0;
    steps.push({ key: l.id, label: l.name, long: `${l.name}${debt ? (change > 0 ? ` · ${t("paid off")}` : ` · ${t("more debt")}`) : ""}`, from: level, to: level + change, kind: "change" });
    level += change;
  }
  // Posts that were there last month and are gone now.
  for (const [id, v] of before) {
    if (seen.has(id) || Math.abs(v) < 0.005) continue;
    const name = [...prev.assets, ...prev.liabilities].find((l) => l.id === id)?.name ?? t("Removed");
    steps.push({ key: id, label: name, long: `${name} · gone`, from: level, to: level - v, kind: "change" });
    level -= v;
  }
  steps.push({ key: "end", label: t("Now"), long: sheet.isCurrent ? t("Equity today") : t("Equity at month end"), from: sheet.equity, to: sheet.equity, kind: "total" });
  return steps;
}

function monthSteps(months: { start: number; points: { label: string; full: string; value: number }[] }, sel: number): Step[] {
  const steps: Step[] = [{ key: "start", label: t("1 Jan"), long: t("1 January"), from: months.start, to: months.start, kind: "total" }];
  let level = months.start;
  months.points.slice(0, sel + 1).forEach((p, i) => {
    steps.push({ key: `m${i}`, label: p.label, long: p.full, from: level, to: p.value, kind: "change" });
    level = p.value;
  });
  steps.push({ key: "end", label: t("Now"), long: months.points[sel]?.full ?? t("Now"), from: level, to: level, kind: "total" });
  return steps;
}

/** A round step giving about four gridlines over `span`. */
function niceStep(span: number) {
  const raw = Math.max(span, 1) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].find((m) => m * p >= raw) ?? 10) * p;
}
