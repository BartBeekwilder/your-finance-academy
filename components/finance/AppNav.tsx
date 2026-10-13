"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, ChartLine, ChartPie, CircleDollarSign, LayoutGrid, List } from "lucide-react";

// Same six tabs, same order, as the iOS TabView (Views/ContentView.swift).
const TABS = [
  { href: "/app", label: "Dashboard", Icon: ChartPie },
  { href: "/app/income", label: "Income", Icon: Banknote },
  { href: "/app/investments", label: "Investments", Icon: ChartLine },
  { href: "/app/transactions", label: "Transactions", Icon: List },
  { href: "/app/categories", label: "Categories", Icon: LayoutGrid },
  { href: "/app/budgets", label: "Budgets", Icon: CircleDollarSign },
] as const;

export default function AppNav({ demo }: { demo: boolean }) {
  const path = usePathname();

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

      {demo && (
        <p className="pf-nav-foot">
          Demo data — sign-in and sync with the iOS app are coming next.
        </p>
      )}
    </nav>
  );
}
