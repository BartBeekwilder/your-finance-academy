"use client";

import { CalendarCheck, ChevronDown, CalendarRange, Flag, Flame, Gem, House, HousePlus, Landmark, Lock, Medal, PartyPopper, Percent, PiggyBank, Scale, ShieldCheck, Sprout, Target, TrendingUp, Trophy, FileText, FolderCheck, History, type LucideIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { t } from "@/lib/i18n";
import type { Badge } from "@/lib/finance/progress";

// The building blocks of the progress screens: the three rings (like a
// fitness watch), the streak flame, badge tiles and a celebration overlay.

// Three clearly different colours (like a watch's move / exercise / stand):
// hot pink-red for bookkeeping, neon lime for budgets, violet for saving.
export const RING_COLORS = {
  tracking: ["#fa114f", "#ff6fa0"],
  budget: ["#7ae200", "#d4ff3a"],
  saving: ["#8e5cff", "#d17bff"],
} as const;
/** The second lap's lighter tint, so a ring past 100% clearly reads as
 *  going round again. */
export const LAP_COLORS = { tracking: "#ffc2d6", budget: "#f0ffb8", saving: "#ecd2ff" } as const;

/** Three concentric rings that fill up (and glow when closed). Values 0…1+
 *  (saving can run past 1: the ring wraps a second lap in a lighter tint,
 *  its head casting a shadow on the first lap like a fitness watch, so it
 *  is clear the ring is on its second round). */
export function Rings({ tracking, budget, saving, size = 180 }: { tracking: number; budget: number; saving: number; size?: number }) {
  const id = useId().replace(/:/g, "");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const rings = [
    { key: "tracking", v: tracking, r: 80, c: RING_COLORS.tracking },
    { key: "budget", v: budget, r: 60, c: RING_COLORS.budget },
    { key: "saving", v: saving, r: 40, c: RING_COLORS.saving },
  ];
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={t("Rings")}>
      <defs>
        {rings.map((x) => (
          <linearGradient key={x.key} id={`${id}${x.key}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={x.c[0]} />
            <stop offset="100%" stopColor={x.c[1]} />
          </linearGradient>
        ))}
        {rings.map((x) => (
          <linearGradient key={`lap${x.key}`} id={`${id}lap${x.key}`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={x.c[1]} />
            <stop offset="100%" stopColor={LAP_COLORS[x.key as keyof typeof LAP_COLORS]} />
          </linearGradient>
        ))}
        <filter id={`${id}cap`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.75" />
        </filter>
      </defs>
      {rings.map((x, i) => {
        const len = 2 * Math.PI * x.r;
        const v = Math.min(Math.max(x.v, 0), 2);
        const closed = v >= 0.999;
        return (
          <g key={x.key} transform="rotate(-90 100 100)">
            <circle cx="100" cy="100" r={x.r} fill="none" stroke={x.c[0]} strokeOpacity="0.16" strokeWidth="16" />
            <circle
              cx="100"
              cy="100"
              r={x.r}
              fill="none"
              stroke={`url(#${id}${x.key})`}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${len * Math.min(v, 1) * (shown ? 1 : 0)} ${len}`}
              style={{ transition: `stroke-dasharray 1.4s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.15}s`, filter: closed ? `drop-shadow(0 0 6px ${x.c[0]})` : undefined }}
            />
            {v > 1 && (
              <>
                <circle
                  cx="100"
                  cy="100"
                  r={x.r}
                  fill="none"
                  stroke={`url(#${id}lap${x.key})`}
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${len * (v - 1) * (shown ? 1 : 0)} ${len}`}
                  style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1) 1.4s", filter: `drop-shadow(0 0 8px ${x.c[1]})` }}
                />
                {/* The head of the second lap, lying on top of the first with
                    a shadow under it — the fitness-watch "overlap" cue. */}
                <circle
                  className="pf-ring-cap"
                  cx={100 + x.r * Math.cos(2 * Math.PI * (v - 1))}
                  cy={100 + x.r * Math.sin(2 * Math.PI * (v - 1))}
                  r={8}
                  fill={LAP_COLORS[x.key as keyof typeof LAP_COLORS]}
                  filter={`url(#${id}cap)`}
                  data-shown={shown}
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function RingLegend({ tracking, budget, saving, notes = {} }: { tracking: number; budget: number; saving: number; /** Why a ring can't fill (shown instead of its %). */ notes?: { tracking?: string; budget?: string } }) {
  const rows = [
    { label: t("Tracking"), hint: notes.tracking ?? t("Days you updated your books"), v: tracking, c: RING_COLORS.tracking[0], na: !!notes.tracking },
    { label: t("Budget"), hint: notes.budget ?? t("Budgets on track"), v: budget, c: RING_COLORS.budget[0], na: !!notes.budget },
    { label: t("Saving"), hint: t("Saved against 20% of income"), v: saving, c: RING_COLORS.saving[0], na: false },
  ];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "10px 1fr auto", gap: 10, alignItems: "center" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: r.c, boxShadow: r.v >= 1 ? `0 0 8px ${r.c}` : undefined }} />
          <span>
            <b style={{ fontSize: "0.9rem" }}>{r.label}</b>
            <span style={{ display: "block", fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>{r.hint}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {r.v > 1 && (
              <span className="pf-ring-lap" style={{ ["--c" as string]: r.c }}>
                {t("2nd lap")}
              </span>
            )}
            <b className="pf-rounded" style={{ color: r.na ? "var(--pf-ink-3)" : r.c }}>{r.na ? "—" : `${Math.round(r.v * 100)}%`}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

export function StreakFlame({ days }: { days: number }) {
  return (
    <span className="pf-streak" data-hot={days >= 7}>
      <Flame size={18} />
      <b className="pf-rounded">{days}</b>
      <span>{days === 1 ? t("day") : t("days")}</span>
    </span>
  );
}

const ICONS: Record<string, LucideIcon> = {
  "calendar-check": CalendarCheck, "calendar-range": CalendarRange, trophy: Trophy, flame: Flame, "piggy-bank": PiggyBank, gem: Gem,
  "trending-up": TrendingUp, landmark: Landmark, house: House, "shield-check": ShieldCheck, percent: Percent, target: Target,
  medal: Medal, sprout: Sprout, flag: Flag, "party-popper": PartyPopper, scale: Scale, "house-plus": HousePlus,
  "file-text": FileText, history: History, "folder-check": FolderCheck,
};

export function BadgeTile({ badge, earnedAt, locale }: { badge: Badge; earnedAt?: string; locale: string }) {
  const Icon = ICONS[badge.icon] ?? Trophy;
  const earned = !!earnedAt;
  return (
    <div className="pf-award" data-earned={earned} title={t(badge.hint)}>
      <span className="pf-award-icon">{earned ? <Icon size={22} /> : <Lock size={16} />}</span>
      <b>{t(badge.title)}</b>
      <span>{earned ? new Date(earnedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : t(badge.hint)}</span>
      <em className="pf-rounded">+{badge.points}</em>
    </div>
  );
}

/** Full-screen moment for new badges or a closed month. */
export function Celebration({ title, lines, onClose }: { title: string; lines: { icon?: string; text: string; points?: number }[]; onClose: () => void }) {
  // The first five straight away; the rest unfold from "+N more".
  const [all, setAll] = useState(false);
  const shown = all ? lines : lines.slice(0, 5);
  const total = lines.reduce((s, l) => s + (l.points ?? 0), 0);
  return (
    <div className="pf-celebrate" role="dialog" aria-label={title} onClick={onClose}>
      <div className="pf-celebrate-burst" />
      <div className="pf-celebrate-card" onClick={(e) => e.stopPropagation()}>
        <PartyPopper size={36} color="#ffd60a" />
        <h2>{title}</h2>
        <div style={{ display: "grid", gap: 8, width: "100%" }}>
          {shown.map((l, i) => {
            const Icon = (l.icon && ICONS[l.icon]) || Sparkle;
            return (
              <div key={i} className="pf-celebrate-line" style={{ animationDelay: `${i < 5 ? 0.25 + i * 0.12 : (i - 5) * 0.09}s` }}>
                <Icon size={18} />
                <span>{l.text}</span>
                {l.points !== undefined && <b className="pf-rounded">+{l.points}</b>}
              </div>
            );
          })}
          {lines.length > 5 && !all && (
            <button type="button" className="pf-celebrate-line pf-celebrate-more" style={{ animationDelay: "0.9s" }} onClick={() => setAll(true)}>
              <ChevronDown size={18} />
              <span>{t("+{n} more", { n: lines.length - 5 })}</span>
              <b className="pf-rounded">+{lines.slice(5).reduce((s, l) => s + (l.points ?? 0), 0)}</b>
            </button>
          )}
          {lines.length > 1 && (
            <div className="pf-celebrate-total" style={{ animationDelay: all ? `${(lines.length - 5) * 0.09 + 0.1}s` : "1s" }}>
              <span>{t("Total")}</span>
              <b className="pf-rounded">+{total}</b>
            </div>
          )}
        </div>
        <button className="pf-button" onClick={onClose}>{t("Continue")}</button>
      </div>
    </div>
  );
}

const Sparkle = Trophy;
