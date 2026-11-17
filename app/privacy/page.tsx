import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy — Your Finance Academy",
  description: "How Your Finance Academy and the Personal Finance website, iPhone, iPad, Mac and Android apps handle your data.",
};

// Privacy policy for the whole service: the website and web app, and the
// apps that sync with the same account. Draft written from how the service
// works on 17 November 2026 — to be checked before it's relied on.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>
        {title}
      </h2>
      <div className="space-y-3" style={{ color: "var(--ink-soft)" }}>
        {children}
      </div>
    </section>
  );
}

export default function Privacy() {
  return (
    <>
      <nav
        className="flex items-center justify-between border-b px-[clamp(1.25rem,4vw,3rem)] py-6"
        style={{ borderColor: "var(--line)" }}
      >
        <Link href="/" className="text-[1.1rem] font-medium" style={{ fontFamily: "var(--font-display)" }}>
          Your <em style={{ color: "var(--accent)" }}>Finance</em> Academy
        </Link>
        <Link href="/" className="eyebrow" style={{ color: "var(--ink-soft)" }}>
          Back home
        </Link>
      </nav>

      <div className="mx-auto max-w-[42rem] px-[clamp(1.25rem,4vw,3rem)] py-[clamp(3rem,7vw,5rem)]">
        <p className="eyebrow mb-3">Legal</p>
        <h1 className="mb-2 text-[clamp(2rem,4vw,2.6rem)] font-normal" style={{ fontWeight: 400 }}>
          Privacy Policy
        </h1>
        <p className="mb-10 text-sm" style={{ color: "var(--ink-soft)" }}>
          Last updated November 17, 2026
        </p>

        <div className="space-y-8 text-[1.02rem] leading-relaxed" style={{ color: "var(--ink)" }}>
          <Section title="The short version">
            <p>
              Personal Finance keeps your books in your account, so the same figures show on the website, your iPhone,
              iPad, Mac and Android phone. Your data is stored in the European Union. You can protect it further with a
              passphrase that only you know; then nobody else can read it, including us. We don&apos;t sell data, and we
              don&apos;t use advertising or tracking.
            </p>
          </Section>

          <Section title="Who is responsible">
            <p>
              Your Finance Academy (Personal Finance) is run by Bart Beekwilder in the Netherlands. Questions and
              requests about this policy: <span className="data">privacy@yourfinanceacademy.com</span>.
            </p>
          </Section>

          <Section title="What we store">
            <p>
              <strong>Your account:</strong> your email address and a password, stored in hashed form by our sign-in
              provider. We never see the password itself.
            </p>
            <p>
              <strong>Your books:</strong> accounts and balances, income and expenses, categories and budgets, fixed
              costs and subscriptions, loans, your home and mortgage, insurance policies, investments you enter, goals,
              check-ins and progress, and settings such as currency, country and household names. This is what you enter,
              and it is the reason the apps and the website can show the same figures.
            </p>
            <p>
              <strong>Feedback</strong> you send from the app, with the page you were on and your screen size.
            </p>
            <p>
              <strong>Technical data:</strong> the usual connection logs of our hosting provider (such as your IP address
              and browser type), kept to run and secure the service.
            </p>
          </Section>

          <Section title="Encryption and who can read your data">
            <p>
              <strong>Without a passphrase</strong> (the default): your books are stored in your account. You can read
              them after signing in. The people who run the service can technically read them too, because the database
              is managed by us; we don&apos;t look at them.
            </p>
            <p>
              <strong>With a passphrase</strong> (Settings › Extra protection): your books are encrypted on your device
              before they are sent, with AES-256. Only someone with your passphrase can read them. We cannot recover a
              forgotten passphrase, so keep it in a password manager.
            </p>
            <p>
              Your data is kept on the same account on every device; the apps keep a copy on the device so they work
              offline and sync when they are online.
            </p>
          </Section>

          <Section title="Where it is stored and who processes it">
            <p>
              <strong>Supabase</strong> (database and sign-in) in the European Union (Ireland). Each account can only
              read its own data; the database enforces this.
            </p>
            <p>
              <strong>Vercel</strong> hosts the website and serves the app; it processes connection logs.
            </p>
            <p>
              <strong>Resend</strong> sends the sign-in and confirmation emails; <strong>Cloudflare</strong> handles the
              domain and forwards mail sent to our privacy address.
            </p>
          </Section>

          <Section title="Live market prices and search">
            <p>
              For live share, fund, crypto and metal prices, and to search for an investment, our server asks a public
              price service (Yahoo Finance). These requests contain only the ticker or the search text you typed, never
              your name, amounts or holdings. Company logos are loaded by ticker from Financial Modeling Prep.
            </p>
          </Section>

          <Section title="Reading documents with AI (Premium)">
            <p>
              With Read with AI you can add bank screenshots, payslips or mortgage documents, which are read to fill in
              your books. You give consent the first time you use it. The files are sent to Anthropic, which processes
              them to return the figures. We don&apos;t keep the files; we only keep the time of each read, to enforce
              the daily limit. You check every row before anything is booked.
            </p>
          </Section>

          <Section title="Payments and subscriptions">
            <p>
              Premium is paid through <strong>Stripe</strong> (on the web) or through the App Store and Google Play (in
              the apps). Stripe processes your payment details; we never see your card number. Whether you have Premium
              is checked with <strong>RevenueCat</strong>, which connects the store and web subscriptions. We keep the
              subscription status and your invoices&apos; reference, not your card details.
            </p>
          </Section>

          <Section title="Apps and sign-in">
            <p>
              The iPhone, iPad, Mac and Android apps use the same account. Signing in with Apple, where it is offered,
              gives us only your email address (or a private relay address that Apple provides). The apps store your
              books on the device, so you can use them offline.
            </p>
          </Section>

          <Section title="Cookies and tracking">
            <p>
              We use no advertising, tracking or analytics cookies. The website and apps store what keeps you signed in
              and your settings (such as language and animations) on your own device.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              We keep your account and books for as long as you use the service. When you ask us to delete your account,
              we delete it together with everything in it. Copies that sit in backups disappear when those backups expire.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can ask us what we hold about you, to correct it, to have it deleted, or to receive it in a common
              format, and you can object to processing. Send your request to{" "}
              <span className="data">privacy@yourfinanceacademy.com</span>. If you are not satisfied with our answer,
              you can complain to the Dutch Data Protection Authority (Autoriteit Persoonsgegevens).
            </p>
          </Section>

          <Section title="Children">
            <p>
              The service is not meant for children under 16. We don&apos;t knowingly collect data from them; if you think
              we have, tell us and we will delete it.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              If something changes here — for example a new service that handles data — this page is updated first, and
              the change is described plainly at the top of the page.
            </p>
          </Section>
        </div>
      </div>

      <footer className="border-t px-[clamp(1.25rem,4vw,3rem)] py-10 text-center" style={{ borderColor: "var(--line)" }}>
        <div className="text-[1.1rem] font-medium" style={{ fontFamily: "var(--font-display)" }}>
          Your <em style={{ color: "var(--accent)" }}>Finance</em> Academy
        </div>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: "var(--ink-soft)" }}>
          Money, taught plainly. No jargon, no upsells — just the courses you actually need.
        </p>
      </footer>
    </>
  );
}
