"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { buildDemoData } from "@/lib/finance/demo";
import type { FinanceData } from "@/lib/finance/types";

// Single source of finance data for every /app screen. Today it serves demo
// data; once Supabase is connected this is where the signed-in user's rows
// get loaded (and kept live via Supabase realtime), so no screen changes.

type FinanceState = {
  data: FinanceData;
  source: "demo" | "supabase";
  now: Date;
};

const FinanceContext = createContext<FinanceState | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  // Built after mount, not during render: the demo is relative to "today",
  // and a server-rendered copy would freeze whatever day the site was built.
  const [state, setState] = useState<FinanceState | null>(null);

  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only load
    setState({ data: buildDemoData(now), source: "demo", now });
  }, []);

  if (!state) return <div className="pf-loading" aria-busy="true" />;
  return <FinanceContext.Provider value={state}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used inside <FinanceProvider>");
  return ctx;
}
