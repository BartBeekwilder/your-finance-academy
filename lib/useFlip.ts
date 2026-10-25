"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

// FLIP: items with data-flip-key inside `container` glide from where they
// were to where they are after `dep` changes. Positions are measured
// relative to the container (so scrolling in between doesn't matter), and
// best taken right before the change: call the returned `capture()` in the
// click handler that reorders. Without a capture, the positions from the
// previous change are used.
export function useFlip(container: RefObject<HTMLElement | null>, dep: unknown) {
  const last = useRef(new Map<string, number>());
  const measure = useCallback(() => {
    const el = container.current;
    if (!el) return new Map<string, number>();
    const top = el.getBoundingClientRect().top;
    return new Map([...el.querySelectorAll<HTMLElement>("[data-flip-key]")].map((i) => [i.dataset.flipKey!, i.getBoundingClientRect().top - top]));
  }, [container]);
  const capture = useCallback(() => {
    // Finish any glide still running so the rows are measured where they rest.
    container.current?.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((i) => i.getAnimations().forEach((a) => a.finish()));
    last.current = measure();
  }, [container, measure]);
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const now = measure();
    for (const item of el.querySelectorAll<HTMLElement>("[data-flip-key]")) {
      const key = item.dataset.flipKey!;
      const before = last.current.get(key);
      const after = now.get(key);
      if (before !== undefined && after !== undefined && Math.abs(before - after) > 0.5 && !reduced) {
        item.animate([{ transform: `translateY(${before - after}px)` }, { transform: "translateY(0)" }], {
          duration: 520,
          easing: "cubic-bezier(0.34, 1.3, 0.64, 1)",
        });
      }
    }
    last.current = now;
  }, [container, dep, measure]);
  return capture;
}
