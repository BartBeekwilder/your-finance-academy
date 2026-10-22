"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/** Animates children of `container` (marked `data-flip-key`) from where they
 *  were to where they are whenever `dep` changes — rows glide to their new
 *  place when a list is re-sorted, instead of jumping (FLIP). */
export function useFlip(container: RefObject<HTMLElement | null>, dep: unknown) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>("[data-flip-key]")];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const item of items) {
      const key = item.dataset.flipKey!;
      const top = item.getBoundingClientRect().top;
      const before = last.current.get(key);
      if (before !== undefined && before !== top && !reduced) {
        item.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], {
          duration: 520,
          easing: "cubic-bezier(0.34, 1.3, 0.64, 1)",
        });
      }
    }
    last.current = new Map(items.map((i) => [i.dataset.flipKey!, i.getBoundingClientRect().top]));
  }, [container, dep]);
}
