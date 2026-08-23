"use client";

import { useEffect, useRef } from "react";
import { cssVar, drawLine, fitCanvas, genSeries } from "@/lib/chart";

const CSS_HEIGHT = 280;

export default function GrowthChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const panel = panelRef.current;
    if (!canvas || !panel) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const data = {
      aggressive: genSeries(48, 1.05, 60, 200),
      balanced: genSeries(48, 1.032, 40, 200),
      savings: genSeries(48, 1.012, 8, 200),
      max: 0,
    };
    data.max = Math.max(...data.aggressive) * 1.05;

    function progress() {
      if (reduced) return 1;
      const rect = panel!.getBoundingClientRect();
      const vh = window.innerHeight;
      const startAt = vh * 0.85;
      const endAt = vh * 0.35;
      const raw = (startAt - rect.top) / (startAt - endAt);
      return Math.max(0, Math.min(1, raw));
    }

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dim = fitCanvas(canvas, CSS_HEIGHT);
      const accent = cssVar("--accent");
      const accent2 = cssVar("--accent-2");
      const soft = cssVar("--ink-soft");
      const p = progress();

      dim.ctx.clearRect(0, 0, dim.w, dim.h);

      dim.ctx.strokeStyle = cssVar("--line");
      dim.ctx.lineWidth = 1;
      for (let g = 1; g < 5; g++) {
        const gy = (dim.h / 5) * g;
        dim.ctx.beginPath();
        dim.ctx.moveTo(0, gy);
        dim.ctx.lineTo(dim.w, gy);
        dim.ctx.stroke();
      }

      drawLine(dim.ctx, dim.w, dim.h, data.savings, data.max, soft, 2, p);
      drawLine(dim.ctx, dim.w, dim.h, data.balanced, data.max, accent2, 2.5, p);
      drawLine(dim.ctx, dim.w, dim.h, data.aggressive, data.max, accent, 2.5, p);
    }

    let ticking = false;
    function schedule() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        draw();
        ticking = false;
      });
    }

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });

    let lastWidth = window.innerWidth;
    function onResize() {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      schedule();
    }
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className="reveal rounded-2xl border p-[clamp(1.3rem,3vw,2rem)]"
      style={{ borderColor: "var(--line)", background: "var(--bg-raised)" }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-md text-[0.93rem]" style={{ color: "var(--ink-soft)" }}>
          The same $200 monthly contribution, three ways — this is the chart style used
          throughout every lesson in the academy.
        </p>
        <div className="data flex gap-5 text-[0.78rem]" style={{ color: "var(--ink-soft)" }}>
          <Legend color="var(--accent)" label="Aggressive" />
          <Legend color="var(--accent-2)" label="Balanced" />
          <Legend color="var(--ink-soft)" label="Savings only" />
        </div>
      </div>
      <canvas ref={canvasRef} height={CSS_HEIGHT} style={{ height: CSS_HEIGHT }} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
