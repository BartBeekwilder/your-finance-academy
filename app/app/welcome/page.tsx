"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Onboarding from "@/components/finance/Onboarding";
import { useFinance } from "@/components/finance/FinanceProvider";
import { SKIPPED } from "@/components/finance/OnboardingGate";

// The setup: /app/welcome. Signed in (or with local data) it saves for
// real; in the demo it's a preview that saves nothing. A new account is
// sent here by OnboardingGate. ?continue=1 (from the dashboard's "Finish
// your setup") opens the complete route at the first chapter still open.
function Welcome() {
  const router = useRouter();
  const { source } = useFinance();
  const resume = useSearchParams().get("continue") === "1";
  return <Onboarding key={resume ? "resume" : "start"} preview={source === "demo"} resume={resume} onClose={() => {
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
