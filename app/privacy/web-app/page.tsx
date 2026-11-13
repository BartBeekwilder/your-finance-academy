import type { Metadata } from "next";
import LanguageRoot from "@/components/finance/LanguageRoot";
import PrivacyBody from "./PrivacyBody";

export const metadata: Metadata = {
  title: "Privacy — Personal Finance web app (test version)",
  description: "What the Personal Finance web app stores while it's being tested, where, and who can see it.",
};

// For testers of the web app (/app), in the visitor's language (the same
// choice as the app). The site's main privacy page (/privacy) describes the
// iOS app without accounts.
export default function WebAppPrivacy() {
  return (
    <LanguageRoot>
      <PrivacyBody />
    </LanguageRoot>
  );
}
