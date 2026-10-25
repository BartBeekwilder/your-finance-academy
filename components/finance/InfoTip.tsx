"use client";

import { t } from "@/lib/i18n";
import Link from "next/link";
import { Info } from "lucide-react";
import { useState } from "react";
import { termById } from "@/lib/finance/glossary";

/** A small ⓘ beside a term: its plain-words explanation on hover or tap, with
 *  a link to the Glossary. Clicks don't reach the row around it. */
export default function InfoTip({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const term = termById(id);
  if (!term) return null;
  return (
    <span className="pf-info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={t("What is {term}?", { term: t(term.term) })} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Info size={12} strokeWidth={2.4} />
      </button>
      {open && (
        <span className="pf-info-pop" role="tooltip">
          <b>{t(term.term)}</b>
          {t(term.text)}
          <Link href={`/app/glossary#${term.id}`}>{t("All terms")} →</Link>
        </span>
      )}
    </span>
  );
}
