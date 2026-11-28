"use client";

import { projectedNetIncome } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import { WORK_HOURS } from "@/lib/finance/metrics";
import type { FinanceData } from "@/lib/finance/types";
import { useTickerNow } from "@/lib/motion";
import { t } from "@/lib/i18n";
import LiveAmount from "./LiveAmount";

// Dashboard: what your work earned today, live (Bart, 28 Nov: "a tile with
// today's income from work, a bit bigger"). The month's net salary spread
// over the days and seconds like the Income tile, from midnight to now;
// beside it a day's and an hour's worth (40-hour week).

export default function TodayWorkTile({ data, currency }: { data: FinanceData; currency: string }) {
  const nowMs = useTickerNow();
  const now = new Date(nowMs);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const salary = projectedNetIncome(data, month);
  if (!(salary > 0)) return null;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const perDay = salary / days;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const frac = Math.min(Math.max((nowMs - midnight) / 86_400_000, 0), 1);
  return (
    <section className="pf-card pf-today-work" aria-label={t("Earned with your work today")}>
      <div className="pf-today-work-main">
        <span className="pf-today-work-kicker"><i aria-hidden /> {t("Earned with your work today")}</span>
        <LiveAmount value={perDay * frac} currency={currency} size="2.6rem" color="#30d158" />
        <span className="pf-today-work-bar" aria-hidden><span style={{ width: `${frac * 100}%` }} /></span>
      </div>
      <div className="pf-today-work-side">
        <span><b className="pf-rounded">{money(perDay, currency)}</b> {t("a day")}</span>
        <span><b className="pf-rounded">{money(salary / WORK_HOURS, currency)}</b> {t("an hour of work")}</span>
        <small>{t("Net salary {amount} a month, spread over every second", { amount: money(salary, currency) })}</small>
      </div>
    </section>
  );
}
