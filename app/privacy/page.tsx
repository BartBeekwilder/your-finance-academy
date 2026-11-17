import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";

// The live site's fonts (the homepage loads them from Google Fonts).
const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Privacy Policy · Personal Finance",
  description: "How Your Finance Academy and the Personal Finance website, iPhone, iPad, Mac and Android apps handle your data.",
};

// Privacy policy for the whole service: the website and web app, and the
// apps that sync with the same account. Drafted from how the service works
// on 17 November 2026 — to be checked before it's relied on. Written in the
// same look as the live homepage and /updates (dark canvas, Geist, mono
// labels, gold accent); translations come later with the rest of the site.

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
  .pp h1 { margin: 10px 0 12px; font-size: clamp(36px, 6vw, 60px); line-height: 1.02; letter-spacing: -0.03em; font-weight: 700; }
  .pp .updated { margin: 0 0 40px; font: 400 13px var(--mono); color: var(--c-muted); }
  .pp .lede { margin: 0 0 40px; color: var(--c-ink-2); font-size: 18px; max-width: 54ch; }
  .pp section { padding: 26px 0; border-block-start: 1px solid var(--c-rule); }
  .pp h2 { margin: 0 0 12px; font: 500 13px/1.4 var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--c-muted); }
  .pp section p { margin: 0 0 14px; color: var(--c-ink-2); }
  .pp section p:last-child { margin-bottom: 0; }
  .pp strong { color: var(--c-ink); font-weight: 600; }
  .pp .mono { font-family: var(--mono); font-size: 14px; color: var(--c-ink); }
  .pp .cta { margin-top: 40px; display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .pp .cta a:not(.btn) { color: var(--c-ink-2); }
  .pp .foot { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding: 28px var(--g); border-block-start: 1px solid var(--c-rule); font: 400 12px var(--mono); color: var(--c-muted); }
  .pp .foot a { color: var(--c-muted); }
  @media (max-width: 640px) { .pp .status nav a.hide-sm { display: none; } }
`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function Privacy() {
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
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated November 17, 2026</p>
        <p className="lede">
          Your books sit in one account, so the website, your iPhone, iPad, Mac and Android phone show the same figures.
          The data is stored in the European Union. You can add a passphrase that only you know; then nobody else can read
          it, including us. We don&apos;t sell data, and we don&apos;t use advertising or tracking.
        </p>

        <Section title="Who is responsible">
          <p>
            Your Finance Academy (Personal Finance) is run by Bart Beekwilder in the Netherlands. Questions and requests
            about this policy: <span className="mono">privacy@yourfinanceacademy.com</span>.
          </p>
        </Section>

        <Section title="What we store">
          <p>
            <strong>Your account:</strong> your email address and a password, stored in hashed form by our sign-in provider.
            We never see the password itself.
          </p>
          <p>
            <strong>Your books:</strong> accounts and balances, income and expenses, categories and budgets, fixed costs and
            subscriptions, loans, your home and mortgage, insurance policies, investments you enter, goals, check-ins and
            progress, and settings such as currency, country and household names. This is what you enter, and it is what
            lets the apps and the website show the same figures.
          </p>
          <p>
            <strong>Feedback</strong> you send from the app, with the page you were on and your screen size.
          </p>
          <p>
            <strong>Technical data:</strong> the usual connection logs of our hosting provider (such as your IP address and
            browser type), kept to run and secure the service.
          </p>
        </Section>

        <Section title="Encryption and who can read your data">
          <p>
            <strong>Without a passphrase</strong> (the default): your books are stored in your account. You can read them
            after signing in. The people who run the service can technically read them too, because we manage the database;
            we don&apos;t look at them.
          </p>
          <p>
            <strong>With a passphrase</strong> (Settings › Extra protection): your books are encrypted on your device before
            they are sent, with AES-256. Only someone with your passphrase can read them. We cannot recover a forgotten
            passphrase, so keep it in a password manager.
          </p>
          <p>
            Your data is kept on the same account on every device. The apps keep a copy on the device so they work offline,
            and sync when they are online.
          </p>
        </Section>

        <Section title="Where it is stored and who processes it">
          <p>
            <strong>Supabase</strong> (database and sign-in) in the European Union (Ireland). Each account can only read its
            own data; the database enforces this.
          </p>
          <p>
            <strong>Vercel</strong> hosts the website and serves the app; it processes connection logs.
          </p>
          <p>
            <strong>Resend</strong> sends the sign-in and confirmation emails. <strong>Cloudflare</strong> handles the domain
            and forwards mail sent to our privacy address.
          </p>
        </Section>

        <Section title="Live market prices and search">
          <p>
            For live share, fund, crypto and metal prices, and to search for an investment, our server asks a public price
            service (Yahoo Finance). These requests contain only the ticker or the search text you typed, never your name,
            amounts or holdings. Company logos are loaded by ticker from Financial Modeling Prep.
          </p>
        </Section>

        <Section title="Reading documents with AI (Premium)">
          <p>
            With Read with AI you can add bank screenshots, payslips or mortgage documents, which are read to fill in your
            books. You give consent the first time you use it. The files are sent to Anthropic, which processes them to return
            the figures. We don&apos;t keep the files; we only keep the time of each read, to enforce the daily limit. You
            check every row before anything is booked.
          </p>
        </Section>

        <Section title="Payments and subscriptions">
          <p>
            Premium is paid through <strong>Stripe</strong> on the web, or through the App Store and Google Play in the apps.
            Stripe processes your payment details; we never see your card number. Whether you have Premium is checked with{" "}
            <strong>RevenueCat</strong>, which connects the store and web subscriptions. We keep the subscription status, not
            your card details.
          </p>
        </Section>

        <Section title="Apps and sign-in">
          <p>
            The iPhone, iPad, Mac and Android apps use the same account. Signing in with Apple, where it is offered, gives us
            only your email address (or the private relay address Apple provides). The apps store your books on the device, so
            you can use them offline.
          </p>
        </Section>

        <Section title="Cookies and tracking">
          <p>
            We use no advertising, tracking or analytics cookies. The website and apps store what keeps you signed in, and
            your settings such as language and animations, on your own device.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep your account and books for as long as you use the service. When you ask us to delete your account, we
            delete it together with everything in it. Copies that sit in backups disappear when those backups expire.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask us what we hold about you, to correct it, to have it deleted, or to receive it in a common format, and
            you can object to processing. Send your request to <span className="mono">privacy@yourfinanceacademy.com</span>.
            If you are not satisfied with our answer, you can complain to the Dutch Data Protection Authority (Autoriteit
            Persoonsgegevens).
          </p>
        </Section>

        <Section title="Children">
          <p>
            The service is not meant for children under 16. We don&apos;t knowingly collect data from them; if you think we
            have, tell us and we will delete it.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If something changes here, for example a new service that handles data, this page is updated first, and the change
            is described plainly at the top of the page.
          </p>
        </Section>

        <div className="cta">
          <Link className="btn" href="/app?trial=1">Try it free</Link>
          <Link href="/">Back to the homepage</Link>
        </div>
      </main>

      <footer className="foot">
        <span translate="no">The Personal Finance Dashboard by YourFinanceAcademy.com · © 2026 Your Finance Academy (YFA)</span>
        <Link href="/privacy/web-app">Web app privacy</Link>
      </footer>
    </div>
  );
}
