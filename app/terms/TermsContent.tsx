"use client";

import Link from "next/link";
import LegalPage, { Section, useLegalT } from "@/components/LegalPage";

// Terms of service for Personal Finance (website, web app and apps) and
// Premium. Drafted on 17 November 2026 from how the service works (7-day
// trial with a card on file, monthly / yearly / 2-year plans, Stripe on the
// web, App Store / Google Play in the apps) — to be checked before it's
// relied on. Every text goes through t(), so it shows in the visitor's
// language. The address sits in the footer (LegalPage).
const BUSINESS = { name: "Your Finance Academy", owner: "Bart Beekwilder", kvk: "42222252", email: "privacy@yourfinanceacademy.com" };

export default function TermsContent() {
  const { t } = useLegalT();
  return (
    <LegalPage
      title={t("Terms of Service")}
      updated={new Date(2026, 10, 17)}
      lede={t("These terms apply when you use Personal Finance — the website, the web app and the iPhone, iPad, Mac and Android apps — and when you take out Premium. In short: it's a tool for keeping your own books, not financial advice; you can cancel any time; and a trial only turns into a payment if you don't cancel before it ends.")}
    >
      <Section title={t("Who we are")}>
        <p>
          {t("Personal Finance is offered by {name}, a sole proprietorship run by {owner} in the Netherlands (Chamber of Commerce (KvK) number {kvk}). You can reach us at", BUSINESS)}{" "}
          <span className="mono">{BUSINESS.email}</span>.
        </p>
      </Section>

      <Section title={t("What Personal Finance is — and isn't")}>
        <p>{t("Personal Finance is software that helps you keep track of your own money: income and spending, budgets, accounts, loans, your home, investments and the figures that follow from them.")}</p>
        <p><strong>{t("It is not financial, tax, legal or investment advice.")}</strong> {t("The figures, forecasts and key figures are calculations based on what you enter and on public data such as market prices, which can be delayed or wrong. Documents read with AI can be misread, which is why you check every row before it is booked. Decisions you make with the help of the app are your own.")}</p>
      </Section>

      <Section title={t("Your account")}>
        <ul>
          <li>{t("You need to be 16 or older to create an account.")}</li>
          <li>{t("An account is for one person (or one household sharing its books). Keep your sign-in details to yourself.")}</li>
          <li>{t("If you add a passphrase (Settings › Extra protection), we cannot recover it. Without it, nobody — including us — can open your encrypted data.")}</li>
          <li>{t("Give a correct email address: we use it to sign you in and to tell you about your subscription.")}</li>
        </ul>
      </Section>

      <Section title={t("Free and Premium")}>
        <p>{t("You can use Personal Finance for free. Premium adds features such as reading documents with AI. What is included in each is shown in the app and on the website; we may improve or change features over time.")}</p>
        <p>{t("Premium is available as a monthly, yearly or 2-year subscription. Prices are shown before you pay and include VAT.")}</p>
      </Section>

      <Section title={t("Free trial")}>
        <p>{t("New Premium subscribers get a 7-day free trial. You add a payment method when the trial starts. If you don't cancel before the trial ends, the subscription starts and the first period is charged. You will see the date and the amount before you start. One trial per person.")}</p>
      </Section>

      <Section title={t("Payment, renewal and cancelling")}>
        <ul>
          <li>{t("On the website, payments are handled by Stripe. At checkout you may see that the purchase is made through Link, Stripe's checkout service; Stripe's terms apply to the payment itself.")}</li>
          <li>{t("In the apps, Premium is bought through the App Store or Google Play, and their terms apply to the payment, renewal and refunds.")}</li>
          <li>{t("A subscription renews automatically at the end of each period, for the same length and price, until you cancel.")}</li>
          <li>{t("You can cancel any time: on the web in Settings › Manage subscription, in the apps through your App Store or Google Play subscriptions. Premium stays active until the end of the period you have paid for.")}</li>
          <li>{t("Switching plans takes effect as shown at the moment you switch.")}</li>
        </ul>
      </Section>

      <Section title={t("Right of withdrawal and refunds")}>
        <p>{t("If you live in the EU, you may withdraw from a Premium subscription bought on the website within 14 days after the first payment, without giving a reason. Email us or cancel in Settings and ask for a refund within that time; we refund what you paid, minus a fair amount for the days you already had Premium after the trial. The 7-day trial itself is free.")}</p>
        <p>{t("After those 14 days, payments for a period that has started are not refunded, except where the law says otherwise. Purchases in the App Store or Google Play are refunded by Apple or Google under their rules.")}</p>
      </Section>

      <Section title={t("Price changes")}>
        <p>{t("We may change Premium's prices. A new price never applies to a period you have already paid for. We tell you at least 30 days before a new price applies to your subscription, and you can cancel before it does.")}</p>
      </Section>

      <Section title={t("Your data")}>
        <p>
          {t("The figures you enter are yours. How we store and protect them is described in our privacy policy.")}{" "}
          <Link href="/privacy">{t("Privacy Policy")}</Link>. {t("You can ask us to delete your account and everything in it.")}
        </p>
      </Section>

      <Section title={t("Fair use")}>
        <p>{t("Use the service for your own finances and in a normal way. Don't try to break, overload or get around its limits (such as the number of AI reads per day), don't access other people's data, and don't use it for anything unlawful. We may suspend an account that does.")}</p>
      </Section>

      <Section title={t("Availability and changes")}>
        <p>{t("We do our best to keep Personal Finance available and your data safe, but we can't promise it will never be interrupted. We may change or stop features; if we stop Premium altogether, we refund the unused part of what you paid.")}</p>
      </Section>

      <Section title={t("Liability")}>
        <p>{t("We are not liable for decisions you make based on the app, or for damage caused by figures that are wrong because of what was entered, read or received from others. Our total liability to you is limited to what you paid us in the 12 months before the event. None of this limits liability that the law does not allow to be limited, such as for intent or gross negligence, or your rights as a consumer.")}</p>
      </Section>

      <Section title={t("Changes to these terms")}>
        <p>{t("We may update these terms. For changes that affect you, we tell you in advance; if you don't agree, you can cancel before they apply. The date at the top shows the latest version.")}</p>
      </Section>

      <Section title={t("Law and disputes")}>
        <p>{t("Dutch law applies to these terms. If you are a consumer living elsewhere in the EU, you keep the protection of the laws of your own country. Disputes go to the competent court in the Netherlands, or in your country of residence if you are a consumer. Please contact us first — most things can be sorted out by email.")}</p>
      </Section>
    </LegalPage>
  );
}
