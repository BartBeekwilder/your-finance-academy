"use client";

import { newHousehold } from "@/lib/finance/household";
import { t, intlLocale } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Car, Check, Clock, HeartPulse, House, Layers, Plane, Plus, ShieldCheck, Sofa, Sparkles, X, Zap, type LucideIcon } from "lucide-react";
import { live, summarize } from "@/lib/finance/calc";
import { budgetIn } from "@/lib/finance/budgetPlan";
import { currencyName } from "@/lib/finance/currencies";
import { money } from "@/lib/finance/format";
import { payoff } from "@/lib/finance/loans";
import { MIN_PASSPHRASE } from "@/lib/finance/vault";
import BrandMark from "./BrandMark";
import OnboardingProgress from "./OnboardingProgress";
import OnboardingReveal from "./OnboardingReveal";
import LanguagePicker from "./LanguagePicker";
import { LOAN_KINDS, LOAN_STYLE } from "./loanKinds";
import { CHAPTERS, nodesFor, stepsFor, type Route, type Step } from "./onboardingRoutes";
import type { AssetType, InsurancePolicy, LoanKind } from "@/lib/finance/types";
import { useTween } from "./charts";
import CategoryIcon from "./CategoryIcon";
import { useFinance } from "./FinanceProvider";

// Onboarding — "open your books". After the welcome you pick a route:
//   • Quick start (2 minutes): currency, household, income, accounts and
//     fixed costs; budgets are suggested from the income.
//   • Complete setup (about 10 minutes): eight chapters — basics, income,
//     money now (accounts + investments), fixed costs and insurance, home
//     and debts (loans with rate and payment), budgets and a savings goal,
//     history, and security (check-in rhythm, an optional passphrase).
// One question per screen, a journey bar on top (steps or chapters), and a
// live preview beside it (wide screens) that builds the month as you answer.
// Everything can be skipped. Where you are is remembered on this device
// (stop halfway, carry on later). The finale opens the books as story cards.
// A quick start can be finished later from the dashboard ("Finish your
// setup"), which opens the complete route at the first open chapter.
//
// `preview` (the draft for review): nothing is saved — the finale says so,
// and the dashboard's "Finish your setup" card shows for this browser tab.
// Otherwise finishing writes only what was answered.

const CURRENCIES = [
  { code: "EUR", name: "Euro" },
  { code: "USD", name: "US dollar" },
  { code: "GBP", name: "British pound" },
  { code: "CHF", name: "Swiss franc" },
  { code: "SEK", name: "Swedish krona" },
  { code: "JPY", name: "Japanese yen" },
];

type Line = { key: string; name: string; icon: string; color: string; amount: string; on: boolean };

const FIXED: Omit<Line, "amount" | "on">[] = [
  { key: "rent", name: "Rent or mortgage", icon: "house.fill", color: "2F6690" },
  { key: "utilities", name: "Energy & water", icon: "bolt.fill", color: "6D4C41" },
  { key: "insurance", name: "Insurance", icon: "cross.case.fill", color: "E63946" },
  { key: "internet", name: "Internet & phone", icon: "phone.fill", color: "0A84FF" },
  { key: "subscriptions", name: "Subscriptions", icon: "tv.fill", color: "BF5AF2" },
  { key: "transport", name: "Car or transit pass", icon: "car.fill", color: "F3A712" },
];

/** Variable budgets, suggested as a share of net income. */
const BUDGETS: (Omit<Line, "amount" | "on"> & { share: number })[] = [
  { key: "Groceries", name: "Groceries", icon: "cart.fill", color: "2E8B57", share: 0.11 },
  { key: "Dining Out", name: "Dining out", icon: "fork.knife", color: "E4572E", share: 0.04 },
  { key: "Transport", name: "Transport", icon: "car.fill", color: "F3A712", share: 0.04 },
  { key: "Shopping", name: "Shopping", icon: "bag.fill", color: "9B5DE5", share: 0.05 },
  { key: "Entertainment", name: "Entertainment", icon: "film.fill", color: "D64584", share: 0.02 },
  { key: "Health", name: "Health", icon: "cross.case.fill", color: "E63946", share: 0.015 },
];

/** The policies most people have; premiums per month. */
const POLICIES: { kind: InsurancePolicy["kind"]; label: string; Icon: LucideIcon; color: string }[] = [
  { kind: "health", label: "Health", Icon: HeartPulse, color: "#ff375f" },
  { kind: "liability", label: "Liability", Icon: ShieldCheck, color: "#40c8e0" },
  { kind: "contents", label: "Contents", Icon: Sofa, color: "#bf5af2" },
  { kind: "home", label: "Home", Icon: House, color: "#0a84ff" },
  { kind: "car", label: "Car", Icon: Car, color: "#ff9f0a" },
  { kind: "travel", label: "Travel", Icon: Plane, color: "#30d158" },
];

const ASSETS: { type: AssetType; label: string }[] = [
  { type: "stock", label: "Stock" },
  { type: "crypto", label: "Crypto" },
  { type: "metal", label: "Metal" },
];

const one = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};
/** An amount as typed; several added up with "+" (40 + 24 → 64), so one
 *  category can hold more than one bill. */
const num = (s: string) => s.split("+").reduce((t, part) => t + one(part), 0);

/** An amount field that shows the total under it when several amounts are
 *  added up ("40+24" → "= € 64,00"). */
function AmountField({ value, onChange, label, currency, autoFocus }: { value: string; onChange: (v: string) => void; label: string; currency: string; autoFocus?: boolean }) {
  const sum = value.includes("+") ? num(value) : null;
  return (
    <span className="pf-ob-amountwrap">
      <input className="pf-input pf-ob-amount" inputMode="decimal" autoFocus={autoFocus} placeholder={money(0, currency)} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      {sum !== null && <span key={sum} className="pf-ob-sum pf-rounded">= {money(sum, currency)}</span>}
    </span>
  );
}

/** Where the setup stands on this device, so it can be picked up again. */
type Draft = {
  route: Route | null;
  step: Step;
  answered: Step[];
  currency: string;
  net: string;
  gross: string;
  payday: number;
  together: boolean;
  names: [string, string];
  accounts: { key: string; name: string; type: "checking" | "savings"; amount: string }[];
  investments: { key: string; name: string; type: AssetType; amount: string }[];
  fixed: Line[];
  policies: { kind: InsurancePolicy["kind"]; premium: string; on: boolean }[];
  budgets: Line[] | null;
  goal: { name: string; amount: string; months: number };
  home: { value: string; mortgage: string };
  loans: { key: string; kind: LoanKind; name: string; amount: string; rate: string; monthly: string }[];
  history: "now" | "january" | "years";
  checkin: "daily" | "twice-weekly" | "weekly";
};

const DRAFT_KEY = (preview: boolean) => (preview ? "pf-onboarding-preview-draft" : "pf-onboarding-draft");
/** The preview's "finished" state for this tab (the dashboard card reads it). */
export const PREVIEW_DONE = "pf-onboarding-preview";

function readDraft(preview: boolean): Partial<Draft> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(preview));
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}

export default function Onboarding({ preview, resume, onClose }: { preview: boolean; resume?: boolean; onClose: () => void }) {
  const { data, now, source, updateProfile, saveAccount, setBudget, addCategory, addTransaction, addBalanceItem, saveLoan, addHolding, savePolicy, saveGoal, setPassphrase } = useFinance();
  // A quick start being finished: the complete route, from the first
  // chapter that's still open; otherwise where this device left off.
  const finished = useMemo<string[]>(() => {
    if (!resume) return [];
    if (preview) {
      try {
        return (JSON.parse(sessionStorage.getItem(PREVIEW_DONE) ?? "{}") as { steps?: string[] }).steps ?? [];
      } catch {
        return [];
      }
    }
    return data.profile.onboarding?.steps ?? [];
  }, [resume, preview, data.profile.onboarding]);
  const [saved0] = useState(() => (resume ? null : readDraft(preview)));
  const d0 = saved0 ?? {};
  const [route, setRoute] = useState<Route | null>(resume ? "complete" : d0.route ?? null);
  const [step, setStep] = useState<Step>(() => {
    if (resume) return stepsFor("complete").find((s) => !["welcome", "route"].includes(s) && !finished.includes(s)) ?? "done";
    return d0.step ?? "welcome";
  });
  const [answered, setAnswered] = useState<Step[]>(d0.answered ?? []);
  const [dir, setDir] = useState<1 | -1>(1);
  const [currency, setCurrency] = useState(d0.currency ?? (data.profile.currency_code || "EUR"));
  // Income and payday start from the profile (continuing a quick start, or
  // set up before), so the goal and the finale know them.
  const [net, setNet] = useState(d0.net ?? (data.profile.expected_net_monthly ? String(Number(data.profile.expected_net_monthly)) : ""));
  const [gross, setGross] = useState(d0.gross ?? "");
  const [payday, setPayday] = useState(d0.payday ?? data.profile.payday_day ?? 25);
  // Who keeps these books: just me, or two people (incomes per person,
  // expenses paid by one or shared).
  const [together, setTogether] = useState(d0.together ?? (data.profile.household ?? []).length >= 2);
  const [names, setNames] = useState<[string, string]>(d0.names ?? [data.profile.household?.[0]?.name ?? t("Me"), data.profile.household?.[1]?.name ?? t("Partner")]);
  const [accounts, setAccounts] = useState<Draft["accounts"]>(d0.accounts ?? [
    { key: "checking", name: t("Current account"), type: "checking", amount: "" },
    { key: "savings", name: t("Savings"), type: "savings", amount: "" },
  ]);
  const [investments, setInvestments] = useState<Draft["investments"]>(d0.investments ?? []);
  const [fixed, setFixed] = useState<Line[]>(d0.fixed ?? FIXED.map((f) => ({ ...f, amount: "", on: false })));
  const [policies, setPolicies] = useState<Draft["policies"]>(d0.policies ?? POLICIES.map((p) => ({ kind: p.kind, premium: "", on: false })));
  const [budgets, setBudgets] = useState<Line[] | null>(d0.budgets ?? null);
  const [goal, setGoal] = useState(d0.goal ?? { name: "", amount: "", months: 12 });
  const [home, setHome] = useState(d0.home ?? { value: "", mortgage: "" });
  // Other loans, each with its kind and a name; the complete route also asks
  // the rate and the monthly payment (then the debt goes down by itself).
  const [loans, setLoans] = useState<Draft["loans"]>(d0.loans ?? []);
  const [history, setHistory] = useState<Draft["history"]>(d0.history ?? "now");
  const [checkin, setCheckin] = useState<Draft["checkin"]>(d0.checkin ?? data.profile.checkin_interval ?? "twice-weekly");
  // Security: an optional passphrase (never stored in the draft).
  const [protect, setProtect] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const steps = stepsFor(route ?? "complete");
  const index = steps.indexOf(step);
  const netIncome = num(net);
  // Budgets are suggested once income is known; edits stay.
  const budgetLines = budgets ?? BUDGETS.map((b) => ({ ...b, amount: netIncome ? String(Math.round((netIncome * b.share) / 10) * 10) : "", on: true }));

  const totals = useMemo(() => {
    const fixedTotal = fixed.filter((f) => f.on).reduce((s, f) => s + num(f.amount), 0);
    const budgetTotal = budgetLines.filter((b) => b.on).reduce((s, b) => s + num(b.amount), 0);
    const cash = accounts.reduce((s, a) => s + num(a.amount), 0);
    const invested = investments.reduce((s, x) => s + num(x.amount), 0);
    const equity = cash + invested + num(home.value) - num(home.mortgage) - loans.reduce((s, l) => s + num(l.amount), 0);
    return { fixedTotal, budgetTotal, left: netIncome - fixedTotal - budgetTotal, cash, equity };
  }, [fixed, budgetLines, accounts, investments, home, loans, netIncome]);

  // Remember where the setup stands on this device.
  useEffect(() => {
    if (saved || resume) return;
    const draft: Draft = { route, step, answered, currency, net, gross, payday, together, names, accounts, investments, fixed, policies, budgets, goal, home, loans, history, checkin };
    try {
      localStorage.setItem(DRAFT_KEY(preview), JSON.stringify(draft));
    } catch {}
  }, [route, step, answered, currency, net, gross, payday, together, names, accounts, investments, fixed, policies, budgets, goal, home, loans, history, checkin, saved, resume, preview]);

  const goTo = (to: Step, d: 1 | -1) => {
    setDir(d);
    setStep(to);
  };
  const go = (d: 1 | -1) => {
    // Continuing a quick start, the questions answered then are passed by
    // (the journey bar can still go back to them).
    let i = index + d;
    while (i > 0 && i < steps.length - 1 && finished.includes(steps[i])) i += d;
    if (resume && i <= 1) return;
    goTo(steps[Math.min(Math.max(i, 0), steps.length - 1)], d);
  };
  const next = () => {
    if (!["welcome", "route", "done"].includes(step) && !answered.includes(step)) setAnswered([...answered, step]);
    go(1);
  };
  const pickRoute = (r: Route) => {
    setRoute(r);
    setDir(1);
    setStep(stepsFor(r)[2]);
  };

  // Enter continues; Escape closes.
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saved) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && step !== "done" && step !== "route") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    card.current?.querySelector<HTMLInputElement>(".pf-ob-step input")?.focus({ preventScroll: true });
  }, [step]);

  // The finale's figures: what was answered now, and — for what was set up
  // before (continuing a quick start) — the books as they are.
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const before = (s: Step) => finished.includes(s) && !answered.includes(s);
  const bookFixed = before("fixed") ? summarize(live(data.transactions), thisMonth).fixed : 0;
  const bookBudgets = !answered.includes("budgets") && finished.length
    ? live(data.categories).filter((c) => !c.parent_id && !c.is_income_category && !c.is_fixed_expense).reduce((s, c) => s + (budgetIn(live(data.budgets), c.id, thisMonth) ?? 0), 0)
    : 0;
  const bookCash = before("accounts") ? live(data.accounts).filter((a) => a.type !== "investment").reduce((s, a) => s + Number(a.balance), 0) : 0;
  const reveal = {
    income: netIncome,
    fixed: totals.fixedTotal + bookFixed,
    budgets: (answered.includes("budgets") || !finished.length ? totals.budgetTotal : 0) + bookBudgets,
    cash: totals.cash + bookCash,
  };
  // The last loan's payoff month when loans have a payment.
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const debtFree = loans.reduce<Date | null>((latest, l) => {
    if (!(num(l.amount) > 0 && num(l.monthly) > 0)) return latest;
    const p = payoff({ balance: num(l.amount).toFixed(2), rate: num(l.rate).toFixed(2), monthly: num(l.monthly).toFixed(2), start_date: today }, now);
    return p && (!latest || p.date > latest) ? p.date : latest;
  }, null);

  async function finish() {
    if (protect && (pass.length < MIN_PASSPHRASE || pass !== pass2)) {
      setError(pass.length < MIN_PASSPHRASE ? t("Use at least {n} characters.", { n: MIN_PASSPHRASE }) : t("The two passphrases are not the same."));
      return;
    }
    const done = [...new Set([...finished, ...answered])];
    if (preview) {
      try {
        sessionStorage.setItem(PREVIEW_DONE, JSON.stringify({ route: resume ? "complete" : route, steps: done }));
        localStorage.removeItem(DRAFT_KEY(preview));
      } catch {}
      setSaved(true);
      return;
    }
    setSaving(true);
    setError("");
    const has = (s: Step) => answered.includes(s);
    try {
      const month = new Date(now.getFullYear(), now.getMonth(), 1);
      await updateProfile({
        ...(has("currency") ? { currency_code: currency } : {}),
        ...(has("income") ? { expected_net_monthly: netIncome ? netIncome.toFixed(2) : null, expected_gross_monthly: num(gross) ? num(gross).toFixed(2) : null, payday_day: payday } : {}),
        ...(has("household") ? { household: together ? newHousehold(names[0].trim() || t("Me"), names[1].trim() || t("Partner"), () => crypto.randomUUID()) : [] } : {}),
        ...(has("security") ? { checkin_interval: checkin } : {}),
        onboarding: { route: route === "quick" && !resume ? "quick" : "complete", steps: done },
      });
      if (has("accounts")) {
        const def = live(data.accounts).find((a) => a.is_default);
        for (const a of accounts) {
          if (!num(a.amount) && a.type !== "checking") continue;
          await saveAccount({ id: a.type === "checking" ? def?.id : undefined, name: a.name, type: a.type, balance: num(a.amount) });
        }
      }
      if (has("investments")) {
        for (const x of investments.filter((x) => num(x.amount) > 0)) {
          await addHolding({ symbol: "", name: x.name.trim() || t(ASSETS.find((a) => a.type === x.type)!.label), asset_type: x.type, quantity: "1", cost_basis: num(x.amount).toFixed(2), cost_basis_currency: currency, date_added: new Date().toISOString() });
        }
      }
      const cats = live(data.categories);
      const categoryFor = async (name: string, icon: string, color: string, isFixed: boolean) =>
        cats.find((c) => c.name.toLowerCase() === name.toLowerCase() && !c.parent_id) ??
        (await addCategory({ name, icon, color_hex: color, is_income_category: false, is_fixed_expense: isFixed }));
      if (has("fixed")) {
        for (const f of fixed.filter((f) => f.on && num(f.amount) > 0)) {
          const c = await categoryFor(t(f.name), f.icon, f.color, true);
          await setBudget(c.id, month, num(f.amount));
          await addTransaction({
            amount: num(f.amount).toFixed(2), type: "expense", date: new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString(),
            note: f.name, is_auto_income: false, is_fixed_expense: true, recurrence_id: crypto.randomUUID(), category_id: c.id, account_id: null,
          });
        }
      }
      if (has("insurance")) {
        for (const [i, p] of policies.filter((p) => p.on && num(p.premium) > 0).entries()) {
          const style = POLICIES.find((x) => x.kind === p.kind)!;
          await savePolicy({ kind: p.kind, name: t(style.label), insurer: "", premium: num(p.premium).toFixed(2), period: "month", deductible: "0.00", coverage: null, start_date: null, renewal_date: null, notice_months: 1, notes: "", sort_order: i });
        }
      }
      // Budgets: answered in the complete route, suggested in the quick one.
      if (has("budgets") || (route === "quick" && has("income"))) {
        for (const b of budgetLines.filter((b) => b.on && num(b.amount) > 0)) {
          const c = await categoryFor(b.key, b.icon, b.color, false);
          await setBudget(c.id, month, num(b.amount));
        }
      }
      if (has("goal") && num(goal.amount) > 0) {
        const by = new Date(now.getFullYear(), now.getMonth() + goal.months, 1);
        await saveGoal({ kind: "save", name: goal.name.trim() || t("Savings goal"), target: num(goal.amount).toFixed(2), start_value: totals.cash.toFixed(2), target_date: `${by.getFullYear()}-${String(by.getMonth() + 1).padStart(2, "0")}-01`, category_id: null, achieved_at: null, sort_order: 0 });
      }
      if (has("balance")) {
        if (num(home.value)) await addBalanceItem({ name: t("Home"), side: "asset", value: num(home.value) });
        if (num(home.mortgage)) await addBalanceItem({ name: t("Mortgage"), side: "liability", value: num(home.mortgage) });
        for (const [i, l] of loans.filter((l) => num(l.amount) > 0).entries()) {
          await saveLoan({ kind: l.kind, name: l.name.trim() || t(LOAN_STYLE[l.kind].label), balance: num(l.amount).toFixed(2), rate: num(l.rate).toFixed(2), monthly: num(l.monthly).toFixed(2), start_date: today, sort_order: i });
        }
      }
      if (has("security") && protect && source === "vault") await setPassphrase(pass);
      try {
        localStorage.removeItem(DRAFT_KEY(preview));
      } catch {}
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const nodes = nodesFor(route ?? "complete");

  return (
    <div className="pf-ob" role="dialog" aria-modal="true" aria-label={t("Set up your finances")}>
      <div className="pf-ob-glow" />
      <button className="pf-ob-close pf-icon-button" aria-label={t("Close")} onClick={onClose}>
        <X size={18} />
      </button>

      <div className="pf-ob-layout">
        <div className="pf-ob-card" ref={card}>
          <OnboardingProgress nodes={nodes} chapters={route !== "quick"} step={step} onPick={(to) => goTo(to, -1)} />
          {preview && <div className="pf-ob-draft">{t("Draft · preview — nothing is saved")}</div>}

          {saved ? (
            <OnboardingReveal
              f={{ ...reveal, left: reveal.income - reveal.fixed - reveal.budgets, equity: totals.equity + bookCash, debtFree }}
              currency={currency}
              openLabel={preview ? t("Close preview") : t("Open my dashboard")}
              onOpen={onClose}
            />
          ) : (
            <>
          <div key={step} className="pf-ob-step" data-dir={dir}>
            {step === "welcome" && (
              <Screen>
                <div className="pf-ob-welcome-top">
                  <div className="pf-ob-mark">
                    <BrandMark size={72} currency={currency} />
                  </div>
                  <LanguagePicker align="end" />
                </div>
                <h1>{t("Run your money like a business.")}</h1>
                <p>{t("A few questions and your books are open: what comes in, what goes out, what you own and what you owe. You can skip anything, and pick up where you left off.")}</p>
              </Screen>
            )}

            {step === "route" && (
              <Screen title={t("How do you want to start?")} hint={t("You can always fill in the rest later — the dashboard keeps your place.")}>
                <div className="pf-ob-routes">
                  <button className="pf-ob-route" data-route="quick" aria-pressed={route === "quick"} onClick={() => pickRoute("quick")}>
                    <span className="pf-ob-route-icon"><Zap size={20} /></span>
                    <b>{t("Quick start")}</b>
                    <span className="pf-ob-route-time"><Clock size={13} /> {t("About 2 minutes")}</span>
                    <small>{t("Your income, your accounts and your fixed costs — budgets are suggested for you.")}</small>
                    <span className="pf-ob-route-chips" aria-hidden>
                      {nodesFor("quick").map((n, i) => <i key={n.id} style={{ ["--i" as string]: i }}><n.icon size={12} /></i>)}
                    </span>
                  </button>
                  <button className="pf-ob-route" data-route="complete" aria-pressed={route === "complete"} onClick={() => pickRoute("complete")}>
                    <span className="pf-ob-route-icon"><Layers size={20} /></span>
                    <b>{t("Complete setup")}</b>
                    <span className="pf-ob-route-time"><Clock size={13} /> {t("About 10 minutes")}</span>
                    <small>{t("Everything at once: investments, insurance, loans with rate and payment, goals and your history.")}</small>
                    <span className="pf-ob-route-chips" aria-hidden>
                      {CHAPTERS.map((n, i) => <i key={n.id} style={{ ["--i" as string]: i }}><n.icon size={12} /></i>)}
                    </span>
                  </button>
                </div>
              </Screen>
            )}

            {step === "currency" && (
              <Screen title={t("Which currency do you use?")} hint={t("Change it any time in Settings.")}>
                <div className="pf-ob-grid">
                  {CURRENCIES.map((c) => (
                    <button key={c.code} className="pf-ob-choice" aria-pressed={currency === c.code} onClick={() => setCurrency(c.code)}>
                      <BrandMark size={34} currency={c.code} />
                      <span>
                        <b>{c.code}</b>
                        <small>{currencyName(c.code, intlLocale(), c.name)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </Screen>
            )}

            {step === "household" && (
              <Screen title={t("Who are these books for?")} hint={t("Together, each income is someone's and each expense is paid by one of you or shared — and every chart can show it per person.")}>
                <div className="pf-ob-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                  <button className="pf-ob-choice" aria-pressed={!together} onClick={() => setTogether(false)}>
                    <span className="pf-ob-ppl">1</span>
                    <span><b>{t("Just me")}</b><small>{t("One income, one person")}</small></span>
                  </button>
                  <button className="pf-ob-choice" aria-pressed={together} onClick={() => setTogether(true)}>
                    <span className="pf-ob-ppl">2</span>
                    <span><b>{t("The two of us")}</b><small>{t("Two incomes, shared costs")}</small></span>
                  </button>
                </div>
                {together && (
                  <div className="pf-ob-row2">
                    {[0, 1].map((i) => (
                      <label key={i} className="pf-ob-field">
                        <span>{i === 0 ? t("Your name") : t("Partner's name")}</span>
                        <input className="pf-input" value={names[i]} onChange={(e) => setNames((n) => (i === 0 ? [e.target.value, n[1]] : [n[0], e.target.value]))} />
                      </label>
                    ))}
                  </div>
                )}
              </Screen>
            )}

            {step === "income" && (
              <Screen title={t("What comes in each month?")} hint={t("Your net salary — what lands in your account. The live tiles count it up through the month.")}>
                <BigAmount label={t("Net per month")} value={net} onChange={setNet} currency={currency} autoFocus />
                <div className="pf-ob-row2">
                  <label className="pf-ob-field">
                    <span>{t("Payday")}</span>
                    <div className="pf-ob-days">
                      {[1, 15, 20, 23, 25, 28].map((d) => (
                        <button key={d} aria-pressed={payday === d} onClick={() => setPayday(d)}>
                          {d}
                        </button>
                      ))}
                      <input inputMode="numeric" aria-label={t("Other day")} value={[1, 15, 20, 23, 25, 28].includes(payday) ? "" : String(payday)} placeholder="…" onChange={(e) => setPayday(Math.min(Math.max(Number(e.target.value) || 25, 1), 31))} />
                    </div>
                  </label>
                  <label className="pf-ob-field">
                    <span>{t("Gross per month (optional)")}</span>
                    <input className="pf-input" inputMode="decimal" placeholder={money(0, currency)} value={gross} onChange={(e) => setGross(e.target.value)} />
                  </label>
                </div>
              </Screen>
            )}

            {step === "accounts" && (
              <Screen title={t("What's in your accounts today?")} hint={t("Your starting point. From here every month adds what you saved.")}>
                <div className="pf-ob-list">
                  {accounts.map((a, i) => (
                    <div key={a.key} className="pf-ob-line">
                      <input className="pf-ob-name" value={a.name} aria-label={t("Account name")} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <AmountField currency={currency} value={a.amount} label={t("{name} balance", { name: a.name })} onChange={(v) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                    </div>
                  ))}
                  <button className="pf-bal-add" onClick={() => setAccounts([...accounts, { key: crypto.randomUUID(), name: t("Another account"), type: "savings", amount: "" }])}>
                    <Plus size={13} /> {t("Add account")}
                  </button>
                </div>
              </Screen>
            )}

            {step === "investments" && (
              <Screen title={t("Do you invest?")} hint={t("Funds, shares, crypto or gold — what each is worth today. Live prices can be added later under Investments.")}>
                <div className="pf-ob-list">
                  {investments.map((x, i) => {
                    const set = (patch: Partial<typeof x>) => setInvestments(investments.map((y, j) => (j === i ? { ...y, ...patch } : y)));
                    return (
                      <div key={x.key} className="pf-ob-line">
                        <span className="pf-ob-seg" role="radiogroup" aria-label={t("Kind")}>
                          {ASSETS.map((a) => (
                            <button key={a.type} type="button" role="radio" aria-checked={x.type === a.type} onClick={() => set({ type: a.type })}>{t(a.label)}</button>
                          ))}
                        </span>
                        <input className="pf-ob-name" value={x.name} placeholder={t("Name")} aria-label={t("Name")} onChange={(e) => set({ name: e.target.value })} />
                        <AmountField currency={currency} value={x.amount} label={t("Worth today")} onChange={(v) => set({ amount: v })} />
                        <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={() => setInvestments(investments.filter((_, j) => j !== i))}><X size={14} /></button>
                      </div>
                    );
                  })}
                  <button type="button" className="pf-bal-add" onClick={() => setInvestments([...investments, { key: crypto.randomUUID(), name: "", type: "stock", amount: "" }])}>
                    <Plus size={13} /> {t("Add investment")}
                  </button>
                </div>
              </Screen>
            )}

            {step === "fixed" && (
              <Screen title={t("Your fixed costs")} hint={`${t("The same every month. Tap what you have and fill in the amount — they become this month's fixed costs and budgets.")} ${t("Several bills in one? Add them up with +, like 40+24.")}`}>
                <div className="pf-ob-list">
                  {fixed.map((f, i) => (
                    <div key={f.key} className="pf-ob-line" data-on={f.on}>
                      <button className="pf-ob-toggle" aria-pressed={f.on} onClick={() => setFixed(fixed.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}>
                        <CategoryIcon icon={f.icon} colorHex={f.on ? f.color : "3a3a3c"} size={30} />
                        <span>{t(f.name)}</span>
                        {f.on && <Check size={14} className="pf-ob-check" />}
                      </button>
                      {f.on && (
                        <AmountField autoFocus currency={currency} value={f.amount} label={t("{name} per month", { name: t(f.name) })} onChange={(v) => setFixed(fixed.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                      )}
                    </div>
                  ))}
                </div>
              </Screen>
            )}

            {step === "insurance" && (
              <Screen title={t("Which insurance do you have?")} hint={t("Tap each policy and fill in the premium per month — the Insurance page checks your cover and keeps track of renewals.")}>
                <div className="pf-ob-list">
                  {policies.map((p, i) => {
                    const S = POLICIES.find((x) => x.kind === p.kind)!;
                    return (
                      <div key={p.kind} className="pf-ob-line" data-on={p.on}>
                        <button className="pf-ob-toggle" aria-pressed={p.on} onClick={() => setPolicies(policies.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}>
                          <span className="pf-ob-loankind" style={{ ["--c" as string]: p.on ? S.color : "#636366" }}><S.Icon size={16} /></span>
                          <span>{t(S.label)}</span>
                          {p.on && <Check size={14} className="pf-ob-check" />}
                        </button>
                        {p.on && <AmountField autoFocus currency={currency} value={p.premium} label={t("{name} per month", { name: t(S.label) })} onChange={(v) => setPolicies(policies.map((x, j) => (j === i ? { ...x, premium: v } : x)))} />}
                      </div>
                    );
                  })}
                </div>
              </Screen>
            )}

            {step === "balance" && (
              <Screen title={t("Your home and debts")} hint={t("Optional — it goes on your balance sheet. Mortgage details can be added under Real estate.")}>
                <div className="pf-ob-list">
                  <Labeled label={t("Home value (WOZ or estimate)")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={home.value} onChange={(e) => setHome({ ...home, value: e.target.value })} /></Labeled>
                  <Labeled label={t("Mortgage remaining")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={home.mortgage} onChange={(e) => setHome({ ...home, mortgage: e.target.value })} /></Labeled>
                </div>
                <div className="pf-ob-list">
                  <span className="pf-ob-sublabel">{t("Other loans")}</span>
                  {loans.map((l, i) => {
                    const S = LOAN_STYLE[l.kind];
                    const set = (patch: Partial<typeof l>) => setLoans(loans.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <div key={l.key} className="pf-ob-loanrow">
                        <div className="pf-ob-line pf-ob-loan">
                          {/* Tap to go through the kinds: study, car, personal… */}
                          <button type="button" className="pf-ob-loankind" style={{ ["--c" as string]: S.color }} title={t(S.label)} aria-label={t(S.label)} onClick={() => set({ kind: LOAN_KINDS[(LOAN_KINDS.indexOf(l.kind) + 1) % LOAN_KINDS.length] })}>
                            <S.Icon key={l.kind} size={16} />
                          </button>
                          <input className="pf-ob-name" value={l.name} placeholder={t(S.label)} aria-label={t("Name")} onChange={(e) => set({ name: e.target.value })} />
                          <AmountField currency={currency} value={l.amount} label={t("Left now")} onChange={(v) => set({ amount: v })} />
                          <button type="button" className="pf-icon-button" aria-label={t("Remove loan")} onClick={() => setLoans(loans.filter((_, j) => j !== i))}>
                            <X size={14} />
                          </button>
                        </div>
                        {route === "complete" && (
                          <div className="pf-ob-loanterms">
                            <label>{t("Interest rate (%)")}<input className="pf-input" inputMode="decimal" placeholder="0" value={l.rate} onChange={(e) => set({ rate: e.target.value })} /></label>
                            <label>{t("Monthly payment")}<input className="pf-input" inputMode="decimal" placeholder={money(0, currency)} value={l.monthly} onChange={(e) => set({ monthly: e.target.value })} /></label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" className="pf-bal-add" onClick={() => setLoans([...loans, { key: crypto.randomUUID(), kind: loans.length ? "car" : "student", name: "", amount: "", rate: "", monthly: "" }])}>
                    <Plus size={13} /> {t("Add loan")}
                  </button>
                  {loans.length > 0 && route !== "complete" && <span className="pf-unlock-hint">{t("Interest and the monthly payment can be added later under Loans — then the debt goes down by itself.")}</span>}
                </div>
              </Screen>
            )}

            {step === "budgets" && (
              <Screen title={t("Budgets for the rest")} hint={netIncome ? t("Suggested from your income — adjust them, or switch off what you don't need.") : t("Set a monthly limit for each, or switch off what you don't need.")}>
                <div className="pf-ob-list">
                  {budgetLines.map((b, i) => (
                    <div key={b.key} className="pf-ob-line" data-on={b.on}>
                      <button className="pf-ob-toggle" aria-pressed={b.on} onClick={() => setBudgets(budgetLines.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}>
                        <CategoryIcon icon={b.icon} colorHex={b.on ? b.color : "3a3a3c"} size={30} />
                        <span>{t(b.name)}</span>
                      </button>
                      {b.on && (
                        <AmountField currency={currency} value={b.amount} label={t("{name} budget", { name: t(b.name) })} onChange={(v) => setBudgets(budgetLines.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                      )}
                    </div>
                  ))}
                </div>
              </Screen>
            )}

            {step === "goal" && (
              <Screen title={t("What are you saving for?")} hint={t("A goal on your Progress page, with what you need to put aside each month.")}>
                <div className="pf-ob-list">
                  <Labeled label={t("Name")}><input className="pf-input pf-ob-amount" placeholder={t("Emergency fund")} value={goal.name} onChange={(e) => setGoal({ ...goal, name: e.target.value })} /></Labeled>
                  <Labeled label={t("Target")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={goal.amount} onChange={(e) => setGoal({ ...goal, amount: e.target.value })} /></Labeled>
                </div>
                <div className="pf-ob-days" role="group" aria-label={t("Within")}>
                  {[6, 12, 24, 36].map((m) => (
                    <button key={m} aria-pressed={goal.months === m} onClick={() => setGoal({ ...goal, months: m })}>
                      {m < 12 ? t("{n} months", { n: m }) : t("{n} years", { n: m / 12 })}
                    </button>
                  ))}
                </div>
                {num(goal.amount) > 0 && (
                  <p key={`${goal.amount}-${goal.months}`} className="pf-readout pf-loan-preview">
                    {t("{amount} a month", { amount: money(num(goal.amount) / goal.months, currency) })}
                    {netIncome > 0 && ` · ${t("{pct}% of your income", { pct: Math.round((num(goal.amount) / goal.months / netIncome) * 100) })}`}
                  </p>
                )}
              </Screen>
            )}

            {step === "history" && (
              <Screen title={t("Where do your books start?")} hint={t("You can add earlier months and years later too.")}>
                <div className="pf-ob-grid pf-ob-grid-1">
                  {[
                    { v: "now" as const, t: t("From this month"), d: t("Start fresh today. Earlier months stay empty.") },
                    { v: "january" as const, t: t("From 1 January {year}", { year: now.getFullYear() }), d: t("Fill in this year's months — totals per month are enough.") },
                    { v: "years" as const, t: t("Earlier years too"), d: t("Bring in year totals (income, spending, net worth) for a long-term view.") },
                  ].map((o) => (
                    <button key={o.v} className="pf-ob-choice pf-ob-choice-wide" aria-pressed={history === o.v} onClick={() => setHistory(o.v)}>
                      <span>
                        <b>{o.t}</b>
                        <small>{o.d}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </Screen>
            )}

            {step === "security" && (
              <Screen title={t("Keeping your books up to date")} hint={t("A short check-in now and then keeps every figure right — and earns points on your Progress page.")}>
                <div className="pf-ob-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                  {[
                    { v: "daily" as const, t: t("Daily"), d: t("A minute a day") },
                    { v: "twice-weekly" as const, t: t("Twice a week"), d: t("Monday and Thursday") },
                    { v: "weekly" as const, t: t("Weekly"), d: t("Once a week") },
                  ].map((o) => (
                    <button key={o.v} className="pf-ob-choice" aria-pressed={checkin === o.v} onClick={() => setCheckin(o.v)}>
                      <span><b>{o.t}</b><small>{o.d}</small></span>
                    </button>
                  ))}
                </div>
                <button type="button" className="pf-loan-book" aria-pressed={protect} onClick={() => setProtect((p) => !p)}>
                  <span className="pf-loan-switch" />
                  {t("Extra protection: encrypt my data with a passphrase")}
                </button>
                {protect && (
                  <div className="pf-ob-list pf-readout">
                    <input className="pf-input" type="password" autoComplete="new-password" placeholder={t("Passphrase")} value={pass} onChange={(e) => setPass(e.target.value)} />
                    <input className="pf-input" type="password" autoComplete="new-password" placeholder={t("Passphrase again")} value={pass2} onChange={(e) => setPass2(e.target.value)} />
                    <div className="pf-vault-meter" data-ok={pass.length >= MIN_PASSPHRASE}><span style={{ width: `${Math.min(pass.length / 20, 1) * 100}%` }} /></div>
                    <span className="pf-unlock-hint">{t("Nobody can recover a forgotten passphrase — keep it in your password manager.")}</span>
                  </div>
                )}
              </Screen>
            )}

            {step === "done" && (
              <Screen>
                <div className="pf-ob-mark pf-ob-mark-done">
                  <Sparkles size={34} />
                </div>
                <h1>{t("Ready to open your books")}</h1>
                <p>{t("Each month {income} comes in; {fixed} is fixed and {budgets} budgeted — leaving {left} to save.", { income: money(reveal.income, currency), fixed: money(reveal.fixed, currency), budgets: money(reveal.budgets, currency), left: money(reveal.income - reveal.fixed - reveal.budgets, currency) })}</p>
                {error && <p style={{ color: "var(--pf-red)" }}>{error}</p>}
                {(source === "supabase" || source === "vault") && !preview && <p className="pf-ob-note">{t("This saves to your account.")}</p>}
              </Screen>
            )}
          </div>

          <div className="pf-ob-nav">
            {index > 0 && !(resume && steps.slice(2, index).every((x) => finished.includes(x))) ? (
              <button className="pf-link" onClick={() => go(-1)}>
                <ArrowLeft size={15} /> {t("Back")}
              </button>
            ) : (
              <span />
            )}
            {/* The step count is in the journey bar on top. */}
            <span />
            {step === "done" ? (
              <button className="pf-button" onClick={finish} disabled={saving}>
                {saving ? t("Opening…") : preview ? t("Finish preview") : t("Open my books")} <ArrowRight size={16} />
              </button>
            ) : step === "route" ? (
              <span />
            ) : (
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {step !== "welcome" && (
                  <button className="pf-link" onClick={() => go(1)}>
                    {t("Skip")}
                  </button>
                )}
                <button className="pf-button" onClick={next}>
                  {step === "welcome" ? t("Let's start") : t("Continue")} <ArrowRight size={16} />
                </button>
              </span>
            )}
          </div>
            </>
          )}
        </div>

        <Preview totals={totals} netIncome={netIncome} currency={currency} step={step} fixed={fixed} budgets={budgetLines} />
      </div>
    </div>
  );
}

function Screen({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="pf-ob-screen">
      {title && <h2>{title}</h2>}
      {hint && <p className="pf-ob-hint">{hint}</p>}
      {children}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="pf-ob-line pf-ob-labeled">
      <span>{label}</span>
      {children}
    </label>
  );
}

function BigAmount({ label, value, onChange, currency, autoFocus }: { label: string; value: string; onChange: (v: string) => void; currency: string; autoFocus?: boolean }) {
  return (
    <label className="pf-ob-big">
      <span>{label}</span>
      <input className="pf-input pf-rounded" inputMode="decimal" autoFocus={autoFocus} placeholder={money(0, currency)} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** The month taking shape beside the questions. */
function Preview({
  totals,
  netIncome,
  currency,
  step,
  fixed,
  budgets,
}: {
  totals: { fixedTotal: number; budgetTotal: number; left: number; cash: number; equity: number };
  netIncome: number;
  currency: string;
  step: Step;
  fixed: Line[];
  budgets: Line[];
}) {
  const [inc, fix, bud, left, cash, eq] = useTween([netIncome, totals.fixedTotal, totals.budgetTotal, totals.left, totals.cash, totals.equity], 600);
  const base = Math.max(netIncome, totals.fixedTotal + totals.budgetTotal, 1);
  const parts = [
    ...fixed.filter((f) => f.on && num(f.amount) > 0).map((f) => ({ k: f.key, v: num(f.amount), c: `#${f.color}` })),
    ...budgets.filter((b) => b.on && num(b.amount) > 0).map((b) => ({ k: b.key, v: num(b.amount), c: `#${b.color}` })),
  ];
  const lit = (s: Step[]) => (s.includes(step) ? "true" : "false");
  return (
    <aside className="pf-ob-preview" aria-label={t("Your month so far")}>
      <div className="pf-ob-preview-head">{t("Your month")}</div>
      <div className="pf-ob-stat" data-lit={lit(["income"])}>
        <span>{t("Comes in")}</span>
        <b className="pf-rounded" style={{ color: "var(--pf-green)" }}>{money(inc, currency)}</b>
      </div>
      <div className="pf-ob-flow">
        <div className="pf-ob-flow-in" style={{ width: `${(netIncome / base) * 100}%` }} />
        <div className="pf-ob-flow-out">
          {parts.map((p) => (
            <span key={p.k} style={{ flexBasis: `${(p.v / base) * 100}%`, background: p.c }} />
          ))}
        </div>
      </div>
      <div className="pf-ob-stat" data-lit={lit(["fixed", "insurance"])}>
        <span>{t("Fixed costs")}</span>
        <b className="pf-rounded">{money(fix, currency)}</b>
      </div>
      <div className="pf-ob-stat" data-lit={lit(["budgets", "goal"])}>
        <span>{t("Budgets")}</span>
        <b className="pf-rounded">{money(bud, currency)}</b>
      </div>
      <div className="pf-ob-stat pf-ob-stat-big" data-lit={lit(["fixed", "budgets", "done"])}>
        <span>{t("Left to save")}</span>
        <b className="pf-rounded" style={{ color: left >= 0 ? "var(--pf-green)" : "var(--pf-red)" }}>{money(left, currency)}</b>
      </div>
      <div className="pf-ob-sep" />
      <div className="pf-ob-stat" data-lit={lit(["accounts"])}>
        <span>{t("In your accounts")}</span>
        <b className="pf-rounded">{money(cash, currency)}</b>
      </div>
      <div className="pf-ob-stat pf-ob-stat-big" data-lit={lit(["investments", "balance", "done"])}>
        <span>{t("Equity")}</span>
        <b className="pf-rounded" style={{ color: "#40c8e0" }}>{money(eq, currency)}</b>
      </div>
    </aside>
  );
}
