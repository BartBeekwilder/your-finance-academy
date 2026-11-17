"use client";

import LegalPage, { Section, useLegalT } from "@/components/LegalPage";

// Privacy policy for the whole service: the website and web app, and the
// apps that sync with the same account. Drafted from how the service works
// on 17 November 2026 — to be checked before it's relied on. Every text goes
// through t(), so it shows in the visitor's language.

export default function PrivacyContent() {
  const { t } = useLegalT();
  const mail = <span className="mono">privacy@yourfinanceacademy.com</span>;
  return (
    <LegalPage
      title={t("Privacy Policy")}
      updated={new Date(2026, 10, 17)}
      lede={t("Your books sit in one account, so the website, your iPhone, iPad, Mac and Android phone show the same figures. The data is stored in the European Union. You can add a passphrase that only you know; then nobody else can read it, including us. We don't sell data, and we don't use advertising or tracking.")}
    >
      <Section title={t("Who is responsible")}>
        <p>{t("Your Finance Academy (Personal Finance) is run by Bart Beekwilder in the Netherlands. Questions and requests about this policy:")} {mail}</p>
      </Section>

      <Section title={t("What we store")}>
        <p><strong>{t("Your account:")}</strong> {t("your email address and a password, stored in hashed form by our sign-in provider. We never see the password itself.")}</p>
        <p><strong>{t("Your books:")}</strong> {t("accounts and balances, income and expenses, categories and budgets, fixed costs and subscriptions, loans, your home and mortgage, insurance policies, investments you enter, goals, check-ins and progress, and settings such as currency, country and household names. This is what you enter, and it is what lets the apps and the website show the same figures.")}</p>
        <p><strong>{t("Feedback")}</strong> {t("you send from the app, with the page you were on and your screen size.")}</p>
        <p><strong>{t("Technical data:")}</strong> {t("the usual connection logs of our hosting provider (such as your IP address and browser type), kept to run and secure the service.")}</p>
      </Section>

      <Section title={t("Encryption and who can read your data")}>
        <p><strong>{t("Without a passphrase")}</strong> {t("(the default): your books are stored in your account. You can read them after signing in. The people who run the service can technically read them too, because we manage the database; we don't look at them.")}</p>
        <p><strong>{t("With a passphrase")}</strong> {t("(Settings › Extra protection): your books are encrypted on your device before they are sent, with AES-256. Only someone with your passphrase can read them. We cannot recover a forgotten passphrase, so keep it in a password manager.")}</p>
        <p>{t("Your data is kept on the same account on every device. The apps keep a copy on the device so they work offline, and sync when they are online.")}</p>
      </Section>

      <Section title={t("Where it is stored and who processes it")}>
        <p><strong>Supabase</strong> {t("(database and sign-in) in the European Union (Ireland). Each account can only read its own data; the database enforces this.")}</p>
        <p><strong>Vercel</strong> {t("hosts the website and serves the app; it processes connection logs.")}</p>
        <p><strong>Resend</strong> {t("sends the sign-in and confirmation emails.")} <strong>Cloudflare</strong> {t("handles the domain and forwards mail sent to our privacy address.")}</p>
      </Section>

      <Section title={t("Live market prices and search")}>
        <p>{t("For live share, fund, crypto and metal prices, and to search for an investment, our server asks a public price service (Yahoo Finance). These requests contain only the ticker or the search text you typed, never your name, amounts or holdings. Company logos are loaded by ticker from Financial Modeling Prep.")}</p>
      </Section>

      <Section title={t("Reading documents with AI (Premium)")}>
        <p>{t("With Read with AI you can add bank or credit card statements, payslips or mortgage documents, which are read to fill in your books. You give consent the first time you use it. The files are sent to Anthropic, which processes them to return the figures. We don't keep the files; we only keep the time of each read, to enforce the daily limit. You check every row before anything is booked.")}</p>
      </Section>

      <Section title={t("Payments and subscriptions")}>
        <p>{t("Premium is paid through Stripe on the web, or through the App Store and Google Play in the apps. Stripe processes your payment details; we never see your card number. Whether you have Premium is checked with RevenueCat, which connects the store and web subscriptions. We keep the subscription status, not your card details.")}</p>
      </Section>

      <Section title={t("Apps and sign-in")}>
        <p>{t("The iPhone, iPad, Mac and Android apps use the same account. Signing in with Apple, where it is offered, gives us only your email address (or the private relay address Apple provides). The apps store your books on the device, so you can use them offline.")}</p>
      </Section>

      <Section title={t("Cookies and tracking")}>
        <p>{t("We use no advertising, tracking or analytics cookies. The website and apps store what keeps you signed in, and your settings such as language and animations, on your own device.")}</p>
      </Section>

      <Section title={t("How long we keep it")}>
        <p>{t("We keep your account and books for as long as you use the service. When you ask us to delete your account, we delete it together with everything in it. Copies that sit in backups disappear when those backups expire.")}</p>
      </Section>

      <Section title={t("Your rights")}>
        <p>{t("You can ask us what we hold about you, to correct it, to have it deleted, or to receive it in a common format, and you can object to processing. Send your request to")} {mail}. {t("If you are not satisfied with our answer, you can complain to the Dutch Data Protection Authority (Autoriteit Persoonsgegevens).")}</p>
      </Section>

      <Section title={t("Children")}>
        <p>{t("The service is not meant for children under 16. We don't knowingly collect data from them; if you think we have, tell us and we will delete it.")}</p>
      </Section>

      <Section title={t("Changes to this policy")}>
        <p>{t("If something changes here, for example a new service that handles data, this page is updated first, and the change is described plainly at the top of the page.")}</p>
      </Section>
    </LegalPage>
  );
}
