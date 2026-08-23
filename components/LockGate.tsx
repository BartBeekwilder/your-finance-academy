"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cssVar, drawLine, fitCanvas, genSeries } from "@/lib/chart";

const PASSWORD = "nh0583s";
const STORAGE_KEY = "yfa-unlocked";

type Phase = "locked" | "unlocking" | "unlocked";

export default function LockGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("locked");
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setPhase("unlocked");
    } else {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (phase !== "unlocking") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      finish();
      return;
    }

    const series = genSeries(60, 1.08, 40, 100);
    const max = Math.max(...series) * 1.05;
    const dim = fitCanvas(canvas, canvas.parentElement!.getBoundingClientRect().height);
    const accent = cssVar("--accent");
    const start = performance.now();
    const duration = 900;
    let raf = 0;

    function frame(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      dim.ctx.clearRect(0, 0, dim.w, dim.h);
      drawLine(dim.ctx, dim.w, dim.h, series, max, accent, 3, eased);
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        window.setTimeout(finish, 500);
      }
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function finish() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setPhase("unlocked");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim().toLowerCase() === PASSWORD) {
      setPhase("unlocking");
    } else {
      setShake(true);
      setValue("");
      window.setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <>
      {phase !== "unlocked" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-6 transition-all duration-700"
          style={{
            background: "var(--bg)",
            opacity: phase === "unlocking" ? 0 : 1,
            transform: phase === "unlocking" ? "scale(1.04)" : "scale(1)",
            pointerEvents: phase === "unlocking" ? "none" : "auto",
          }}
        >
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
          />

          <div
            className="relative w-full max-w-[22rem] rounded-2xl border p-8 text-center backdrop-blur-sm"
            style={{
              borderColor: shake ? "#c0392b" : "var(--line)",
              background: "color-mix(in srgb, var(--bg-raised) 92%, transparent)",
              animation: shake ? "shake 0.4s ease" : undefined,
            }}
          >
            <p className="eyebrow mb-3">Private preview</p>
            <h1
              className="mb-2 text-[1.7rem] font-normal"
              style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
            >
              Enter the vault
            </h1>
            <p className="mb-6 text-sm" style={{ color: "var(--ink-soft)" }}>
              This site is locked while it's in progress.
            </p>
            <form onSubmit={onSubmit}>
              <input
                ref={inputRef}
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Password"
                className="data mb-3 w-full rounded-lg border bg-transparent px-4 py-3 text-center text-[1.05rem] tracking-widest outline-none"
                style={{ borderColor: "var(--line)" }}
                autoComplete="off"
                autoFocus
              />
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

      <div
        style={{
          visibility: phase === "unlocked" ? "visible" : "hidden",
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </>
  );
}
