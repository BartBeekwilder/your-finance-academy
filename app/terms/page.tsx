import type { Metadata } from "next";
import LanguageRoot from "@/components/finance/LanguageRoot";
import TermsContent from "./TermsContent";

export const metadata: Metadata = {
  title: "Terms of Service · Personal Finance",
  description: "The terms for using Personal Finance and its Premium subscription: trial, renewal, cancelling, refunds and liability.",
};

// The terms of service, in the visitor's language (TermsContent).
export default function Terms() {
  return (
    <LanguageRoot>
      <TermsContent />
    </LanguageRoot>
  );
}
