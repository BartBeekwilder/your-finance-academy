import type { Metadata } from "next";
import AppNav from "@/components/finance/AppNav";
import { FinanceProvider } from "@/components/finance/FinanceProvider";
import NeonLines from "@/components/finance/NeonLines";
import QuickAdd from "@/components/finance/QuickAdd";
import "./finance.css";

export const metadata: Metadata = {
  title: "Personal Finance",
  description: "Your budgets, spending and net worth — in sync with the Personal Finance iOS app.",
};

export default function FinanceAppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="pf">
      <NeonLines lineCount={4} opacity={0.1} />
      <FinanceProvider>
        <div className="pf-shell">
          <AppNav />
          <main className="pf-main">{children}</main>
          <QuickAdd />
        </div>
      </FinanceProvider>
    </div>
  );
}
