"use client";

import { useId } from "react";
import { t } from "@/lib/i18n";
import { useTween } from "./charts";

// Your share of the home as a house that fills up like water: the level is
// the ownership share, its surface a slow double wave, the colour going
// from violet (little owned) to teal-green (all yours). The level glides to
// a new value (a new month on the time slider, an extra repayment).

export default function HouseFill({ share, label }: { share: number; label?: string }) {
  const id = useId().replace(/:/g, "");
  const [s] = useTween([Math.min(Math.max(share, 0), 1)], 900);
  // The house's interior runs from y=58 (roof top) to y=196 (floor).
  const top = 58, floor = 196;
  const level = floor - (floor - top) * s;
  const house = "M100 18 L186 92 L172 92 L172 196 L28 196 L28 92 L14 92 Z";

  return (
    <div className="pf-house" role="img" aria-label={t("{pct}% of your home is yours", { pct: Math.round(share * 100) })}>
      <svg viewBox="0 0 200 210" width="100%" height="100%">
        <defs>
          <clipPath id={`clip${id}`}>
            <path d={house} />
          </clipPath>
          {/* Deep violet at the bottom; the surface colour says how far
              along you are — violet → teal → green as the share grows. */}
          <linearGradient id={`water${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#3b2f9e" />
            <stop offset="100%" stopColor={surface(s)} />
          </linearGradient>
          <linearGradient id={`wall${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
          </linearGradient>
        </defs>

        {/* Chimney and the empty house. */}
        <rect x="136" y="34" width="16" height="36" rx="2" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" />
        <path d={house} fill={`url(#wall${id})`} />

        {/* The water: two waves sliding past each other. */}
        <g clipPath={`url(#clip${id})`}>
          <g style={{ transform: `translateY(${level}px)` }}>
            <path className="pf-house-wave pf-house-wave-back" d={wave(-200, 600, 7)} fill={surface(s)} opacity="0.35" />
            <path className="pf-house-wave" d={wave(-200, 600, 5)} fill={`url(#water${id})`} />
          </g>
        </g>

        {/* Outline, door and windows on top. */}
        <path d={house} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinejoin="round" />
        <rect x="88" y="150" width="24" height="46" rx="3" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <rect x="46" y="112" width="28" height="24" rx="3" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <rect x="126" y="112" width="28" height="24" rx="3" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />

        <text x="100" y="98" textAnchor="middle" className="pf-house-pct">{Math.round(s * 100)}%</text>
        {label && <text x="100" y="208" textAnchor="middle" className="pf-house-label">{label}</text>}
      </svg>
    </div>
  );
}

/** The water's surface colour at a share: violet → teal (50%) → green. */
function surface(s: number) {
  const stops: [number, [number, number, number]][] = [[0, [94, 92, 230]], [0.5, [64, 200, 224]], [1, [48, 209, 88]]];
  const i = s <= 0.5 ? 0 : 1;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1];
  const k = (s - a) / (b - a);
  return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(",")})`;
}

/** A wave strip from x0 to x1, filled down to well below the house. */
function wave(x0: number, x1: number, amp: number) {
  const len = 100;
  let d = `M${x0} 0`;
  for (let x = x0; x < x1; x += len) d += ` Q${x + len / 4} ${-amp} ${x + len / 2} 0 T${x + len} 0`;
  return `${d} L${x1} 260 L${x0} 260 Z`;
}
