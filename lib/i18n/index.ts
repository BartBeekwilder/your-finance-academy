"use client";

import { useSyncExternalStore } from "react";
import { MESSAGES } from "./messages";

// Languages — the same set as the iOS app (Localizable.xcstrings), so a
// person sees the same words on both. The English text is the key (like
// iOS's String(localized:)): t("Net worth") returns the translation for the
// chosen language, or the English text when there isn't one yet, so
// nothing ever shows a raw key. Variables: t("{n} days", { n: 30 }).
//
// The language is kept per browser (default: the browser's own language)
// and also decides how amounts and dates are written (€ 1.234,56 in Dutch,
// €1,234.56 in English). Changing it remounts the app (see LanguageRoot),
// so plain t() calls everywhere pick it up.

export const LANGUAGES = [
  { code: "en", name: "English", intl: "en-GB" },
  { code: "nl", name: "Nederlands", intl: "nl-NL" },
  { code: "de", name: "Deutsch", intl: "de-DE" },
  { code: "fr", name: "Français", intl: "fr-FR" },
  { code: "es", name: "Español", intl: "es-ES" },
  { code: "it", name: "Italiano", intl: "it-IT" },
  { code: "pt-BR", name: "Português (Brasil)", intl: "pt-BR" },
  { code: "pl", name: "Polski", intl: "pl-PL" },
  { code: "tr", name: "Türkçe", intl: "tr-TR" },
  { code: "ru", name: "Русский", intl: "ru-RU" },
  { code: "ar", name: "العربية", intl: "ar", rtl: true },
  { code: "hi", name: "हिन्दी", intl: "hi-IN" },
  { code: "id", name: "Bahasa Indonesia", intl: "id-ID" },
  { code: "ja", name: "日本語", intl: "ja-JP" },
  { code: "ko", name: "한국어", intl: "ko-KR" },
  { code: "vi", name: "Tiếng Việt", intl: "vi-VN" },
  { code: "zh-Hans", name: "简体中文", intl: "zh-CN" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

const KEY = "pf-lang";
const listeners = new Set<() => void>();
let current: Lang | null = null;

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved as Lang;
  } catch {}
  if (typeof navigator !== "undefined") {
    for (const wanted of navigator.languages ?? [navigator.language]) {
      const w = wanted.toLowerCase();
      const hit = LANGUAGES.find((l) => l.code.toLowerCase() === w) ?? LANGUAGES.find((l) => w.startsWith(l.code.split("-")[0].toLowerCase()));
      if (hit) return hit.code;
    }
  }
  return "en";
}

/** The chosen language (English on the server). */
export function lang(): Lang {
  if (typeof window === "undefined") return "en";
  if (current === null) current = detect();
  return current;
}

export function setLang(code: Lang) {
  current = code;
  try {
    localStorage.setItem(KEY, code);
  } catch {}
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    lang,
    () => "en" as Lang,
  );
}

/** The Intl locale for amounts and dates in the chosen language. */
export function intlLocale(): string {
  return LANGUAGES.find((l) => l.code === lang())?.intl ?? "en-GB";
}

export function isRtl(): boolean {
  return LANGUAGES.some((l) => l.code === lang() && "rtl" in l && l.rtl);
}

/** Translate an English text; `{name}` placeholders are filled from `vars`. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const code = lang();
  const out = code === "en" ? text : (MESSAGES[code]?.[text] ?? text);
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}
