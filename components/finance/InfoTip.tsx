"use client";

import { t } from "@/lib/i18n";
import Link from "next/link";
import { Info } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { termById } from "@/lib/finance/glossary";

/** A small ⓘ beside a term: its plain-words explanation on hover or tap, with
 *  a link to the Glossary. Clicks don't reach the row around it. The bubble
 *  floats over the page (a portal, fixed position), so a card that clips
 *  its content — like the Liquidity card — never cuts it off. */
export default function InfoTip({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  // Where the bubble sits on screen: above the ⓘ by default, below it when
  // there's no room above; kept inside the window sideways.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Inside a sheet (<dialog>, the top layer) the bubble goes into the sheet,
  // else it would sit behind it; elsewhere on the page.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLayoutEffect(() => {
    if (!open || !pop.current || !btn.current) return;
    const b = btn.current.getBoundingClientRect();
    const h = pop.current.offsetHeight, w = pop.current.offsetWidth, margin = 12;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const left = Math.min(Math.max(b.left + b.width / 2 - w / 2, margin), Math.max(vw - margin - w, margin));
    const top = b.top - h - 8 < margin ? b.bottom + 8 : b.top - h - 8;
    setPos({ left, top });
  }, [open]);
  // Moving from the ⓘ onto the bubble (to reach its link) keeps it open.
  const show = () => {
    if (closing.current) clearTimeout(closing.current);
    setHost((btn.current?.closest("dialog") as HTMLElement | null) ?? document.body);
    setOpen(true);
  };
  const hide = () => { closing.current = setTimeout(() => { setOpen(false); setPos(null); }, 120); };
  const term = termById(id);
  if (!term) return null;
  return (
    <span className="pf-info" onMouseEnter={show} onMouseLeave={hide} onClick={(e) => e.stopPropagation()}>
      <button ref={btn} type="button" aria-label={t("What is {term}?", { term: t(term.term) })} aria-expanded={open} onClick={() => (open ? (setOpen(false), setPos(null)) : show())}>
        <Info size={12} strokeWidth={2.4} />
      </button>
      {open && host &&
        createPortal(
          <span
            ref={pop}
            className="pf-info-pop"
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? -9999, bottom: "auto", transform: "none", visibility: pos ? "visible" : "hidden" }}
          >
            <b>{t(term.term)}</b>
            {t(term.text)}
            <Link href={`/app/glossary#${term.id}`}>{t("All terms")} →</Link>
          </span>,
          host,
        )}
    </span>
  );
}
