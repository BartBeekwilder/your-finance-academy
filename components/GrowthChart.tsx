"use client";

import { useEffect, useRef, useState } from "react";
import { cssVar, drawLine, fitCanvas, genSeries } from "@/lib/chart";

const CSS_HEIGHT = 320;

export default function GrowthChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [figure, setFigure] = useState({ pct: 0, value: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
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
      const rect = wrapper!.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      if (total <= 0) return 1;
      return Math.max(0, Math.min(1, -rect.top / total));
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
      const count = drawLine(dim.ctx, dim.w, dim.h, data.aggressive, data.max, accent, 3, p);

      const idx = Math.max(0, count - 1);
      setFigure({ pct: Math.round(p * 100), value: Math.round(data.aggressive[idx]) });
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
    <div ref={wrapperRef} className="relative h-[220vh]">
      <div className="sticky top-24 reveal in">
        <div
          className="rounded-2xl border p-[clamp(1.3rem,3vw,2rem)]"
          style={{ borderColor: "var(--line)", background: "var(--bg-raised)" }}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="max-w-md text-[0.93rem]" style={{ color: "var(--ink-soft)" }}>
                The same $200 monthly contribution, three ways — this is the chart style used
                throughout every lesson in the academy.
              </p>
              <p className="data mt-2 text-2xl" style={{ color: "var(--accent-strong, var(--accent))" }}>
                ${figure.value.toLocaleString()}
                <span className="ml-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                  {figure.pct}% scrolled
                </span>
              </p>
            </div>
            <div className="data flex gap-5 text-[0.78rem]" style={{ color: "var(--ink-soft)" }}>
              <Legend color="var(--accent)" label="Aggressive" />
              <Legend color="var(--accent-2)" label="Balanced" />
              <Legend color="var(--ink-soft)" label="Savings only" />
            </div>
          </div>
          <canvas ref={canvasRef} height={CSS_HEIGHT} style={{ height: CSS_HEIGHT }} />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
