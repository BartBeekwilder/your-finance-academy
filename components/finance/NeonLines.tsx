"use client";

import { useBackgroundMotion, useMotionMode } from "@/lib/motion";
import { useEffect, useRef } from "react";

// Port of the iOS NeonLinesBackground: faint curves drifting across a black
// canvas, each drawn as three stacked strokes (wide soft glow, mid glow,
// thin bright core) with additive blending. Same motion constants and value
// ranges as the Swift version, so both platforms share one look.

type Seed = {
  hueBase: number;
  originAngle: number;
  originRadius: number;
  speed: number;
  phase: number;
  curveStrength: number;
  widthScale: number;
};

function makeSeeds(count: number): Seed[] {
  // Small deterministic PRNG (mulberry32) so the layout is stable across
  // visits. Swift's random(in:) maps bits differently, so the exact curves
  // differ from iOS — the ranges and motion are what's shared.
  let a = 7;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = (a: number, b: number) => a + next() * (b - a);
  return Array.from({ length: count }, (_, i) => ({
    hueBase: r(0.5, 0.74), // blue → teal → violet band
    originAngle: r(0, 2 * Math.PI),
    originRadius: r(0.85, 1.3),
    speed: r(0.05, 0.14),
    phase: i * 1.7 + r(0, 2),
    curveStrength: r(0.4, 1.1),
    widthScale: r(0.7, 1.5),
  }));
}

export default function NeonLines({ lineCount = 4, opacity = 0.1 }: { lineCount?: number; opacity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Off (or the background switch off): one still frame. Light: a low frame
  // rate, device pixels capped at 1× and without the widest glow stroke.
  // Full: capped at 30 fps — the lines drift slowly, more frames only cost
  // CPU without looking smoother.
  const mode = useMotionMode();
  const background = useBackgroundMotion();
  const still = mode === "off" || !background;
  const light = mode === "light";

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const seeds = makeSeeds(lineCount);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = -Infinity;
    const interval = 1000 / (light ? 12 : 30);
    const strokes = light ? ([[6, 0.75], [1.6, 1.2]] as const) : ([[14, 0.28], [6, 0.62], [1.6, 1.2]] as const);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, light ? 1 : 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (ms: number) => {
      if (!still && !reduced && ms - last < interval) {
        frame = requestAnimationFrame(draw);
        return;
      }
      last = ms;
      const t = ms / 1000 + 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const diag = Math.hypot(w, h);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (const s of seeds) {
        const drift = t * s.speed + s.phase;
        const a1 = s.originAngle + Math.sin(drift * 0.6) * 0.9;
        const a2 = s.originAngle + Math.PI + Math.cos(drift * 0.5) * 0.9;
        const r1 = diag * s.originRadius * (0.95 + 0.12 * Math.sin(drift * 0.4));
        const r2 = diag * (s.originRadius + 0.1) * (0.95 + 0.12 * Math.cos(drift * 0.35));
        const x1 = cx + Math.cos(a1) * r1, y1 = cy + Math.sin(a1) * r1;
        const x2 = cx + Math.cos(a2) * r2, y2 = cy + Math.sin(a2) * r2;
        const perp = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
        const bow = diag * 0.18 * s.curveStrength * Math.sin(drift * 0.7);
        const qx = (x1 + x2) / 2 + Math.cos(perp) * bow;
        const qy = (y1 + y2) / 2 + Math.sin(perp) * bow;

        let hue = (s.hueBase + 0.04 * Math.sin(t * 0.1 + s.phase)) % 1;
        if (hue < 0) hue += 1;

        for (const [width, alpha] of strokes) {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(qx, qy, x2, y2);
          ctx.strokeStyle = `hsla(${hue * 360}, 75%, 60%, ${Math.min(1, opacity * alpha)})`;
          ctx.lineWidth = width * s.widthScale;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }
      if (!reduced && !still) frame = requestAnimationFrame(draw);
    };

    // A still picture is redrawn after a resize (resizing clears the canvas).
    const onResize = () => {
      resize();
      if (still || reduced) frame = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", onResize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [lineCount, opacity, still, light]);

  return <canvas ref={ref} className="pf-neon" aria-hidden />;
}
