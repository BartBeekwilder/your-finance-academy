"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { intlLocale, LANGUAGES, setLang, t as translate, useLang, type Lang } from "@/lib/i18n";

// Same look as the homepage (public/home): its dark canvas, Geist and Geist
// Mono, the status bar with the brand lockup, the mono footer.
const CSS = `
.pp { --c-canvas: oklch(14% 0.018 210); --c-surface: oklch(18.5% 0.022 205); --c-surface-2: oklch(23% 0.025 205);
  --c-ink: oklch(94% 0.012 85); --c-ink-2: oklch(82% 0.012 85); --c-muted: oklch(66% 0.018 200); --c-rule: oklch(30% 0.025 205);
  --c-accent: oklch(80% 0.16 75); --f: "Geist", system-ui, sans-serif; --mono: "Geist Mono", ui-monospace, monospace; --g: clamp(16px, 2.6vw, 40px);
  min-height: 100dvh; display: flex; flex-direction: column; background: var(--c-canvas); color: var(--c-ink); font: 400 16px/1.6 var(--f); -webkit-font-smoothing: antialiased; }
.pp a { color: inherit; }
.pp-bar { position: sticky; top: 0; z-index: 10; height: 48px; display: flex; align-items: center; gap: 16px; padding: 0 var(--g); background: color-mix(in oklch, var(--c-canvas) 88%, transparent); border-bottom: 1px solid var(--c-rule); backdrop-filter: blur(12px); }
.pp-brand { display: grid; line-height: 1.1; text-decoration: none; }
.pp-brand b { font-weight: 700; font-size: 14px; letter-spacing: -0.01em; }
.pp-brand small { font: 400 10.5px var(--mono); color: var(--c-muted); white-space: nowrap; }
.pp-bar nav { margin-inline-start: auto; display: flex; align-items: center; gap: 14px; }
.pp-lang { appearance: none; border: 0; border-radius: 999px; padding: 5px 12px; background: var(--c-surface-2); color: var(--c-ink-2); font: 400 13px var(--f); }
.pp-back { display: inline-flex; align-items: center; height: 32px; padding: 0 14px; border-radius: 4px; background: var(--c-accent); color: oklch(15% 0.02 200) !important; font-weight: 500; font-size: 14px; text-decoration: none; white-space: nowrap; }
.pp-main { flex: 1; width: 100%; max-width: 760px; margin: 0 auto; padding: clamp(56px, 10vh, 110px) var(--g) 80px; }
.pp-eyebrow { font: 500 12px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-accent); }
.pp-main h1 { margin: 14px 0 10px; font: 700 clamp(36px, 5vw, 60px)/1.02 var(--f); letter-spacing: -0.035em; text-wrap: balance; }
.pp-date { margin: 0 0 48px; font: 400 12px var(--mono); color: var(--c-muted); }
.pp-sec { padding: 26px 0; border-top: 1px solid var(--c-rule); display: grid; gap: 10px; }
.pp-sec h2 { margin: 0; font: 600 20px/1.25 var(--f); letter-spacing: -0.015em; }
.pp-sec p { margin: 0; color: var(--c-ink-2); max-width: 64ch; }
.pp-sec strong { color: var(--c-ink); font-weight: 600; }
.pp-mail { font: 400 15px var(--mono); color: var(--c-accent); user-select: all; }
.pp-foot { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding: 28px var(--g); border-top: 1px solid var(--c-rule); font: 400 12px var(--mono); color: var(--c-muted); }
@media (max-width: 520px) { .pp-brand small { display: none; } .pp-back { padding: 0 10px; } }
`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pp-sec">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const UPDATED = new Date(2026, 10, 13);

const english = (text: string, vars?: Record<string, string | number>) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text);
const noop = () => () => {};

export default function PrivacyBody() {
  const lang = useLang();
  // The server renders English; the first browser render matches it, then
  // switches to the visitor's language (no hydration mismatch).
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const t = hydrated ? translate : english;
  return (
    <div className="pp" lang={hydrated ? lang : "en"}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- this page only, like the homepage */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
      <style>{CSS}</style>
      <header className="pp-bar">
        <Link href="/" className="pp-brand" translate="no"><b>Personal Finance</b><small>by YourFinanceAcademy.com</small></Link>
        <nav>
          <select className="pp-lang" aria-label={t("Language")} value={hydrated ? lang : "en"} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <Link href="/app" className="pp-back">{t("Back to the app")}</Link>
        </nav>
      </header>

      <main className="pp-main">
        <span className="pp-eyebrow">{t("Test version")}</span>
        <h1>{t("Privacy in the web app")}</h1>
        <p className="pp-date">{t("Last updated {date}", { date: UPDATED.toLocaleDateString(hydrated ? intlLocale() : "en-GB", { day: "numeric", month: "long", year: "numeric" }) })}</p>

        <Section title={t("The short version")}>
          <p>{t("You're testing an early version of the Personal Finance web app. To keep your books on every device, what you enter is saved in your account. Only you can open it from the app, and if you add a passphrase, nobody else can read it at all, including us.")}</p>
        </Section>
        <Section title={t("What is stored")}>
          <p>{t("Your email address and sign-in details, and the figures you enter: accounts and balances, income and expenses, categories and budgets, investments, loans, your home and mortgage, insurance policies, goals, check-ins and progress. Feedback you send from the app is stored with your account, the page you were on and your screen size.")}</p>
        </Section>
        <Section title={t("Where it is stored")}>
          <p>{t("With Supabase, in a data centre in the European Union (Ireland). Each account can only read its own data; that is enforced by the database itself (row-level security).")}</p>
        </Section>
        <Section title={t("Who can read it")}>
          <p><strong>{t("Without a passphrase")}</strong> {t("(the default): your data is kept as it is in your account. You can read it after signing in, and so can the people who run this test (the administrator of the database). We don't look at your figures, but technically we could.")}</p>
          <p><strong>{t("With a passphrase")}</strong> {t("(Settings › Extra protection): everything is encrypted in your browser before it is saved (AES-256). Only someone with your passphrase can read it: not us, not the database. A forgotten passphrase can't be recovered, so keep it in a password manager.")}</p>
        </Section>
        <Section title={t("Market prices and search")}>
          <p>{t("Live prices and the investment search ask a public price service (Yahoo Finance) for a ticker or the text you typed, via our server and never with your name, amounts or holdings. Company logos are loaded by ticker from Financial Modeling Prep.")}</p>
        </Section>
        <Section title={t("Reading documents with AI")}>
          <p>{t("With Premium you can let the app read a bank screenshot, a payslip or a mortgage document. Only when you choose to, and after you've agreed once: the image or PDF is sent via our server to Claude, the AI of Anthropic, together with the names of your categories (so one can be suggested). Nothing else from your books goes with it.")}</p>
          <p>{t("The figures come back to your screen for you to check; nothing is booked until you add it. We don't keep the file. Anthropic processes it under its commercial terms: it isn't used to train its AI and is deleted after a short retention period.")}</p>
        </Section>
        <Section title={t("Payments")}>
          <p>{t("Premium is paid through Stripe; we never see your card details. To know on every device that you have Premium, your subscription is linked to your account at RevenueCat by an anonymous account number.")}</p>
        </Section>
        <Section title={t("Cookies and tracking")}>
          <p>{t("No ads, no analytics, no tracking. The browser keeps your sign-in and a few settings (language, animations, a setup in progress) on your own device.")}</p>
        </Section>
        <Section title={t("Removing your data")}>
          <p>{t("To remove your data or your whole account, send a message with Feedback in the app or email us; we delete the account and everything in it.")}</p>
        </Section>
        <Section title={t("Contact")}>
          <p>{t("Questions:")} <span className="pp-mail">privacy@yourfinanceacademy.com</span></p>
        </Section>
      </main>

      <footer className="pp-foot"><span translate="no">The Personal Finance Dashboard by YourFinanceAcademy.com · © 2026 Your Finance Academy (YFA)</span><Link href="/">yourfinanceacademy.com</Link></footer>
    </div>
  );
}
