import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Your Finance Academy",
  description: "How Your Finance Academy and its companion iOS app handle your data.",
};

export default function Privacy() {
  return (
    <>
      <nav
        className="flex items-center justify-between border-b px-[clamp(1.25rem,4vw,3rem)] py-6"
        style={{ borderColor: "var(--line)" }}
      >
        <Link
          href="/"
          className="text-[1.1rem] font-medium"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Your <em style={{ color: "var(--accent)" }}>Finance</em> Academy
        </Link>
        <Link href="/" className="eyebrow" style={{ color: "var(--ink-soft)" }}>
          Back home
        </Link>
      </nav>

      <div className="mx-auto max-w-[42rem] px-[clamp(1.25rem,4vw,3rem)] py-[clamp(3rem,7vw,5rem)]">
        <p className="eyebrow mb-3">Legal</p>
        <h1
          className="mb-2 text-[clamp(2rem,4vw,2.6rem)] font-normal"
          style={{ fontWeight: 400 }}
        >
          Privacy Policy
        </h1>
        <p className="mb-10 text-sm" style={{ color: "var(--ink-soft)" }}>
          Last updated August 23, 2026
        </p>

        <div className="space-y-8 text-[1.02rem] leading-relaxed" style={{ color: "var(--ink)" }}>
          <section>
            <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>
              The short version
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              The Your Finance Academy app doesn&apos;t collect, store, or transmit your
              financial data anywhere. Everything you enter — transactions, accounts, budgets,
              income, investments — stays on your device. There are no accounts, no login, and
              no servers of ours in the loop.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>
              What the app stores, and where
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              All data you enter — transactions, accounts, categories, budgets, income records,
              and investment holdings — is stored locally on your device only. We have no
              backend, no database, and no way to see it. If you delete the app, that data is
              gone; we can&apos;t recover it because we never had it.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>
              Market prices
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              To show live prices for stocks, crypto, and metals, the app requests public price
              data from third-party providers. These requests ask for a price by symbol only —
              they don&apos;t include your name, your holdings, or any other personal or
              financial information.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>
              Receipt scanning
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              Scanning a receipt is handled entirely on your device using Apple&apos;s built-in
              on-device recognition. Photos of receipts and the text read from them are never
              uploaded anywhere.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>
              This website
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              yourfinanceacademy.com doesn&apos;t use cookies, analytics, or ad tracking. Our
              hosting provider processes standard connection logs (like IP address and browser
              type) to keep the site running and secure; we don&apos;t access these for
              tracking purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>
              Children
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              The app isn&apos;t directed at children under 13, and we don&apos;t knowingly
              collect information from them — consistent with storing no personal data from
              anyone, of any age.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>
              Changes to this policy
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              If this ever changes — for example, if we introduce optional cloud sync in the
              future — this page will be updated first, and the change will be described
              plainly, not buried.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 500 }}>
              Contact
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              Questions about this policy can be sent to{" "}
              <span className="data">privacy@yourfinanceacademy.com</span>.
            </p>
          </section>
        </div>
      </div>

      <footer
        className="border-t px-[clamp(1.25rem,4vw,3rem)] py-10 text-center"
        style={{ borderColor: "var(--line)" }}
      >
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
