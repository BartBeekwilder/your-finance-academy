"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useFinance } from "./FinanceProvider";

/** Whether the signed-in user has Premium (RevenueCat, via the status
 *  route). The demo counts as Premium: it shows what Premium brings.
 *  null while checking. */
export function usePremium(): boolean | null {
  const { source } = useFinance();
  const [active, setActive] = useState<boolean | null>(null);
  useEffect(() => {
    if (source === "demo") return;
    let alive = true;
    (async () => {
      try {
        const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
        const token = data.session?.access_token;
        if (!token) return alive && setActive(false);
        const r = await fetch("/api/billing/status", { headers: { Authorization: `Bearer ${token}` } });
        const j = (await r.json()) as { active?: boolean };
        if (alive) setActive(!!j.active);
      } catch {
        if (alive) setActive(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [source]);
  return source === "demo" ? true : active;
}
