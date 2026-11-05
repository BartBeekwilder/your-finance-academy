"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Onboarding from "@/components/finance/Onboarding";

// The onboarding draft, for review: /app/welcome. Nothing is saved here;
// once approved it opens by itself for new accounts. ?continue=1 (from the
// dashboard's "Finish your setup") opens the complete route at the first
// chapter still open.
function Welcome() {
  const router = useRouter();
  const resume = useSearchParams().get("continue") === "1";
  return <Onboarding key={resume ? "resume" : "start"} preview resume={resume} onClose={() => router.push("/app")} />;
}

export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}
