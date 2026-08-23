"use client";

import { useEffect, useRef, useState } from "react";

export default function Counter({
  target,
  decimals = 0,
  suffix = "",
  label,
}: {
  target: number;
  decimals?: number;
  suffix?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function animate() {
      const start = performance.now();
      const dur = reduced ? 1 : 1400;
      function frame(now: number) {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(target * eased);
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    if (!("IntersectionObserver" in window)) {
      animate();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            animate();
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <div className="bg-[var(--bg)] p-6">
      <div
        ref={ref}
        className="data text-[clamp(1.6rem,3vw,2.1rem)]"
        style={{ color: "var(--accent-strong)" }}
      >
        {value.toFixed(decimals)}
        {suffix}
      </div>
      <div className="mt-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
        {label}
      </div>
    </div>
  );
}
