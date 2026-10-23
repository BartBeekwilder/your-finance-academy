"use client";

import { t } from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Banknote, Scale, House, ChartLine, ChartPie, CircleDollarSign, Landmark, LayoutGrid, List, LogOut, Receipt, Pause, Play, Settings } from "lucide-react";
import { setMotionPaused, useMotionPaused } from "@/lib/motion";
import BrandMark from "./BrandMark";
import { useFinance } from "./FinanceProvider";

// The iOS tabs (Views/ContentView.swift), same order: plus Expenses and Net worth.
const TABS = [
  { href: "/app", label: "Dashboard", Icon: ChartPie },
  { href: "/app/income", label: "Income", Icon: Banknote },
  { href: "/app/expenses", label: "Expenses", Icon: Receipt },
  { href: "/app/net-worth", label: "Net worth", Icon: Landmark },
  { href: "/app/balance", label: "Balance sheet", Icon: Scale },
  { href: "/app/real-estate", label: "Real estate", Icon: House },
  { href: "/app/investments", label: "Investments", Icon: ChartLine },
  { href: "/app/transactions", label: "Transactions", Icon: List },
  { href: "/app/categories", label: "Categories", Icon: LayoutGrid },
  { href: "/app/budgets", label: "Budgets", Icon: CircleDollarSign },
] as const;

export default function AppNav() {
  const path = usePathname();
  const { source, email, signOut, data } = useFinance();

  return (
    <nav className="pf-nav" aria-label={t("App")}>
      <div className="pf-brand">
        <BrandMark size={30} currency={data.profile.currency_code} />
        <strong style={{ fontSize: "1.02rem" }}>{t("Personal Finance")}</strong>
      </div>

      {TABS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
          <Icon size={20} strokeWidth={2} />
          <span className="pf-nav-label">{t(label)}</span>
        </Link>
      ))}

      {/* Settings sits apart from the six iOS tabs, at the foot of the list. */}
      <Link href="/app/settings" aria-current={path === "/app/settings" ? "page" : undefined} className="pf-nav-settings">
        <Settings size={20} strokeWidth={2} />
        <span className="pf-nav-label">{t("Settings")}</span>
      </Link>

      <div className="pf-nav-foot">
        {process.env.NODE_ENV === "development" && <MotionToggle />}
        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {source === "demo" ? t("Demo data — nothing is saved") : email}
        </div>
        <button className="pf-link" onClick={signOut} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, marginTop: 6 }}>
          <LogOut size={14} /> {source === "demo" ? t("Leave demo") : t("Sign out")}
        </button>
      </div>
    </nav>
  );
}

/** Development only: pause every animation and live ticker (lib/motion.ts),
 *  to spare a slow machine. The site keeps working; it just holds still. */
function MotionToggle() {
  const paused = useMotionPaused();
  useEffect(() => {
    document.documentElement.toggleAttribute("data-pf-paused", paused);
  }, [paused]);
  return (
    <button
      className="pf-link"
      onClick={() => setMotionPaused(!paused)}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, marginBottom: 8 }}
    >
      {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? t("Resume animations") : t("Pause animations")}
    </button>
  );
}
