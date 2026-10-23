"use client";

import { useRouter } from "next/navigation";
import Onboarding from "@/components/finance/Onboarding";

// The onboarding draft, for review: /app/welcome. Nothing is saved here;
// once approved it opens by itself for new accounts.
export default function WelcomePage() {
  const router = useRouter();
  return <Onboarding preview onClose={() => router.push("/app")} />;
}
