import type { Metadata } from "next";
import AppNav from "@/components/finance/AppNav";
import { FinanceProvider } from "@/components/finance/FinanceProvider";
import NeonLines from "@/components/finance/NeonLines";
import "./finance.css";

export const metadata: Metadata = {
  title: "Personal Finance",
  description: "Your budgets, spending and net worth — in sync with the Personal Finance iOS app.",
};

export default function FinanceAppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="pf">
      <NeonLines lineCount={4} opacity={0.1} />
      <div className="pf-shell">
        <AppNav demo />
        <main className="pf-main">
          <FinanceProvider>{children}</FinanceProvider>
        </main>
      </div>
    </div>
  );
}
