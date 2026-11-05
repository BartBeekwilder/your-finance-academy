"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Onboarding from "@/components/finance/Onboarding";
import { useFinance } from "@/components/finance/FinanceProvider";
import { SKIPPED } from "@/components/finance/OnboardingGate";
import { live } from "@/lib/finance/calc";

// The setup: /app/welcome. Signed in (or with local data) it saves for
// real; in the demo it's a preview that saves nothing. A new account is
// sent here by OnboardingGate. ?continue=1 (from the dashboard's "Finish
// your setup") opens the complete route at the first chapter still open.
function Welcome() {
  const router = useRouter();
  const { source, data } = useFinance();
  const resume = useSearchParams().get("continue") === "1";
  // It only saves for a new account (nothing in the books yet) or one that
  // started it before (profile.onboarding) — never over existing books.
  const fresh = live(data.transactions).length === 0 && live(data.accounts).every((a) => !Number(a.balance));
  const preview = source === "demo" || (!fresh && !data.profile.onboarding);
  return <Onboarding key={resume ? "resume" : "start"} preview={preview} resume={resume} onClose={() => {
        try {
          sessionStorage.setItem(SKIPPED, "1");
        } catch {}
        router.push("/app");
      }} />;
}

export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}
