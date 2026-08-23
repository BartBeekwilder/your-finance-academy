"use client";

import { useEffect, useRef, useState } from "react";
import { cssVar, drawLine, fitCanvas, genSeries } from "@/lib/chart";

const CSS_HEIGHT = 180;

export default function HeroChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seriesRef = useRef<number[] | null>(null);
  const [figure, setFigure] = useState("$0");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!seriesRef.current) {
      seriesRef.current = genSeries(60, 1.028, 90, 4000);
    }
    const series = seriesRef.current;
    const max = Math.max(...series) * 1.08;

    let raf = 0;
    let startT: number | null = null;

    function render(now: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (startT === null) startT = now;
      const progress = reduced ? 1 : Math.min(1, (now - startT) / 1600);
      const dim = fitCanvas(canvas, CSS_HEIGHT);
      const accent = cssVar("--accent");

      dim.ctx.clearRect(0, 0, dim.w, dim.h);

      dim.ctx.strokeStyle = cssVar("--line");
      dim.ctx.lineWidth = 1;
      for (let g = 1; g < 4; g++) {
        const gy = (dim.h / 4) * g;
        dim.ctx.beginPath();
        dim.ctx.moveTo(0, gy);
        dim.ctx.lineTo(dim.w, gy);
        dim.ctx.stroke();
      }

      const count = drawLine(dim.ctx, dim.w, dim.h, series, max, accent, 2.5, progress);

      dim.ctx.lineTo((count / (series.length - 1)) * dim.w, dim.h);
      dim.ctx.lineTo(0, dim.h);
      dim.ctx.closePath();
      const grad = dim.ctx.createLinearGradient(0, 0, 0, dim.h);
      grad.addColorStop(0, accent + "33");
      grad.addColorStop(1, accent + "00");
      dim.ctx.fillStyle = grad;
      dim.ctx.fill();

      const lastIdx = count - 1;
      if (lastIdx > 0) {
        const lx = (lastIdx / (series.length - 1)) * dim.w;
        const ly = dim.h - (series[lastIdx] / max) * (dim.h - 14) - 6;
        dim.ctx.beginPath();
        dim.ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        dim.ctx.fillStyle = accent;
        dim.ctx.fill();
      }

      const curVal = series[Math.max(0, lastIdx)];
      const pct = ((curVal / series[0] - 1) * 100).toFixed(0);
      setFigure(`$${Math.round(curVal).toLocaleString()} +${pct}%`);

      if (progress < 1) raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);

    let lastWidth = window.innerWidth;
    function onResize() {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      startT = null;
      raf = requestAnimationFrame(render);
    }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const [amount, pct] = figure.split(" ");

  return (
    <div
      className="reveal in rounded-2xl border p-4 pb-3.5"
      style={{ borderColor: "var(--line)", background: "var(--bg-raised)" }}
    >
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="eyebrow">Portfolio, 5yr</span>
        <span className="data text-2xl">
          {amount}
          {pct && (
            <span className="ml-1.5 text-sm" style={{ color: "var(--accent-2)" }}>
              {pct}
            </span>
          )}
        </span>
      </div>
      <canvas ref={canvasRef} height={CSS_HEIGHT} style={{ height: CSS_HEIGHT }} />
    </div>
  );
}
