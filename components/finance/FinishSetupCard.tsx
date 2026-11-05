"use client";

import { t } from "@/lib/i18n";
import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useFinance } from "./FinanceProvider";
import { PREVIEW_DONE } from "./Onboarding";
import { CHAPTERS, chaptersDone } from "./onboardingRoutes";

// "Finish your setup": after a quick start, the dashboard offers the
// complete setup — a ring with the chapters answered, the next ones as
// chips, Continue (straight into the first open chapter) and an X to put the
// card away. Reads profile.onboarding; for the preview, this tab's
// sessionStorage (the preview saves nothing).

const PREVIEW_HIDDEN = "pf-onboarding-preview-hidden";

function readPreview(): string {
  try {
    return sessionStorage.getItem(PREVIEW_HIDDEN) ? "" : sessionStorage.getItem(PREVIEW_DONE) ?? "";
  } catch {
    return "";
  }
}
const listeners = new Set<() => void>();

export default function FinishSetupCard() {
  const { data, updateProfile } = useFinance();
  const previewRaw = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readPreview,
    () => "",
  );
  const preview = previewRaw ? (JSON.parse(previewRaw) as { route: string; steps: string[] }) : null;
  const own = data.profile.onboarding;
  const state = own && !own.hidden ? own : preview;
  if (!state || state.route !== "quick") return null;
  const done = chaptersDone(state.steps);
  if (done.length >= CHAPTERS.length) return null;
  const open = CHAPTERS.filter((c) => !done.includes(c));
  const share = done.length / CHAPTERS.length;
  const R = 22, C = 2 * Math.PI * R;

  const hide = () => {
    if (own && !own.hidden) void updateProfile({ onboarding: { ...own, hidden: true } });
    else {
      try {
        sessionStorage.setItem(PREVIEW_HIDDEN, "1");
      } catch {}
      listeners.forEach((l) => l());
    }
  };

  return (
    <section className="pf-card pf-finish">
      <svg className="pf-finish-ring" width="56" height="56" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="28" cy="28" r={R} fill="none" stroke="url(#pf-finish-g)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${C * share} ${C}`} transform="rotate(-90 28 28)" />
        <defs>
          <linearGradient id="pf-finish-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6E5BEA" />
            <stop offset="1" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
        <text x="28" y="28" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="13" fontWeight="700">{done.length}/{CHAPTERS.length}</text>
      </svg>
      <div className="pf-finish-text">
        <b>{t("Finish your setup")}</b>
        <span>{t("{n} of {total} chapters done — the rest takes a few minutes.", { n: done.length, total: CHAPTERS.length })}</span>
        <span className="pf-finish-chips">
          {open.slice(0, 4).map((c) => (
            <i key={c.id}><c.icon size={12} /> {t(c.label)}</i>
          ))}
          {open.length > 4 && <i>+{open.length - 4}</i>}
        </span>
      </div>
      <Link href="/app/welcome?continue=1" className="pf-button pf-finish-go">
        {t("Continue")} <ArrowRight size={15} />
      </Link>
      <button type="button" className="pf-icon-button pf-finish-x" aria-label={t("Hide")} onClick={hide}>
        <X size={14} />
      </button>
    </section>
  );
}
