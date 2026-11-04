"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Check, ChevronLeft, CircleCheck, Flame } from "lucide-react";
import { intlLocale, t } from "@/lib/i18n";
import { useFinance } from "@/components/finance/FinanceProvider";
import { accountFlows, live, num } from "@/lib/finance/calc";
import { CHECKIN_POINTS, CHECKIN_PREFIX, checkinDays, checkinState, dayKey, sinceLast, type CheckinInterval } from "@/lib/finance/checkin";
import { money } from "@/lib/finance/format";
import { parseNumber } from "@/lib/finance/amountExpr";
import { useTween } from "./charts";
import InfoTip from "@/components/finance/InfoTip";

// "Are my books up to date?" — a short checklist once per period (Settings ›
// Check-in), as story cards like Month Wrapped: one question per card, each
// in its own colour, with a big "Yes, that's right" that ticks it and moves
// on, and a way to fix it right there (add an expense or income, type the
// bank's balance for the current account, check the other balances). The
// last card sums up; confirming records a check-in (lib/finance/checkin) and
// earns bonus points on top of the daily visit. Segments along the top show
// which questions are ticked; tap one to go back to it.

export function useCheckin() {
  const { data, now } = useFinance();
  const interval: CheckinInterval = data.profile.checkin_interval ?? "daily";
  const days = checkinDays(data.achievements ?? []);
  return { interval, ...checkinState(days, now, interval) };
}

const shortDate = (d: Date) => d.toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" });

type Item = { id: string; kicker: string; title: string; big: ReactNode; hint: string; bg: string; action: ReactNode };

export default function CheckinCard({ onDone }: { onDone?: () => void }) {
  const { data, now, awardBadges, saveAccount } = useFinance();
  const state = useCheckin();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [at, setAt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const currency = data.profile.currency_code;
  const since = sinceLast(live(data.transactions), state.last);
  const sinceText = state.last ? t("since {date}", { date: shortDate(state.last) }) : t("so far");
  const flows = accountFlows(data, now);
  const accounts = live(data.accounts).map((a) => ({ id: a.id, name: a.name || t("Account"), value: num(a.balance) + (flows.get(a.id) ?? 0) }));
  // The current account: the default checking account, else the first one.
  const checkingAcct = live(data.accounts).filter((a) => a.type === "checking").sort((a, b) => Number(b.is_default) - Number(a.is_default))[0];
  const checking = checkingAcct && accounts.find((a) => a.id === checkingAcct.id);
  const others = accounts.filter((a) => a.id !== checking?.id);
  const [fixing, setFixing] = useState<string | null>(null);
  const quickAdd = () => window.dispatchEvent(new Event("pf-quick-add"));

  const items: Item[] = [
    {
      id: "expenses",
      kicker: t("Expenses"),
      title: t("All expenses entered"),
      big: <Count value={since.expenses} />,
      hint: since.expenses === 1 ? t("1 expense entered {since}", { since: sinceText }) : t("{n} expenses entered {since}", { n: since.expenses, since: sinceText }),
      bg: "linear-gradient(160deg, #8f1d4a 0%, #3d1027 55%, #0d0d14 100%)",
      action: <button type="button" className="pf-ck-alt" onClick={quickAdd}>{t("Add expense")}</button>,
    },
    {
      id: "income",
      kicker: t("Income"),
      title: t("All income entered"),
      big: <Count value={since.income} />,
      hint: since.income === 1 ? t("1 income entered {since}", { since: sinceText }) : t("{n} incomes entered {since}", { n: since.income, since: sinceText }),
      bg: "linear-gradient(160deg, #0f5c4a 0%, #0b2c26 55%, #0d0d14 100%)",
      action: <button type="button" className="pf-ck-alt" onClick={quickAdd}>{t("Add income")}</button>,
    },
    ...(checking ? [{
      id: "checking",
      kicker: checking.name,
      title: t("Current account balance still right?"),
      big: fixing === null ? <Count value={checking.value} currency={currency} /> : (
        <form className="pf-ck-fix" onSubmit={(e) => { e.preventDefault(); fixBalance(); }}>
          <input autoFocus inputMode="decimal" aria-label={t("Balance at the bank")} value={fixing} onChange={(e) => setFixing(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setFixing(null); }} />
          <button type="submit" className="pf-ck-yes">{t("Save")}</button>
        </form>
      ),
      hint: fixing === null ? t("In the app. Does your bank say the same?") : t("Type the balance your bank shows."),
      bg: "linear-gradient(160deg, #10427f 0%, #0c2340 55%, #0d0d14 100%)",
      action: fixing === null ? <button type="button" className="pf-ck-alt" onClick={() => setFixing(checking.value.toFixed(2).replace(".", ","))}>{t("Correct")}</button> : null,
    }] : []),
    {
      id: "accounts",
      kicker: t("Accounts"),
      title: checking && others.length ? t("Other balances match the bank") : t("Account balances match the bank"),
      big: (checking ? others : accounts).length ? (
        <span className="pf-ck-accts">
          {(checking ? others : accounts).slice(0, 4).map((a) => (
            <span key={a.id}><span>{a.name}</span><b className="pf-rounded">{money(a.value, currency)}</b></span>
          ))}
        </span>
      ) : null,
      hint: (checking ? others : accounts).length > 4 ? t("{n} more on Liquidity", { n: (checking ? others : accounts).length - 4 }) : accounts.length ? "" : t("No accounts yet"),
      bg: "linear-gradient(160deg, #6b4a0f 0%, #2e2109 55%, #0d0d14 100%)",
      action: <Link href="/app/net-worth" className="pf-ck-alt" onClick={onDone}>{t("Check balances")}</Link>,
    },
  ].filter((i) => i.id !== "accounts" || !checking || others.length > 0);

  const n = items.length;
  const all = items.every((i) => ticked[i.id]);
  const tick = (id: string) => {
    setTicked((s) => ({ ...s, [id]: true }));
    setAt((x) => Math.min(x + 1, n));
  };
  async function fixBalance() {
    if (!checkingAcct || fixing === null) return;
    const raw = fixing.trim().replace(/\s|€/g, "");
    const v0 = parseNumber(raw.replace(/^[-−]/, ""));
    if (v0 === null) return;
    const v = /^[-−]/.test(raw) ? -v0 : v0;
    setFixing(null);
    // The typed amount is today's balance: store its 1 January value.
    await saveAccount({ id: checkingAcct.id, name: checkingAcct.name, type: checkingAcct.type, balance: v - (flows.get(checkingAcct.id) ?? 0) }).catch((e: Error) => alert(e.message));
    tick("checking");
  }
  const confirm = async () => {
    if (!all || saving) return;
    setSaving(true);
    try {
      await awardBadges([{ code: `${CHECKIN_PREFIX}${dayKey(now)}`, points: CHECKIN_POINTS }]);
      setJustDone(true);
      setTimeout(() => onDone?.(), 1400);
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

  const item = items[at];
  const go = (k: number) => { setFixing(null); setAt(Math.min(Math.max(k, 0), n)); };
  return (
    <div className="pf-ck">
      <div className="pf-ck-head">
        <b>{t("Bring your books up to date")} <InfoTip id="checkin" /></b>
        <span>
          {state.last ? t("Last check-in {date}", { date: shortDate(state.last) }) : t("No check-in yet")}
          {state.streak > 0 && ` · ${t("{n} in a row", { n: state.streak })}`}
        </span>
      </div>
      <div className="pf-wr-segs pf-ck-segs">
        {[...items.map((i) => i.id), "done"].map((id, k) => (
          <button key={id} type="button" aria-label={k < n ? items[k].title : t("Up to date")} data-state={k === at ? "now" : ticked[id] ? "done" : "next"} onClick={() => go(k)}>
            <i />
          </button>
        ))}
      </div>
      {item ? (
        <div key={item.id} className="pf-wr-card pf-ck-card" style={{ background: item.bg }}>
          <div className="pf-wr-body">
            <span className="pf-wr-kicker">{t("{n} of {total}", { n: at + 1, total: n })} · {item.kicker}</span>
            <h3 className="pf-wr-title">{item.title}</h3>
            {item.big && <div className="pf-ck-big">{item.big}</div>}
            {item.hint && <p className="pf-wr-line pf-wr-dim">{item.hint}</p>}
          </div>
          <div className="pf-ck-actions">
            {at > 0 && <button type="button" className="pf-ck-back" aria-label={t("Previous")} onClick={() => go(at - 1)}><ChevronLeft size={18} /></button>}
            {item.action}
            {fixing === null && (
              <button type="button" className="pf-ck-yes" data-on={!!ticked[item.id]} onClick={() => tick(item.id)}>
                <Check size={16} strokeWidth={3} /> {t("Yes, that's right")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div key="done" className="pf-wr-card pf-ck-card" data-done={justDone} style={{ background: "linear-gradient(160deg, #3b1d8f 0%, #1a1240 55%, #0d0d14 100%)" }}>
          <div className="pf-wr-body">
            <span className="pf-wr-kicker">{t("Check-in")}</span>
            <h3 className="pf-wr-title">{justDone ? t("Books up to date") : all ? t("All set.") : t("Almost there.")}</h3>
            <div className="pf-ck-list">
              {items.map((i, k) => (
                <button key={i.id} type="button" data-on={!!ticked[i.id]} onClick={() => go(k)}>
                  <span className="pf-ck-dot"><Check size={12} strokeWidth={3.4} /></span>
                  {i.title}
                </button>
              ))}
            </div>
          </div>
          <div className="pf-ck-actions">
            <button type="button" className="pf-ck-back" aria-label={t("Previous")} onClick={() => go(n - 1)}><ChevronLeft size={18} /></button>
            <button type="button" className="pf-checkin-go" disabled={!all || saving || justDone} onClick={confirm}>
              {justDone ? <><CircleCheck size={16} /> {t("+{n} points", { n: CHECKIN_POINTS })}</> : t("Up to date through {date} · +{n} points", { date: shortDate(now), n: CHECKIN_POINTS })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A figure that counts up as its card comes in. */
function Count({ value, currency }: { value: number; currency?: string }) {
  const [v] = useTween([value], 900);
  return <span className="pf-rounded">{currency ? money(v, currency) : Math.round(v)}</span>;
}
