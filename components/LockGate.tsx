"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cssVar, fitCanvas, genSeries } from "@/lib/chart";
import { LOCK_STORAGE_KEY } from "@/lib/lock";

const PASSWORD = "nh0583s";

type Phase = "locked" | "unlocking" | "unlocked";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

export default function LockGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("locked");
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const [granted, setGranted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem(LOCK_STORAGE_KEY) === "1") {
      setPhase("unlocked");
    } else {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (phase !== "unlocking") return;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      finish();
      return;
    }

    const series = genSeries(70, 1.1, 45, 100);
    const max = Math.max(...series) * 1.05;
    const dim = fitCanvas(canvas, canvas.parentElement!.getBoundingClientRect().height);
    const accent = cssVar("--accent");
    const accent2 = cssVar("--accent-2");

    const cardRect = cardRef.current?.getBoundingClientRect();
    const originX = cardRect ? cardRect.left + cardRect.width / 2 : dim.w / 2;
    const originY = cardRect ? cardRect.top + cardRect.height / 2 : dim.h / 2;

    let particles: Particle[] = [];
    let spawned = false;

    function spawnParticles() {
      const colors = [accent, accent2, "#ffffff"];
      particles = Array.from({ length: 70 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 6;
        return {
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          life: 1,
          maxLife: 0.6 + Math.random() * 0.5,
          size: 2 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
        };
      });
    }

    function drawComet(progress: number) {
      const n = series.length;
      const count = Math.max(2, Math.floor(n * progress));
      dim.ctx.save();
      dim.ctx.shadowColor = accent;
      dim.ctx.shadowBlur = 18;
      dim.ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const x = (i / (n - 1)) * dim.w;
        const y = dim.h - (series[i] / max) * (dim.h - 40) - 20;
        if (i === 0) dim.ctx.moveTo(x, y);
        else dim.ctx.lineTo(x, y);
      }
      dim.ctx.strokeStyle = accent;
      dim.ctx.lineWidth = 3.5;
      dim.ctx.lineJoin = "round";
      dim.ctx.lineCap = "round";
      dim.ctx.stroke();
      dim.ctx.restore();

      const idx = count - 1;
      if (idx > 0) {
        const tx = (idx / (n - 1)) * dim.w;
        const ty = dim.h - (series[idx] / max) * (dim.h - 40) - 20;
        dim.ctx.save();
        dim.ctx.shadowColor = "#fff";
        dim.ctx.shadowBlur = 24;
        dim.ctx.beginPath();
        dim.ctx.arc(tx, ty, 5, 0, Math.PI * 2);
        dim.ctx.fillStyle = "#fff";
        dim.ctx.fill();
        dim.ctx.restore();
      }
    }

    function drawParticles(dt: number) {
      for (const p of particles) {
        if (p.life <= 0) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.life -= dt / p.maxLife;
        const alpha = Math.max(0, p.life);
        dim.ctx.globalAlpha = alpha;
        dim.ctx.fillStyle = p.color;
        dim.ctx.beginPath();
        dim.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        dim.ctx.fill();
      }
      dim.ctx.globalAlpha = 1;
    }

    function updateMask(pct: number) {
      const value =
        pct <= 0
          ? "none"
          : `radial-gradient(circle at 50% 45%, transparent ${pct}%, black ${pct + 1.5}%)`;
      overlay!.style.maskImage = value;
      overlay!.style.webkitMaskImage = value;
    }

    const start = performance.now();
    let last = start;
    let raf = 0;

    function frame(now: number) {
      const t = now - start;
      const dt = (now - last) / 1000;
      last = now;

      dim.ctx.clearRect(0, 0, dim.w, dim.h);

      const lineProgress = Math.max(0, Math.min(1, (t - 50) / 700));
      drawComet(lineProgress);

      if (t >= 450 && !spawned) {
        spawned = true;
        spawnParticles();
      }
      if (spawned) drawParticles(dt);

      if (t >= 650) {
        const p = Math.max(0, Math.min(1, (t - 650) / 900));
        const eased = p * p; // accelerating "snap open"
        updateMask(eased * 165);
      }

      if (t < 1700) {
        raf = requestAnimationFrame(frame);
      } else {
        finish();
      }
    }
    raf = requestAnimationFrame(frame);
    const safety = window.setTimeout(finish, 3000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function finish() {
    sessionStorage.setItem(LOCK_STORAGE_KEY, "1");
    setPhase("unlocked");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim().toLowerCase() === PASSWORD) {
      setGranted(true);
      setPhase("unlocking");
      window.setTimeout(() => setExiting(true), 550);
    } else {
      setShake(true);
      setValue("");
      window.setTimeout(() => setShake(false), 500);
    }
  }

  const filled = value.length;
  const slots = PASSWORD.length;

  return (
    <>
      {phase !== "unlocked" && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-6"
          style={{ background: "var(--bg)" }}
        >
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />

          <div
            ref={cardRef}
            className="relative w-full max-w-[22rem] rounded-2xl border p-8 text-center backdrop-blur-sm transition-all duration-500"
            style={{
              borderColor: shake ? "#c0392b" : granted ? "var(--accent)" : "var(--line)",
              background: "color-mix(in srgb, var(--bg-raised) 92%, transparent)",
              boxShadow: granted ? "0 0 60px -10px var(--accent)" : "none",
              animation: shake ? "yfa-shake 0.4s ease" : "yfa-breathe 4s ease-in-out infinite",
              opacity: exiting ? 0 : 1,
              transform: exiting
                ? "scale(0.82) rotate(-4deg) translateY(-10px)"
                : "scale(1) rotate(0deg) translateY(0)",
            }}
          >
            <p className="eyebrow mb-3" style={{ color: granted ? "var(--accent)" : undefined }}>
              {granted ? "Access granted" : "Private preview"}
            </p>
            <h1
              className="mb-2 text-[1.7rem] font-normal"
              style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
            >
              {granted ? "Unlocking…" : "Enter the vault"}
            </h1>
            <p className="mb-6 text-sm" style={{ color: "var(--ink-soft)" }}>
              This site is locked while it&apos;s in progress.
            </p>

            <form onSubmit={onSubmit}>
              <input
                ref={inputRef}
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value.slice(0, slots + 4))}
                className="sr-only"
                autoComplete="off"
                autoFocus
              />
              <div
                className="mb-5 flex justify-center gap-1.5"
                onClick={() => inputRef.current?.focus()}
              >
                {Array.from({ length: slots }).map((_, i) => (
                  <div
                    key={i}
                    className="relative flex h-11 w-8 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: i < filled ? "var(--accent)" : "var(--line)",
                    }}
                  >
                    {i < filled && (
                      <span
                        key={`dot-${i}-${filled}`}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: "var(--accent)",
                          animation: "yfa-popin 0.25s cubic-bezier(.34,1.56,.64,1)",
                        }}
                      />
                    )}
                    {i === filled - 1 && (
                      <span
                        key={`ping-${i}-${filled}`}
                        className="absolute inset-0 rounded-lg"
                        style={{
                          border: "1.5px solid var(--accent)",
                          animation: "yfa-ping 0.5s ease-out",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="w-full rounded-lg px-5 py-3 text-[0.92rem] font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--accent)", color: "#1b1502" }}
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      )}

      <div style={{ visibility: phase === "unlocked" ? "visible" : "hidden" }}>{children}</div>

      <style>{`
        @keyframes yfa-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes yfa-breathe {
          0%, 100% { box-shadow: 0 0 0px 0px transparent; }
          50% { box-shadow: 0 0 32px -14px var(--accent); }
        }
        @keyframes yfa-popin {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes yfa-ping {
          0% { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </>
  );
}
