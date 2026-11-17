import type { Metadata } from "next";
import LanguageRoot from "@/components/finance/LanguageRoot";
import PrivacyContent from "./PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy Policy · Personal Finance",
  description: "How Your Finance Academy and the Personal Finance website, iPhone, iPad, Mac and Android apps handle your data.",
};

// The privacy policy, in the visitor's language (PrivacyContent).
export default function Privacy() {
  return (
    <LanguageRoot>
      <PrivacyContent />
    </LanguageRoot>
  );
}
