"use client";

import { t } from "@/lib/i18n";
import { CalendarClock, Check, ChartPie, Coins, Landmark, Repeat, Scale, Users, Wallet, type LucideIcon } from "lucide-react";

// The onboarding's journey bar: one node per question, joined by a glass
// track that fills with the brand gradient. Moving on, the fill springs to
// the next node (a little overshoot, like the rest of the app) with a
// glowing comet at its tip and a sheen running through it; the node you're
// on breathes, done nodes turn into a check, and the ones ahead wait dimmed.
// A done node can be tapped to go back to it. Welcome sits before the first
// node; on the last screen the whole track lights up once.

const NODES: { id: string; label: () => string; icon: LucideIcon }[] = [
  { id: "currency", label: () => t("Currency"), icon: Coins },
  { id: "household", label: () => t("Household"), icon: Users },
  { id: "income", label: () => t("Income"), icon: Wallet },
  { id: "accounts", label: () => t("Accounts"), icon: Landmark },
  { id: "fixed", label: () => t("Fixed costs"), icon: Repeat },
  { id: "budgets", label: () => t("Budgets"), icon: ChartPie },
  { id: "balance", label: () => t("Balance sheet"), icon: Scale },
  { id: "history", label: () => t("Start date"), icon: CalendarClock },
];

export default function OnboardingProgress({ step, onPick }: {
  /** The screen shown: "welcome", one of the nodes' ids, or "done". */
  step: string;
  /** Go back to a node already passed. */
  onPick: (id: string) => void;
}) {
  const at = NODES.findIndex((n) => n.id === step);
  const done = step === "done";
  // Where the fill ends: before the first node on Welcome, at the node
  // you're on, the whole way at the end.
  const reach = done ? 1 : at < 0 ? 0 : at / (NODES.length - 1);
  const current = NODES[at];

  return (
    <div className="pf-jb" data-done={done || undefined} data-start={at < 0 && !done ? true : undefined}>
      <div className="pf-jb-rail">
        <div className="pf-jb-track" aria-hidden>
          <span className="pf-jb-fill" style={{ transform: `scaleX(${reach})` }}>
            <span className="pf-jb-sheen" />
          </span>
          <span className="pf-jb-comet" style={{ insetInlineStart: `${reach * 100}%` }} />
        </div>
        <ol className="pf-jb-nodes">
          {NODES.map((n, i) => {
            const state = done || i < at ? "done" : i === at ? "now" : "ahead";
            const Icon = n.icon;
            return (
              <li key={n.id} style={{ ["--i" as string]: i }}>
                <button
                  type="button"
                  className="pf-jb-node"
                  data-state={state}
                  disabled={state !== "done"}
                  onClick={() => onPick(n.id)}
                  title={n.label()}
                  aria-label={n.label()}
                  aria-current={state === "now" ? "step" : undefined}
                >
                  <span key={state} className="pf-jb-icon">
                    {state === "done" ? <Check size={13} strokeWidth={3} /> : <Icon size={13} strokeWidth={2.2} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div key={step} className="pf-jb-caption pf-readout" aria-live="polite">
        {done ? (
          <b>{t("All set")}</b>
        ) : current ? (
          <>
            <span>{t("Step {n} of {total}", { n: at + 1, total: NODES.length })}</span>
            <b>{current.label()}</b>
          </>
        ) : (
          <b>{t("Start")}</b>
        )}
        <span className="pf-jb-pct pf-rounded">{Math.round(reach * 100)}%</span>
      </div>
    </div>
  );
}
