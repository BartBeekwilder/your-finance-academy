"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Modal sheet built on <dialog>: centered card on desktop, bottom sheet on
 *  phones (see .pf-sheet). Closes on Escape or a click on the backdrop.
 *  `focus` is a selector for the element to focus on open — showModal()
 *  would otherwise focus the first button, usually Close. */
export default function Sheet({
  open,
  onClose,
  focus,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  focus?: string;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (focus) d.querySelector<HTMLElement>(focus)?.focus();
    }
    if (!open && d.open) d.close();
  }, [open, focus]);

  return (
    <dialog
      ref={ref}
      className="pf-sheet"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && children}
    </dialog>
  );
}
