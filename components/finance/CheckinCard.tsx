"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, CircleCheck, Flame } from "lucide-react";
import { intlLocale, t } from "@/lib/i18n";
import { useFinance } from "@/components/finance/FinanceProvider";
import { accountFlows, live, num } from "@/lib/finance/calc";
import { CHECKIN_POINTS, CHECKIN_PREFIX, checkinDays, checkinState, dayKey, sinceLast, type CheckinInterval } from "@/lib/finance/checkin";
import { money } from "@/lib/finance/format";
import InfoTip from "@/components/finance/InfoTip";

// "Are my books up to date?" — a short checklist once per period (Settings ›
// Check-in): expenses, income and account balances, each with a way to fix
// it right there. Ticking all three and confirming records a check-in
// (lib/finance/checkin) and earns bonus points on top of the daily visit.

export function useCheckin() {
  const { data, now } = useFinance();
  const interval: CheckinInterval = data.profile.checkin_interval ?? "daily";
  const days = checkinDays(data.achievements ?? []);
  return { interval, ...checkinState(days, now, interval) };
}

const shortDate = (d: Date) => d.toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" });

export default function CheckinCard({ onDone }: { onDone?: () => void }) {
  const { data, now, awardBadges } = useFinance();
  const state = useCheckin();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const currency = data.profile.currency_code;
  const since = sinceLast(live(data.transactions), state.last);
  const sinceText = state.last ? t("since {date}", { date: shortDate(state.last) }) : t("so far");
  const flows = accountFlows(data, now);
  const accounts = live(data.accounts).map((a) => ({ id: a.id, name: a.name || t("Account"), value: num(a.balance) + (flows.get(a.id) ?? 0) }));
  const quickAdd = () => window.dispatchEvent(new Event("pf-quick-add"));

  const items = [
    {
      id: "expenses",
      title: t("All expenses entered"),
      hint: since.expenses === 1 ? t("1 expense entered {since}", { since: sinceText }) : t("{n} expenses entered {since}", { n: since.expenses, since: sinceText }),
      action: <button type="button" className="pf-chip" onClick={quickAdd}>{t("Add expense")}</button>,
    },
    {
      id: "income",
      title: t("All income entered"),
      hint: since.income === 1 ? t("1 income entered {since}", { since: sinceText }) : t("{n} incomes entered {since}", { n: since.income, since: sinceText }),
      action: <button type="button" className="pf-chip" onClick={quickAdd}>{t("Add income")}</button>,
    },
    {
      id: "accounts",
      title: t("Account balances match the bank"),
      hint: accounts.length ? accounts.slice(0, 3).map((a) => `${a.name} ${money(a.value, currency)}`).join(" · ") + (accounts.length > 3 ? " …" : "") : t("No accounts yet"),
      action: <Link href="/app/net-worth" className="pf-chip" onClick={onDone}>{t("Check balances")}</Link>,
    },
  ];
  const all = items.every((i) => ticked[i.id]);
  const confirm = async () => {
    if (!all || saving) return;
    setSaving(true);
    try {
      await awardBadges([{ code: `${CHECKIN_PREFIX}${dayKey(now)}`, points: CHECKIN_POINTS }]);
      setJustDone(true);
      setTimeout(() => onDone?.(), 1200);
    } finally {
      setSaving(false);
    }
  };

  const periodName = { daily: t("today"), "twice-weekly": t("this half-week"), weekly: t("this week") }[state.interval];

  if (state.done && !justDone) {
    return (
      <div className="pf-checkin pf-checkin-done">
        <CircleCheck size={20} />
        <span style={{ flex: 1 }}>
          <b>{t("Books up to date")}</b>
          <span>{t("Checked in {period} · through {date}", { period: periodName, date: shortDate(state.last ?? now) })}</span>
        </span>
        {state.streak > 1 && <span className="pf-checkin-streak"><Flame size={14} /> {state.streak}</span>}
      </div>
    );
  }

  return (
    <div className="pf-checkin" data-done={justDone}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: "1rem" }}>{t("Bring your books up to date")} <InfoTip id="checkin" /></b>
        <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)" }}>
          {state.last ? t("Last check-in {date}", { date: shortDate(state.last) }) : t("No check-in yet")}
          {state.streak > 0 && ` · ${t("{n} in a row", { n: state.streak })}`}
        </span>
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        {items.map((i, k) => (
          <div key={i.id} className="pf-checkin-item" data-on={!!ticked[i.id]} style={{ animationDelay: `${k * 70}ms` }}>
            <button
              type="button"
              role="checkbox"
              aria-checked={!!ticked[i.id]}
              aria-label={i.title}
              className="pf-checkin-box"
              onClick={() => setTicked((s) => ({ ...s, [i.id]: !s[i.id] }))}
            >
              <Check size={14} strokeWidth={3} />
            </button>
            <span style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setTicked((s) => ({ ...s, [i.id]: !s[i.id] }))}>
              <span className="pf-checkin-title">{i.title}</span>
              <span className="pf-checkin-hint">{i.hint}</span>
            </span>
            {i.action}
          </div>
        ))}
      </div>
      <button type="button" className="pf-checkin-go" disabled={!all || saving || justDone} onClick={confirm}>
        {justDone ? <><CircleCheck size={16} /> {t("+{n} points", { n: CHECKIN_POINTS })}</> : t("Up to date through {date} · +{n} points", { date: shortDate(now), n: CHECKIN_POINTS })}
      </button>
    </div>
  );
}
