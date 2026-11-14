"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Hourglass } from "lucide-react";
import { t } from "@/lib/i18n";
import { clock, demoLeft, DEMO_MINUTES, startDemoClock } from "@/lib/finance/demoTimer";
import { useFinance } from "./FinanceProvider";
import { OPEN_SIGNUP } from "./SignIn";

// The demo's time limit (lib/finance/demoTimer.ts): a pill counting down
// while you look around, amber in the last minute, and when time is up a
// screen over the app that only leads to signing in or creating an account.
// Not inside the homepage's device frames (the product site shows the app
// live there).

export default function DemoTimer() {
  const { source, signOut } = useFinance();
  const demo = source === "demo";
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!demo) return;
    let framed = false;
    try {
      framed = window.self !== window.top;
    } catch {}
    if (framed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this browser's storage
    setStart(startDemoClock());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [demo]);
  if (!demo || start == null) return null;
  const left = demoLeft(start, now);

  if (left > 0)
    return (
      <div className="pf-demo-pill" data-low={left <= 60_000 || undefined} role="timer" aria-label={t("Demo time left: {time}", { time: clock(left) })}>
        <Hourglass size={13} />
        <span>{t("Demo")}</span>
        <b className="pf-rounded">{clock(left)}</b>
      </div>
    );

  return (
    <div className="pf-demo-end" role="dialog" aria-modal="true" aria-label={t("The demo is over")}>
      <div className="pf-demo-end-card">
        <span className="pf-demo-end-icon"><Hourglass size={30} /></span>
        <span className="pf-cele-kicker">{t("The demo is over")}</span>
        <h2>{t("Liked what you saw?")}</h2>
        <p>{t("You've had your {n} minutes with the demo. Create an account to set up your own books — your data, live, on every device.", { n: DEMO_MINUTES })}</p>
        <button type="button" className="pf-button" onClick={() => { try { sessionStorage.setItem(OPEN_SIGNUP, "1"); } catch {} void signOut(); }}>
          {t("Create your account")} <ArrowRight size={16} />
        </button>
        <button type="button" className="pf-link" onClick={() => void signOut()}>{t("I already have an account")}</button>
      </div>
    </div>
  );
}
