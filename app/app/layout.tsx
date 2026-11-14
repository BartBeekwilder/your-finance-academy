import type { Metadata } from "next";
import AppNav from "@/components/finance/AppNav";
import { CategoryDetailProvider } from "@/components/finance/CategoryDetail";
import { FinanceProvider } from "@/components/finance/FinanceProvider";
import LanguageRoot from "@/components/finance/LanguageRoot";
import NeonLines from "@/components/finance/NeonLines";
import QuickAdd from "@/components/finance/QuickAdd";
import OnboardingGate from "@/components/finance/OnboardingGate";
import FeedbackButton from "@/components/finance/FeedbackButton";
import DemoTimer from "@/components/finance/DemoTimer";
import "./finance.css";

export const metadata: Metadata = {
  title: "Personal Finance · Your Finance Academy",
  applicationName: "Personal Finance",
  publisher: "Your Finance Academy (YFA)",
  description: "Your budgets, spending and net worth — in sync with the Personal Finance iOS app.",
};

export default function FinanceAppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="pf">
      <NeonLines lineCount={4} opacity={0.1} />
      <FinanceProvider>
        <LanguageRoot>
          <CategoryDetailProvider>
            <div className="pf-shell">
              <AppNav />
              <main className="pf-main">{children}</main>
              <QuickAdd />
              <OnboardingGate />
              <FeedbackButton />
              <DemoTimer />
            </div>
          </CategoryDetailProvider>
        </LanguageRoot>
      </FinanceProvider>
    </div>
  );
}
