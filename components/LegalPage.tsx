import Link from "next/link";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";

// The legal pages (/privacy, /terms) in the live site's look: the homepage's
// dark canvas, Geist and Geist Mono, its top bar and footer, mono section
// labels and the gold accent — like /updates. English for now.

const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono" });

const CSS = `
  .pp { --c-canvas: oklch(14% 0.018 210); --c-surface: oklch(18.5% 0.022 205); --c-ink: oklch(94% 0.012 85); --c-ink-2: oklch(82% 0.012 85); --c-muted: oklch(66% 0.018 200); --c-rule: oklch(30% 0.025 205); --c-accent: oklch(80% 0.16 75); --c-live: #30d158; --c-accent-ink: oklch(15% 0.02 200); --f: var(--font-geist), "Geist", system-ui, sans-serif; --mono: var(--font-geist-mono), "Geist Mono", ui-monospace, monospace; --g: clamp(16px, 2.6vw, 40px); }
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
  .pp .btn { display: inline-flex; align-items: center; height: 34px; padding: 0 14px; border-radius: 4px; background: var(--c-accent); color: var(--c-accent-ink) !important; font-weight: 500; text-decoration: none; font-size: 14px; }
  .pp .doc { max-width: 760px; margin: 0 auto; padding: calc(48px + clamp(40px, 8vw, 96px)) var(--g) 72px; }
  .pp .kicker { font: 500 12px var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--c-accent); }
  .pp h1 { font-family: var(--f); margin: 10px 0 12px; font-size: clamp(36px, 6vw, 60px); line-height: 1.02; letter-spacing: -0.03em; font-weight: 700; }
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
  .pp .foot { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding: 28px var(--g); border-block-start: 1px solid var(--c-rule); font: 400 12px var(--mono); color: var(--c-muted); }
  .pp .foot a { color: var(--c-muted); }
  .pp .foot__links { display: flex; gap: 16px; }
  .pp .foot__legal { flex-basis: 100%; font-size: 11px; opacity: .6; }
  @media (max-width: 640px) { .pp .status nav a.hide-sm { display: none; } }
`;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function LegalPage({ title, updated, lede, children }: { title: string; updated: string; lede: ReactNode; children: ReactNode }) {
  return (
    <div className={`pp ${geist.variable} ${geistMono.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="status">
        <Link className="brand" href="/" translate="no">
          <b>Personal Finance</b>
          <small>by YourFinanceAcademy.com</small>
        </Link>
        <nav aria-label="Main">
          <Link className="hide-sm" href="/#functies">Features</Link>
          <Link className="hide-sm" href="/updates">Updates</Link>
          <Link href="/app">Sign in</Link>
        </nav>
      </header>

      <main className="doc">
        <span className="kicker">Legal</span>
        <h1>{title}</h1>
        <p className="updated">Last updated {updated}</p>
        <p className="lede">{lede}</p>
        {children}
        <div className="cta">
          <Link className="btn" href="/app?trial=1">Try it free</Link>
          <Link href="/">Back to the homepage</Link>
        </div>
      </main>

      <footer className="foot">
        <span translate="no">The Personal Finance Dashboard by YourFinanceAcademy.com · © 2026 Your Finance Academy (YFA)</span>
        <span className="foot__links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/privacy/web-app">Web app privacy</Link>
        </span>
        <span className="foot__legal" translate="no">Your Finance Academy · KvK 42222252 · Molenstraat 29, 5461 JP Veghel, Nederland</span>
      </footer>
    </div>
  );
}
