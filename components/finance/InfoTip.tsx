"use client";

import { t } from "@/lib/i18n";
import Link from "next/link";
import { Info } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { termById } from "@/lib/finance/glossary";

/** A small ⓘ beside a term: its plain-words explanation on hover or tap, with
 *  a link to the Glossary. Clicks don't reach the row around it. */
export default function InfoTip({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  // Where the bubble fits: above by default, below when there's no room
  // above; nudged sideways to stay on screen.
  const [place, setPlace] = useState<{ below: boolean; shift: number }>({ below: false, shift: 0 });
  const pop = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!open || !pop.current || !btn.current) return;
    const b = btn.current.getBoundingClientRect();
    const h = pop.current.offsetHeight, w = pop.current.offsetWidth;
    const below = b.top - h - 12 < 0;
    const center = b.left + b.width / 2;
    const left = center - w / 2, right = center + w / 2, margin = 12;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const shift = !vw ? 0 : left < margin ? margin - left : right > vw - margin ? vw - margin - right : 0;
    setPlace({ below, shift });
  }, [open]);
  const term = termById(id);
  if (!term) return null;
  return (
    <span className="pf-info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={(e) => e.stopPropagation()}>
      <button ref={btn} type="button" aria-label={t("What is {term}?", { term: t(term.term) })} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Info size={12} strokeWidth={2.4} />
      </button>
      {open && (
        <span ref={pop} className="pf-info-pop" role="tooltip" data-below={place.below} style={{ ["--shift" as string]: `${place.shift}px` }}>
          <b>{t(term.term)}</b>
          {t(term.text)}
          <Link href={`/app/glossary#${term.id}`}>{t("All terms")} →</Link>
        </span>
      )}
    </span>
  );
}
