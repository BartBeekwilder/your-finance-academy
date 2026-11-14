"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { live } from "@/lib/finance/calc";
import { TRIAL_KEY, useFinance } from "./FinanceProvider";

// A brand-new account goes to the setup by itself: signed in, never set up
// (no profile.onboarding) and nothing in the books yet. Closing the setup
// halfway keeps this tab on the app (it asks again on the next visit, until
// the setup is finished — the dashboard's "Finish your setup" takes over
// after a quick start).

export const SKIPPED = "pf-onboarding-skipped";

export default function OnboardingGate() {
  const { data, source } = useFinance();
  const router = useRouter();
  const path = usePathname();
  const fresh =
    (source === "vault" || source === "supabase") &&
    !data.profile.onboarding &&
    live(data.transactions).length === 0 &&
    live(data.accounts).every((a) => !Number(a.balance));
  useEffect(() => {
    if (!fresh || path?.startsWith("/app/welcome")) return;
    try {
      // Starting the free trial first (TrialRedirect); the setup follows after.
      if (sessionStorage.getItem(SKIPPED) || sessionStorage.getItem(TRIAL_KEY)) return;
    } catch {}
    router.replace("/app/welcome");
  }, [fresh, path, router]);
  return null;
}
