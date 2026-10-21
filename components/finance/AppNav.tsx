"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Banknote, ChartLine, ChartPie, CircleDollarSign, LayoutGrid, List, LogOut, Pause, Play } from "lucide-react";
import { setMotionPaused, useMotionPaused } from "@/lib/motion";
import { useFinance } from "./FinanceProvider";

// Same six tabs, same order, as the iOS TabView (Views/ContentView.swift).
const TABS = [
  { href: "/app", label: "Dashboard", Icon: ChartPie },
  { href: "/app/income", label: "Income", Icon: Banknote },
  { href: "/app/investments", label: "Investments", Icon: ChartLine },
  { href: "/app/transactions", label: "Transactions", Icon: List },
  { href: "/app/categories", label: "Categories", Icon: LayoutGrid },
  { href: "/app/budgets", label: "Budgets", Icon: CircleDollarSign },
] as const;

export default function AppNav() {
  const path = usePathname();
  const { source, email, signOut } = useFinance();

  return (
    <nav className="pf-nav" aria-label="App">
      <div className="pf-brand">
        <span className="pf-brand-mark" />
        <strong style={{ fontSize: "1.02rem" }}>Personal Finance</strong>
      </div>

      {TABS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
          <Icon size={20} strokeWidth={2} />
          <span className="pf-nav-label">{label}</span>
        </Link>
      ))}

      <div className="pf-nav-foot">
        {process.env.NODE_ENV === "development" && <MotionToggle />}
        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {source === "demo" ? "Demo data — nothing is saved" : email}
        </div>
        <button className="pf-link" onClick={signOut} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, marginTop: 6 }}>
          <LogOut size={14} /> {source === "demo" ? "Leave demo" : "Sign out"}
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
      {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? "Resume animations" : "Pause animations"}
    </button>
  );
}
