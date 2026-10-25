"use client";

import { intlLocale, t } from "@/lib/i18n";
import { useFinance } from "./FinanceProvider";
import { cap, shortMonth } from "@/lib/finance/format";
import { useNow } from "@/lib/motion";
import type { FinanceData } from "@/lib/finance/types";

// "Last updated" pill under the dashboard title: when you last entered or
// changed anything (the newest updated_at over your own rows — Supabase sets
// it on every insert and edit), so you know from which day to catch up. It
// moves by itself after every session. Today: green; earlier: amber, with
// the days to fill in. Click to open Quick Add.

const TABLES: (keyof FinanceData)[] = [
  "transactions", "incomeRecords", "budgets", "accounts", "holdings", "balanceItems", "balanceValues",
  "properties", "mortgageParts", "insurancePolicies", "goals", "monthCloses", "categories",
];

/** The newest change to the user's own data (demo: the latest transaction). */
export function lastUpdate(data: FinanceData, demo: boolean, now: Date): Date | null {
  if (demo) {
    const dates = data.transactions.filter((x) => !x.deleted_at).map((x) => new Date(x.date)).filter((d) => d <= now);
    return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  }
  let max = 0;
  for (const key of TABLES) {
    for (const row of (data[key] as { updated_at?: string; deleted_at?: string | null }[]) ?? []) {
      if (row.deleted_at || !row.updated_at) continue;
      const ms = Date.parse(row.updated_at);
      if (ms > max) max = ms;
    }
  }
  return max ? new Date(max) : null;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export default function LastUpdated() {
  const { data, source } = useFinance();
  const now = new Date(useNow(60_000));
  const last = lastUpdate(data, source === "demo", now);
  if (!last) return null;

  const days = Math.round((dayStart(now).getTime() - dayStart(last).getTime()) / 86_400_000);
  const fresh = days <= 0;
  const loc = intlLocale();
  // Weekday, day, month with a capital (Za 24 Okt) — month names always
  // start with a capital (format.ts rule).
  const day = (d: Date) => `${cap(d.toLocaleDateString(loc, { weekday: "short" }))} ${d.getDate()} ${shortMonth(d)}`;
  const time = last.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  const from = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);

  return (
    <button
      type="button"
      className="pf-updated"
      data-fresh={fresh}
      onClick={() => window.dispatchEvent(new Event("pf-quick-add"))}
      title={t("Add what happened since then")}
    >
      <span className="pf-updated-dot" />
      {fresh ? (
        <span>{t("Updated today at {time}", { time })}</span>
      ) : (
        <span>
          {t("Last updated {date}", { date: day(last) })}
          <span className="pf-updated-gap">
            {" · "}
            {days === 1
              ? t("catch up today")
              : t("catch up {from} – {to}", { from: day(from), to: day(now) })}
          </span>
        </span>
      )}
    </button>
  );
}
