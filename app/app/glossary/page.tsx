"use client";

import { t } from "@/lib/i18n";
import { GLOSSARY } from "@/lib/finance/glossary";

// Glossary: every term the app uses, in plain words, A–Z in the reader's
// language. Each has an anchor, so an ⓘ can link straight to it.

export default function GlossaryPage() {
  const terms = [...GLOSSARY].sort((a, b) => t(a.term).localeCompare(t(b.term)));
  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 760 }}>
      <header style={{ display: "grid", gap: 6 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Glossary")}</h1>
        <p style={{ margin: 0, color: "var(--pf-ink-2)" }}>{t("The words this app uses, in plain language.")}</p>
      </header>
      <div className="pf-card">
        {terms.map((g) => (
          <section key={g.id} id={g.id} className="pf-gloss">
            <h2>{t(g.term)}</h2>
            <p>{t(g.text)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
