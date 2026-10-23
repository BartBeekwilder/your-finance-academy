"use client";

import type { ReactNode } from "react";
import { isRtl, useLang } from "@/lib/i18n";

/** Remounts the app when the language changes, so every t() and every
 *  formatted amount or date follows; sets the text direction. */
export default function LanguageRoot({ children }: { children: ReactNode }) {
  const lang = useLang();
  return (
    <div key={lang} lang={lang} dir={isRtl() ? "rtl" : "ltr"} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
