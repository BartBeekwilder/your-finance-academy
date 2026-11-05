"use client";

import { useState } from "react";
import type { JourneyNode } from "./onboardingRoutes";

// Behind the onboarding: one still line winding across the screen, with a
// dot per chapter (or per step on the quick route). Finished chapters glow
// green; the one just finished flashes once. Not animated otherwise — the
// line itself never moves.

const W = 1600;
const H = 900;
// The line: a gentle S across the screen, low on the left, high on the right.
const at = (u: number) => ({
  x: -60 + u * (W + 120),
  y: H * (0.72 - 0.42 * u) + Math.sin(u * Math.PI * 2.4) * H * 0.16,
});

function pathD(steps = 120) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const p = at(i / steps);
    d += `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }
  return d;
}
const LINE = pathD();

export default function OnboardingTrail({ nodes, done, current }: { nodes: JourneyNode[]; done: boolean[]; current: number }) {
  // Only chapters finished while this is open flash; ones finished before stay lit.
  const [doneAtStart] = useState(() => done);
  const n = nodes.length;
  // Dots spread over the middle of the line, so none sits at the screen edge.
  const dots = nodes.map((node, i) => ({ node, ...at(0.1 + (0.8 * i) / Math.max(1, n - 1)) }));
  const lastDone = done.lastIndexOf(true);
  // The lit part of the line: up to the last finished dot.
  const litTo = lastDone < 0 ? 0 : 0.1 + (0.8 * lastDone) / Math.max(1, n - 1);

  return (
    <svg className="pf-ob-trail" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="pf-trail-lit" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#30d158" stopOpacity="0" />
          <stop offset="0.25" stopColor="#30d158" stopOpacity="0.5" />
          <stop offset="1" stopColor="#30d158" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <path d={LINE} className="pf-ob-trail-line" />
      {litTo > 0 && (
        <path d={LINE} className="pf-ob-trail-lit" pathLength={1} strokeDasharray={`${litTo} 1`} />
      )}
      {dots.map(({ node, x, y }, i) => {
        const flash = done[i] && !doneAtStart[i];
        return (
          <g key={node.id} className="pf-ob-trail-dot" data-done={done[i]} data-current={i === current} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            {flash && <circle key={`f${i}`} r={14} className="pf-ob-trail-flash" />}
            <circle r={i === current ? 9 : 7} className="pf-ob-trail-ring" />
            <circle r={i === current ? 4.5 : 3.5} className="pf-ob-trail-core" />
          </g>
        );
      })}
    </svg>
  );
}
