"use client";

import { useEffect, useRef, useState } from "react";

/** Eases the camera between 0 (year) and 1 (month). Picks up from wherever
 *  it is, so flipping the toggle mid-zoom reverses smoothly. */
export function useZoom(target: 0 | 1, ms: number) {
  const [z, setZ] = useState<number>(target);
  const from = useRef<number>(target);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const begin = from.current;
    const span = Math.abs(target - begin);
    let raf = 0;
    const step = (t: number) => {
      const k = reduced || span === 0 ? 1 : Math.min(1, (t - start) / (ms * span));
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const v = k >= 1 ? target : begin + (target - begin) * e;
      from.current = v;
      setZ(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return z;
}
