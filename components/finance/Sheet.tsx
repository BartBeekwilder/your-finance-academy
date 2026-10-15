"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Modal sheet built on <dialog>: centered card on desktop, bottom sheet on
 *  phones (see .pf-sheet). Closes on Escape or a click on the backdrop.
 *
 *  `origin` is the element that opened it (a card, a donut slice, the +
 *  button). The sheet then grows out of that element's exact position and
 *  size, and shrinks back into it on close — a FLIP animation: measure the
 *  final box, start transformed onto the origin's box, animate to identity.
 *  Its contents fade in once the box has mostly grown, so text is never
 *  seen squashed.
 *
 *  Children stay rendered while closed (the dialog is just hidden), so the
 *  closing animation still shows them; callers reset state with a key.
 *  `focus` is a selector to focus on open — showModal() would otherwise
 *  focus the first button, usually Close. */
export default function Sheet({
  open,
  onClose,
  focus,
  label,
  origin,
  children,
}: {
  open: boolean;
  onClose: () => void;
  focus?: string;
  label: string;
  origin?: Element | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = origin?.isConnected ? origin.getBoundingClientRect() : null;

    if (open && !d.open) {
      d.showModal();
      if (focus) d.querySelector<HTMLElement>(focus)?.focus();
      if (from && !reduced) grow(d, from, "in");
    }
    if (!open && d.open) {
      if (from && !reduced) grow(d, from, "out").onfinish = () => d.close();
      else d.close();
    }
  }, [open, origin, focus]);

  return (
    <dialog
      ref={ref}
      className="pf-sheet"
      aria-label={label}
      // Escape: route through onClose so the closing animation plays.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </dialog>
  );
}

/** FLIP between the origin's box and the dialog's own box. */
function grow(d: HTMLDialogElement, from: DOMRect, dir: "in" | "out") {
  // Measure the settled box (cancel any running animation first).
  d.getAnimations().forEach((a) => a.cancel());
  const to = d.getBoundingClientRect();
  const squeezed = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  const box: Keyframe[] = [
    { transform: squeezed, borderRadius: "14px", opacity: 0.5 },
    { transform: "none", borderRadius: "18px", opacity: 1 },
  ];
  const content: Keyframe[] = [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }];
  const backdrop: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
  const opts: KeyframeAnimationOptions =
    dir === "in"
      ? { duration: 480, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" }
      : { duration: 340, easing: "cubic-bezier(0.4, 0, 0.7, 0.2)", direction: "reverse", fill: "forwards" };

  d.style.transformOrigin = "0 0";
  for (const child of Array.from(d.children)) (child as HTMLElement).animate(content, opts);
  try {
    d.animate(backdrop, { ...opts, pseudoElement: "::backdrop" });
  } catch {
    // Older browsers can't animate ::backdrop; the box animation still runs.
  }
  const anim = d.animate(box, opts);
  if (dir === "out") anim.addEventListener("finish", () => queueMicrotask(() => d.getAnimations({ subtree: true }).forEach((a) => a.cancel())));
  return anim;
}
