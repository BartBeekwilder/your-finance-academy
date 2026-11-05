"use client";

import { t } from "@/lib/i18n";
import { Check } from "lucide-react";
import type { JourneyNode, Step } from "./onboardingRoutes";

// The onboarding's journey bar: one node per step (quick start) or per
// chapter (complete setup), joined by a glass track that fills with the
// brand gradient. Moving on, the fill springs to where you are (a little
// overshoot, like the rest of the app) — within a chapter part of the way to
// the next node — with a glowing comet at its tip and a sheen running
// through it; the node you're on breathes, done nodes turn into a check, the
// ones ahead wait dimmed. A done node can be tapped to go back to it.
// Welcome and the route choice sit before the first node; on the last
// screen the whole track lights up once.

export default function OnboardingProgress({ nodes, step, chapters, onPick }: {
  nodes: JourneyNode[];
  /** The screen shown. */
  step: Step;
  /** Nodes are chapters (several questions each) rather than single steps. */
  chapters?: boolean;
  /** Go back to a node already passed (its first question). */
  onPick: (step: Step) => void;
}) {
  const at = nodes.findIndex((n) => n.steps.includes(step));
  const done = step === "done";
  const node = nodes[at];
  const within = node ? node.steps.indexOf(step) : 0;
  const parts = node ? node.steps.length : 1;
  // Where the fill ends: before the first node until the route is chosen,
  // at the node you're on (part of the way on in a longer chapter), the
  // whole way at the end.
  const reach = done ? 1 : at < 0 ? 0 : Math.min((at + within / parts) / Math.max(nodes.length - 1, 1), 1);

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
          {nodes.map((n, i) => {
            const state = done || i < at ? "done" : i === at ? "now" : "ahead";
            const Icon = n.icon;
            return (
              <li key={n.id} style={{ ["--i" as string]: i }}>
                <button
                  type="button"
                  className="pf-jb-node"
                  data-state={state}
                  disabled={state !== "done"}
                  onClick={() => onPick(n.steps[0])}
                  title={t(n.label)}
                  aria-label={t(n.label)}
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
        ) : node ? (
          <>
            <span>{chapters ? t("Chapter {n} of {total}", { n: at + 1, total: nodes.length }) : t("Step {n} of {total}", { n: at + 1, total: nodes.length })}</span>
            <b>{t(node.label)}</b>
            {parts > 1 && (
              // Where you are inside the chapter.
              <span className="pf-jb-dots" aria-label={`${within + 1}/${parts}`}>
                {node.steps.map((s, k) => <i key={s} data-on={k <= within || undefined} />)}
              </span>
            )}
          </>
        ) : (
          <b>{t("Start")}</b>
        )}
        <span className="pf-jb-pct pf-rounded">{Math.round(reach * 100)}%</span>
      </div>
    </div>
  );
}
