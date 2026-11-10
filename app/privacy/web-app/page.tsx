import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy — Personal Finance web app (test version)",
  description: "What the Personal Finance web app stores while it's being tested, where, and who can see it.",
};

// For testers of the web app (/app). The site's main privacy page
// (/privacy) describes the iOS app without accounts.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>{title}</h2>
      <div className="space-y-3" style={{ color: "var(--ink-soft)" }}>{children}</div>
    </section>
  );
}

export default function WebAppPrivacy() {
  return (
    <>
      <nav className="flex items-center justify-between border-b px-[clamp(1.25rem,4vw,3rem)] py-6" style={{ borderColor: "var(--line)" }}>
        <Link href="/" className="text-[1.1rem] font-medium" style={{ fontFamily: "var(--font-display)" }}>
          Your <em style={{ color: "var(--accent)" }}>Finance</em> Academy
        </Link>
        <Link href="/app" className="eyebrow" style={{ color: "var(--ink-soft)" }}>Back to the app</Link>
      </nav>

      <div className="mx-auto max-w-[42rem] px-[clamp(1.25rem,4vw,3rem)] py-[clamp(3rem,7vw,5rem)]">
        <p className="eyebrow mb-3">Test version</p>
        <h1 className="mb-2 text-[clamp(2rem,4vw,2.6rem)] font-normal" style={{ fontWeight: 400 }}>Privacy in the web app</h1>
        <p className="mb-10 text-sm" style={{ color: "var(--ink-soft)" }}>Last updated November 10, 2026</p>

        <div className="space-y-8 text-[1.02rem] leading-relaxed" style={{ color: "var(--ink)" }}>
          <Section title="The short version">
            <p>
              You&apos;re testing an early version of the Personal Finance web app. To keep your books on every device,
              what you enter is saved in your account. Only you can open it from the app — and if you add a passphrase,
              nobody else can read it at all, including us.
            </p>
          </Section>

          <Section title="What is stored">
            <p>
              Your email address and sign-in details, and the figures you enter: accounts and balances, income and
              expenses, categories and budgets, investments, loans, your home and mortgage, insurance policies, goals,
              check-ins and progress. Feedback you send from the app is stored with your account, the page you were on
              and your screen size.
            </p>
          </Section>

          <Section title="Where it is stored">
            <p>
              With Supabase, in a data centre in the European Union (Ireland). Each account can only read its own data;
              that is enforced by the database itself (row-level security).
            </p>
          </Section>

          <Section title="Who can read it">
            <p>
              <strong>Without a passphrase</strong> (the default): your data is kept as it is in your account. You can read
              it after signing in, and so can the people who run this test (the administrator of the database) — we
              don&apos;t look at your figures, but technically we could.
            </p>
            <p>
              <strong>With a passphrase</strong> (Settings › Extra protection): everything is encrypted in your browser before
              it is saved (AES-256). Only someone with your passphrase can read it — not us, not the database. A forgotten
              passphrase can&apos;t be recovered, so keep it in a password manager.
            </p>
          </Section>

          <Section title="Market prices and search">
            <p>
              Live prices and the investment search ask a public price service (Yahoo Finance) for a ticker or the text
              you typed — via our server, never with your name, amounts or holdings. Company logos are loaded by ticker
              from Financial Modeling Prep.
            </p>
          </Section>

          <Section title="Reading documents with AI">
            <p>
              With Premium you can let the app read a bank screenshot, a payslip or a mortgage document. Only when you
              choose to, and after you&apos;ve agreed once: the image or PDF is sent via our server to Claude, the AI of
              Anthropic, together with the names of your categories (so one can be suggested). Nothing else from your
              books goes with it.
            </p>
            <p>
              The figures come back to your screen for you to check; nothing is booked until you add it. We don&apos;t keep the
              file. Anthropic processes it under its commercial terms: it isn&apos;t used to train its AI and is deleted
              after a short retention period.
            </p>
          </Section>

          <Section title="Payments">
            <p>
              Premium is paid through Stripe; we never see your card details. To know on every device that you have Premium,
              your subscription is linked to your account at RevenueCat by an anonymous account number.
            </p>
          </Section>

          <Section title="Cookies and tracking">
            <p>
              No ads, no analytics, no tracking. The browser keeps your sign-in and a few settings (language, animations,
              a setup in progress) on your own device.
            </p>
          </Section>

          <Section title="Removing your data">
            <p>
              To remove your data or your whole account, send a message with Feedback in the app or email us; we
              delete the account and everything in it.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions: <span className="data">privacy@yourfinanceacademy.com</span>.
            </p>
          </Section>
        </div>
      </div>
    </>
  );
}
