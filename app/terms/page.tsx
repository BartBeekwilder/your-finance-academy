import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service · Personal Finance",
  description: "The terms for using Personal Finance and its Premium subscription: trial, renewal, cancelling, refunds and liability.",
};

// Terms of service for Personal Finance (website, web app and apps) and
// Premium. Drafted on 17 November 2026 from how the service works (7-day
// trial with a card on file, monthly / yearly / 2-year plans, Stripe on the
// web, App Store / Google Play in the apps) — to be checked before it's
// relied on. English for now.
//
// Business details: fill these in (KvK number and the address registered
// with it). The sentence that names them only shows once they're set.
const BUSINESS = {
  name: "Your Finance Academy",
  owner: "Bart Beekwilder",
  kvk: "",
  address: "",
  email: "privacy@yourfinanceacademy.com",
};

export default function Terms() {
  const registered = [BUSINESS.kvk && `Chamber of Commerce (KvK) number ${BUSINESS.kvk}`, BUSINESS.address].filter(Boolean).join(", ");
  return (
    <LegalPage
      title="Terms of Service"
      updated="November 17, 2026"
      lede={
        <>
          These terms apply when you use Personal Finance — the website, the web app and the iPhone, iPad, Mac and Android
          apps — and when you take out Premium. In short: it&apos;s a tool for keeping your own books, not financial advice;
          you can cancel any time; and a trial only turns into a payment if you don&apos;t cancel before it ends.
        </>
      }
    >
      <Section title="Who we are">
        <p>
          Personal Finance is offered by {BUSINESS.name}, a sole proprietorship run by {BUSINESS.owner} in the Netherlands
          {registered ? ` (${registered})` : ""}. You can reach us at <span className="mono">{BUSINESS.email}</span>.
        </p>
      </Section>

      <Section title="What Personal Finance is — and isn't">
        <p>
          Personal Finance is software that helps you keep track of your own money: income and spending, budgets, accounts,
          loans, your home, investments and the figures that follow from them.
        </p>
        <p>
          <strong>It is not financial, tax, legal or investment advice.</strong> The figures, forecasts and key figures are
          calculations based on what you enter and on public data such as market prices, which can be delayed or wrong.
          Documents read with AI can be misread, which is why you check every row before it is booked. Decisions you make
          with the help of the app are your own.
        </p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>You need to be 16 or older to create an account.</li>
          <li>An account is for one person (or one household sharing its books). Keep your sign-in details to yourself.</li>
          <li>
            If you add a passphrase (Settings › Extra protection), we cannot recover it. Without it, nobody — including us —
            can open your encrypted data.
          </li>
          <li>Give a correct email address: we use it to sign you in and to tell you about your subscription.</li>
        </ul>
      </Section>

      <Section title="Free and Premium">
        <p>
          You can use Personal Finance for free. Premium adds features such as reading documents with AI. What is included
          in each is shown in the app and on the website; we may improve or change features over time.
        </p>
        <p>
          Premium is available as a monthly, yearly or 2-year subscription. Prices are shown before you pay and include VAT.
        </p>
      </Section>

      <Section title="Free trial">
        <p>
          New Premium subscribers get a <strong>7-day free trial</strong>. You add a payment method when the trial starts.
          If you don&apos;t cancel before the trial ends, the subscription starts and the first period is charged. You
          will see the date and the amount before you start. One trial per person.
        </p>
      </Section>

      <Section title="Payment, renewal and cancelling">
        <ul>
          <li>
            <strong>On the website</strong>, payments are handled by Stripe. At checkout you may see that the purchase is
            made through Link, Stripe&apos;s checkout service; Stripe&apos;s terms apply to the payment itself.
          </li>
          <li>
            <strong>In the apps</strong>, Premium is bought through the App Store or Google Play, and their terms apply to
            the payment, renewal and refunds.
          </li>
          <li>A subscription renews automatically at the end of each period, for the same length and price, until you cancel.</li>
          <li>
            You can cancel any time: on the web in Settings › Manage subscription, in the apps through your App Store or
            Google Play subscriptions. Premium stays active until the end of the period you have paid for.
          </li>
          <li>Switching plans takes effect as shown at the moment you switch.</li>
        </ul>
      </Section>

      <Section title="Right of withdrawal and refunds">
        <p>
          If you live in the EU, you may withdraw from a Premium subscription bought on the website within 14 days after
          the first payment, without giving a reason. Email us or cancel in Settings and ask for a refund within that time;
          we refund what you paid, minus a fair amount for the days you already had Premium after the trial. The 7-day trial
          itself is free.
        </p>
        <p>
          After those 14 days, payments for a period that has started are not refunded, except where the law says
          otherwise. Purchases in the App Store or Google Play are refunded by Apple or Google under their rules.
        </p>
      </Section>

      <Section title="Price changes">
        <p>
          We may change Premium&apos;s prices. A new price never applies to a period you have already paid for. We tell you
          at least 30 days before a new price applies to your subscription, and you can cancel before it does.
        </p>
      </Section>

      <Section title="Your data">
        <p>
          The figures you enter are yours. How we store and protect them is described in the{" "}
          <Link href="/privacy">Privacy Policy</Link>. You can ask us to delete your account and everything in it.
        </p>
      </Section>

      <Section title="Fair use">
        <p>
          Use the service for your own finances and in a normal way. Don&apos;t try to break, overload or get around its
          limits (such as the number of AI reads per day), don&apos;t access other people&apos;s data, and don&apos;t use
          it for anything unlawful. We may suspend an account that does.
        </p>
      </Section>

      <Section title="Availability and changes">
        <p>
          We do our best to keep Personal Finance available and your data safe, but we can&apos;t promise it will never be
          interrupted. We may change or stop features; if we stop Premium altogether, we refund the unused part of what you
          paid.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          We are not liable for decisions you make based on the app, or for damage caused by figures that are wrong because
          of what was entered, read or received from others. Our total liability to you is limited to what you paid us in
          the 12 months before the event. None of this limits liability that the law does not allow to be limited, such as
          for intent or gross negligence, or your rights as a consumer.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these terms. For changes that affect you, we tell you in advance; if you don&apos;t agree, you can
          cancel before they apply. The date at the top shows the latest version.
        </p>
      </Section>

      <Section title="Law and disputes">
        <p>
          Dutch law applies to these terms. If you are a consumer living elsewhere in the EU, you keep the protection of the
          laws of your own country. Disputes go to the competent court in the Netherlands, or in your country of residence if
          you are a consumer. Please contact us first — most things can be sorted out by email.
        </p>
      </Section>
    </LegalPage>
  );
}
