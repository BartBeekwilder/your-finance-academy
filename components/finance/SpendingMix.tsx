"use client";

import { useMemo } from "react";
import { live, num } from "@/lib/finance/calc";
import type { FinanceData } from "@/lib/finance/types";
import { intlLocale, t } from "@/lib/i18n";
import type { Mode } from "./LiveTiles";
import { MixChart, type MixLine } from "./PortfolioMix";

// Expenses › spending per category, added up over the period (Bart, 25 Nov:
// "the same table for expenses" as Investments › Value per holding): one
// band per top-level category, stacked (Amount) or as shares (Share), with
// the mix as a bar and a list at "now" or the day pointed at. Month: every
// day of the month up to today; Year: every day of the year up to today.

export default function SpendingMix({ data, now, mode, currency }: { data: FinanceData; now: Date; mode: Mode; currency: string }) {
  const model = useMemo(() => {
    const year = now.getFullYear();
    const start = mode === "month" ? new Date(year, now.getMonth(), 1) : new Date(year, 0, 1);
    const days = Math.max(1, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - start.getTime()) / 86_400_000) + 1);
    const times = Array.from({ length: days }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12).getTime());
    const cats = live(data.categories);
    const byId = new Map(cats.map((c) => [c.id, c]));
    const topOf = (id: string | null) => { const c = id ? byId.get(id) : undefined; return c ? (c.parent_id ?? c.id) : ""; };
    const perDay = new Map<string, number[]>();
    for (const x of live(data.transactions)) {
      if (x.type !== "expense") continue;
      const d = new Date(x.date);
      const k = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 86_400_000);
      if (k < 0 || k >= days) continue;
      const id = topOf(x.category_id);
      const row = perDay.get(id) ?? new Array(days).fill(0);
      row[k] += num(x.amount);
      perDay.set(id, row);
    }
    const lines: MixLine[] = [...perDay.entries()].map(([id, row]) => {
      let sum = 0;
      const c = byId.get(id);
      return { id: id || "none", name: c?.name ?? t("No category"), color: `#${c?.color_hex ?? "8E8E93"}`, values: row.map((v) => (sum += v)) };
    });
    // Biggest at the bottom of the stack.
    lines.sort((a, b) => (b.values[days - 1] ?? 0) - (a.values[days - 1] ?? 0));
    return { times, lines };
  }, [data, now, mode]);

  if (!model.lines.length || model.times.length < 2) return null;
  const day = (ms: number) => new Date(ms).toLocaleDateString(intlLocale(), { day: "numeric", month: "short" });
  return (
    <MixChart
      title={t("Spending per category, added up")}
      times={model.times}
      lines={model.lines}
      currency={currency}
      labelAt={(k) => day(model.times[k])}
      nowLabel={t("Today")}
      nowPrefix={mode === "month" ? t("This month") : t("This year")}
      storageKey="pf-spendmix-hidden"
    />
  );
}
