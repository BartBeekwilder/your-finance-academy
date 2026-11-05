"use client";

import { t } from "@/lib/i18n";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { money, monthYear } from "@/lib/finance/format";
import { useTween } from "./charts";

// The setup's finale, "your books are open": a few story cards in the Month
// Wrapped style — what's left to save each month, what you have, your
// equity, when you're debt-free — each number counting up as its card comes
// in. Tap (or →) for the next one; the last card opens the dashboard.

export type RevealFigures = {
  income: number;
  fixed: number;
  budgets: number;
  left: number;
  cash: number;
  equity: number;
  /** The last loan's payoff month, when there are loans with a payment. */
  debtFree: Date | null;
};

type Card = { key: string; kicker: string; value: number | null; text: string; tone: string; color: string; date?: Date };

export default function OnboardingReveal({ f, currency, onOpen, openLabel }: { f: RevealFigures; currency: string; onOpen: () => void; openLabel: string }) {
  const cards: Card[] = [
    {
      key: "left",
      kicker: t("Left to save each month"),
      value: f.left,
      text: t("{income} comes in; {fixed} is fixed and {budgets} budgeted.", { income: money(f.income, currency), fixed: money(f.fixed, currency), budgets: money(f.budgets, currency) }),
      tone: "linear-gradient(150deg, #1d6b4f, #0e2a22 70%)",
      color: f.left >= 0 ? "#4ade80" : "#ff6961",
    },
    { key: "cash", kicker: t("In your accounts"), value: f.cash, text: t("Your starting point. From here every month adds what you saved."), tone: "linear-gradient(150deg, #20508a, #0d1f36 70%)", color: "#7cc4ff" },
    ...(Math.abs(f.equity - f.cash) > 0.5
      ? [{ key: "equity", kicker: t("Equity"), value: f.equity, text: t("What you own minus what you owe — your balance sheet keeps it up to date."), tone: "linear-gradient(150deg, #4b2f8a, #1a1233 70%)", color: "#c4b5fd" }]
      : []),
    ...(f.debtFree
      ? [{ key: "debt", kicker: t("Debt-free"), value: null, date: f.debtFree, text: t("Your loans go down by themselves every month."), tone: "linear-gradient(150deg, #8a5a1f, #2a1b0b 70%)", color: "#fbbf24" }]
      : []),
    { key: "open", kicker: t("All set"), value: null, text: t("Your dashboard is ready. The month counts along live from here."), tone: "linear-gradient(150deg, #5b4fd6, #0f7f86)", color: "#fff" },
  ];
  const [i, setI] = useState(0);
  const card = cards[i];
  const last = i === cards.length - 1;
  const next = () => (last ? onOpen() : setI(i + 1));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") setI((k) => Math.max(k - 1, 0));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <div className="pf-wr pf-ob-reveal">
      <div className="pf-wr-segs" aria-hidden>
        {cards.map((c, k) => (
          <button key={c.key} type="button" tabIndex={-1} data-state={k < i ? "done" : k === i ? "now" : "ahead"} onClick={() => setI(k)}>
            <i />
          </button>
        ))}
      </div>
      <div key={card.key} className="pf-wr-card" style={{ background: card.tone }} onClick={next}>
        <div className="pf-wr-body">
          <span className="pf-wr-kicker">{card.kicker}</span>
          {card.value !== null ? (
            <Count value={card.value} currency={currency} color={card.color} />
          ) : card.date ? (
            <span className="pf-wr-huge pf-rounded" style={{ color: card.color }}>{monthYear(card.date)}</span>
          ) : (
            <span className="pf-wr-title">{t("Your books are open.")}</span>
          )}
          <p className="pf-wr-line">{card.text}</p>
          {last && (
            <button type="button" className="pf-button pf-ob-reveal-open" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
              {openLabel} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A big amount counting up from zero as its card comes in. */
function Count({ value, currency, color }: { value: number; currency: string; color: string }) {
  // From 0 on the first frame, then the tween runs to the value.
  const [target, setTarget] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTarget(value));
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const [shown] = useTween([target], 1100);
  return <span className="pf-wr-huge pf-rounded" style={{ color }}>{money(shown, currency)}</span>;
}
