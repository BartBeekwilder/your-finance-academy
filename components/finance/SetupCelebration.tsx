"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Star } from "lucide-react";
import { intlLocale, t } from "@/lib/i18n";
import { level } from "@/lib/finance/progress";
import { progressModel } from "@/lib/finance/progressModel";
import { useFinance } from "./FinanceProvider";
import { useTween } from "./charts";

// The bang when the setup is done: the onboarding leaves a note in this tab
// (CELEBRATE) and the dashboard opens with a burst of confetti, the points
// counting up and the level they bring. Once per finish; a tap, Escape or the
// button closes it. In the preview the points are shown but not kept.

export const CELEBRATE = "pf-celebrate";
export type Celebration = { points: number; title: string; preview?: boolean };

const COLORS = ["#6c5ce7", "#00c2a8", "#ffd60a", "#ff375f", "#40c8e0", "#30d158", "#ff9f0a"];
/** A repeatable 0–1 scatter per piece. */
const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const PIECES = Array.from({ length: 90 }, (_, i) => {
  const a = (i / 90) * Math.PI * 2 + rnd(i, 1) * 0.3;
  const r = 220 + rnd(i, 2) * 380;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r - 120, rot: rnd(i, 3) * 720 - 360, c: COLORS[i % COLORS.length], d: rnd(i, 4) * 0.25, w: 6 + rnd(i, 5) * 6 };
});

export default function SetupCelebration() {
  const { data, now } = useFinance();
  const [c, setC] = useState<Celebration | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CELEBRATE);
      if (!raw) return;
      sessionStorage.removeItem(CELEBRATE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this tab's note
      setC(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    if (!c) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setC(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [c]);
  // The total after this (the preview's points aren't in the books).
  const total = useMemo(() => (c ? progressModel(data, now).points + (c.preview ? c.points : 0) : 0), [c, data, now]);
  const lv = level(total);
  const [shown] = useTween([c ? c.points : 0], 1400);
  // Confetti: pieces flying out from the middle, each its own angle and spin
  // (a fixed scatter, so it's the same every render).
  const pieces = PIECES;
  if (!c) return null;
  return (
    <div className="pf-cele" role="dialog" aria-modal="true" aria-label={t("Setup complete")} onClick={() => setC(null)}>
      <div className="pf-cele-burst" aria-hidden>
        {pieces.map((p, i) => (
          <i key={i} style={{ ["--x" as string]: `${p.x}px`, ["--y" as string]: `${p.y}px`, ["--r" as string]: `${p.rot}deg`, ["--d" as string]: `${p.d}s`, background: p.c, width: p.w, height: p.w * 0.45 }} />
        ))}
      </div>
      <div className="pf-cele-card" onClick={(e) => e.stopPropagation()}>
        <span className="pf-cele-ring" aria-hidden><Star size={34} fill="currentColor" /></span>
        <span className="pf-cele-kicker">{t("Setup complete")}</span>
        <b className="pf-cele-points pf-rounded">+{Math.round(shown).toLocaleString(intlLocale())}</b>
        <span className="pf-cele-label">{t("points")} · {t(c.title)}</span>
        <div className="pf-cele-level">
          <div><span>{t(lv.name)}</span>{lv.next && <small>{t("{points} points to {level}", { points: lv.toNext.toLocaleString(intlLocale()), level: t(lv.next) })}</small>}</div>
          <i><em style={{ ["--f" as string]: lv.progress }} /></i>
        </div>
        {c.preview && <small className="pf-cele-preview">{t("Preview — the points aren't kept.")}</small>}
        <button type="button" className="pf-button pf-cele-go" onClick={() => setC(null)}>
          {t("To my dashboard")} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
