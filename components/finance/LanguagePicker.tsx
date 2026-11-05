"use client";

import { LANGUAGES, setLang, t, useLang, type Lang } from "@/lib/i18n";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// A language pill for before the app is set up (sign-in, the onboarding's
// welcome): a globe and the language's own name; it opens a panel with all
// languages, each in its own script, the current one checked. Picking one
// switches the whole page at once (Settings › Language does the same later).

export default function LanguagePicker({ align = "start" }: { align?: "start" | "end" }) {
  const current = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const name = LANGUAGES.find((l) => l.code === current)?.name ?? "English";

  // Closes on a click outside or Escape (Escape doesn't close the onboarding).
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);

  const pick = (code: Lang) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <div className="pf-lang" ref={box} data-align={align}>
      <button type="button" className="pf-lang-pill" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Globe size={15} />
        <span key={current} className="pf-readout">{name}</span>
        <ChevronDown size={14} className="pf-lang-chev" />
      </button>
      {open && (
        <div className="pf-lang-panel" role="listbox" aria-label={t("Language")}>
          {LANGUAGES.map((l, i) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === current}
              className="pf-lang-item"
              style={{ ["--i" as string]: i }}
              lang={l.code}
              dir={"rtl" in l && l.rtl ? "rtl" : undefined}
              onClick={() => pick(l.code)}
            >
              <span>{l.name}</span>
              {l.code === current && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
