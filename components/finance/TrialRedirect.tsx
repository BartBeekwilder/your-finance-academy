"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TRIAL_KEY, useFinance } from "./FinanceProvider";

// "Try it free now!" on the homepage (/app?trial=1): once the account is
// open, go straight to Premium in Settings to start the free trial — before
// the setup (OnboardingGate waits until this has run).

export default function TrialRedirect() {
  const { source } = useFinance();
  const router = useRouter();
  useEffect(() => {
    if (source !== "vault" && source !== "supabase") return;
    try {
      if (sessionStorage.getItem(TRIAL_KEY) !== "1") return;
      sessionStorage.removeItem(TRIAL_KEY);
    } catch {
      return;
    }
    router.push("/app/settings#subscription");
  }, [source, router]);
  return null;
}
