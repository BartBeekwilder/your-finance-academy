"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { intlLocale, LANGUAGES, setLang, t as translate, useLang, type Lang } from "@/lib/i18n";

// The legal pages (/privacy, /terms) in the live site's look — the homepage's
// dark canvas, Geist and Geist Mono, its top bar and footer, mono section
// labels and the gold accent — and in the visitor's language (the same
// choice as the app, with a picker in the bar). The server renders English;
// the first browser render matches it, then switches to the visitor's
// language (no hydration mismatch), like /privacy/web-app.

const CSS = `
  .pp { --c-canvas: oklch(14% 0.018 210); --c-surface: oklch(18.5% 0.022 205); --c-surface-2: oklch(23% 0.025 205); --c-ink: oklch(94% 0.012 85); --c-ink-2: oklch(82% 0.012 85); --c-muted: oklch(66% 0.018 200); --c-rule: oklch(30% 0.025 205); --c-accent: oklch(80% 0.16 75); --c-live: #30d158; --c-accent-ink: oklch(15% 0.02 200); --f: "Geist", system-ui, sans-serif; --mono: "Geist Mono", ui-monospace, monospace; --g: clamp(16px, 2.6vw, 40px); }
  html:has(.pp) { background: var(--c-canvas); }
  .pp { background: var(--c-canvas); color: var(--c-ink); font: 400 16px/1.6 var(--f); -webkit-font-smoothing: antialiased; min-height: 100vh; }
  .pp a { color: inherit; }
  .pp .status { position: fixed; z-index: 40; inset: 0 0 auto 0; height: 48px; display: flex; align-items: center; gap: 20px; padding: 0 var(--g); background: color-mix(in oklch, var(--c-canvas) 88%, transparent); border-block-end: 1px solid var(--c-rule); backdrop-filter: blur(8px); }
  .pp .brand { display: grid; line-height: 1.1; text-decoration: none; }
  .pp .brand b { font-weight: 700; font-size: 14px; letter-spacing: -0.01em; }
  .pp .brand small { font: 400 10.5px var(--mono); color: var(--c-muted); white-space: nowrap; }
  .pp .status nav { margin-inline-start: auto; display: flex; align-items: center; gap: 18px; }
  .pp .status nav a { text-decoration: none; color: var(--c-ink-2); white-space: nowrap; font-size: 14px; }
  .pp .status nav a:hover, .pp .status nav a[aria-current] { color: var(--c-ink); }
  .pp .lang { appearance: none; border: 0; border-radius: 999px; padding: 5px 12px; background: var(--c-surface-2); color: var(--c-ink-2); font: 400 13px var(--f); }
  .pp .btn { display: inline-flex; align-items: center; height: 34px; padding: 0 14px; border-radius: 4px; background: var(--c-accent); color: var(--c-accent-ink) !important; font-weight: 500; text-decoration: none; font-size: 14px; }
  .pp .doc { max-width: 760px; margin: 0 auto; padding: calc(48px + clamp(40px, 8vw, 96px)) var(--g) 72px; }
  .pp .kicker { font: 500 12px var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--c-accent); }
  .pp h1 { font-family: var(--f); margin: 10px 0 12px; font-size: clamp(36px, 6vw, 60px); line-height: 1.02; letter-spacing: -0.03em; font-weight: 700; text-wrap: balance; }
  .pp .updated { margin: 0 0 40px; font: 400 13px var(--mono); color: var(--c-muted); }
  .pp .lede { margin: 0 0 40px; color: var(--c-ink-2); font-size: 18px; max-width: 54ch; }
  .pp section { padding: 26px 0; border-block-start: 1px solid var(--c-rule); }
  .pp h2 { margin: 0 0 12px; font: 500 13px/1.4 var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--c-muted); }
  .pp section p, .pp section li { margin: 0 0 14px; color: var(--c-ink-2); }
  .pp section p:last-child { margin-bottom: 0; }
  .pp section ul { margin: 0 0 14px; padding-inline-start: 20px; }
  .pp section li { margin-bottom: 6px; }
  .pp strong { color: var(--c-ink); font-weight: 600; }
  .pp .mono { font-family: var(--mono); font-size: 14px; color: var(--c-ink); }
  .pp .cta { margin-top: 40px; display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .pp .cta a:not(.btn) { color: var(--c-ink-2); }
  .pp .foot { display: flex; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; padding: 28px var(--g); border-block-start: 1px solid var(--c-rule); font: 400 12px var(--mono); color: var(--c-muted); }
  .pp .foot a { color: var(--c-muted); }
  .pp .foot__links { display: flex; gap: 16px; }
  .pp .foot__legal { flex-basis: 100%; font-size: 11px; opacity: .6; }
  @media (max-width: 640px) { .pp .status nav a.hide-sm { display: none; } .pp .brand small { display: none; } }
`;

type T = (text: string, vars?: Record<string, string | number>) => string;
const english: T = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text);
const noop = () => () => {};

/** t() that renders English on the server and in the first browser render,
 *  then the visitor's language. */
export function useLegalT() {
  const lang = useLang();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  return { t: hydrated ? translate : english, lang: hydrated ? lang : ("en" as Lang), locale: hydrated ? intlLocale() : "en-GB" };
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function LegalPage({ title, updated, lede, children }: { title: string; updated: Date; lede: ReactNode; children: ReactNode }) {
  const { t, lang, locale } = useLegalT();
  const date = updated.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  // Month names always start with a capital (Bart's rule).
  const month = updated.toLocaleDateString(locale, { month: "long" });
  const shown = date.replace(month, month.charAt(0).toLocaleUpperCase(locale) + month.slice(1));
  return (
    <div className="pp" lang={lang}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- these pages only, like the homepage */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
      <style>{CSS}</style>
      <header className="status">
        <Link className="brand" href="/" translate="no">
          <b>Personal Finance</b>
          <small>by YourFinanceAcademy.com</small>
        </Link>
        <nav aria-label={t("Menu")}>
          <select className="lang" aria-label={t("Language")} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <Link className="hide-sm" href="/updates">{t("Updates")}</Link>
          <Link href="/app">{t("Sign in")}</Link>
        </nav>
      </header>

      <main className="doc">
        <span className="kicker">{t("Legal")}</span>
        <h1>{title}</h1>
        <p className="updated">{t("Last updated {date}", { date: shown })}</p>
        <p className="lede">{lede}</p>
        {children}
        <div className="cta">
          <Link className="btn" href="/app?trial=1">{t("Try it free")}</Link>
          <Link href="/">{t("Back to the homepage")}</Link>
        </div>
      </main>

      <footer className="foot">
        <span translate="no">The Personal Finance Dashboard by YourFinanceAcademy.com · © 2026 Your Finance Academy (YFA)</span>
        <span className="foot__links">
          <Link href="/terms">{t("Terms")}</Link>
          <Link href="/privacy">{t("Privacy")}</Link>
        </span>
        <span className="foot__legal" translate="no">Your Finance Academy · KvK 42222252 · Molenstraat 29, 5461 JP Veghel, Nederland</span>
      </footer>
    </div>
  );
}
