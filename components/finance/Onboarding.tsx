"use client";

import { newHousehold } from "@/lib/finance/household";
import { t, intlLocale } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Car, Check, FileText, Clock, HeartPulse, House, Layers, Link2, Link2Off, Plane, Plus, Shield, ShieldCheck, Sofa, Sparkles, X, Zap, type LucideIcon } from "lucide-react";
import { live, summarize } from "@/lib/finance/calc";
import { budgetIn } from "@/lib/finance/budgetPlan";
import { currencyName } from "@/lib/finance/currencies";
import { money, monthYear } from "@/lib/finance/format";
import { payoff } from "@/lib/finance/loans";
import { schedule, type MortgageKind } from "@/lib/finance/mortgage";
import { BADGES } from "@/lib/finance/progress";
import { CELEBRATE, type Celebration } from "./SetupCelebration";
import { MIN_PASSPHRASE } from "@/lib/finance/vault";
import BrandMark from "./BrandMark";
import OnboardingProgress from "./OnboardingProgress";
import OnboardingReveal, { monthFraction, useNow } from "./OnboardingReveal";
import LiveAmount from "./LiveAmount";
import LanguagePicker from "./LanguagePicker";
import { LOAN_KINDS, LOAN_STYLE } from "./loanKinds";
import { CHAPTERS, nodesFor, stepsFor, type Route, type Step } from "./onboardingRoutes";
import type { AssetType, InsurancePolicy, LoanKind } from "@/lib/finance/types";
import { useTween } from "./charts";
import CategoryIcon from "./CategoryIcon";
import { useFinance } from "./FinanceProvider";
import { ACCEPT, expectedSeconds, PENDING_KEY, ReadingProgress, readFiles } from "./ReadWithAI";
import { countryOf } from "@/lib/finance/countries";
import OnboardingTrail from "./OnboardingTrail";
import StepSlider from "./StepSlider";
import WeekdayPicker, { periodsLabel } from "./WeekdayPicker";
import InvestmentLine, { draftValue, draftHolding, paidTotal, type InvestmentDraft } from "./InvestmentSearch";
import { useQuotes } from "./Portfolio";
import { holdingValue, symbolsFor, type Quotes } from "@/lib/finance/quotes";

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

/** `own`: added by the user (a name typed in, not one of the suggestions). */
type Line = { key: string; name: string; icon: string; color: string; amount: string; on: boolean; own?: boolean; split?: Part[]; day?: number };
/** One bill inside a fixed cost that comes from more than one supplier
 *  (electricity, gas, water…): saved as a subcategory with its own fixed
 *  cost, so each can change on its own. The line's amount is their sum. */
type Part = { key: string; name: string; amount: string; own?: boolean; linked?: boolean; every?: number; day?: number };
/** How often a bill comes, in months; the amount is per bill and counts in
 *  every month as its monthly share (water twice a year → amount ÷ 6). */
const EVERY: { months: number; label: string }[] = [
  { months: 1, label: "Monthly" },
  { months: 3, label: "Quarterly" },
  { months: 6, label: "Twice a year" },
  { months: 12, label: "Yearly" },
];
const monthly = (p: Part) => num(p.amount) / (p.every ?? 1);
/** Bills paid together (electricity + gas from one supplier): a part with
 *  `linked` belongs to the bill of the part before it, whose amount is the
 *  bill's; its own amount stays empty. */
const billsOf = (split: Part[]) =>
  split.reduce<{ start: number; parts: Part[] }[]>((out, p, k) => {
    if (p.linked && out.length) out[out.length - 1].parts.push(p);
    else out.push({ start: k, parts: [p] });
    return out;
  }, []);
/** A loan part of the mortgage, from today: what's left, the rate, years to go. */
type MortPart = { key: string; kind: MortgageKind; amount: string; rate: string; years: string; extra: string };

const FIXED: Omit<Line, "amount" | "on">[] = [
  { key: "rent", name: "Rent", icon: "house.fill", color: "2F6690" },
  { key: "mortgage", name: "Mortgage", icon: "house.fill", color: "2F6690" },
  { key: "utilities", name: "Energy & water", icon: "bolt.fill", color: "6D4C41" },
  { key: "insurance", name: "Insurance", icon: "cross.case.fill", color: "E63946" },
  { key: "internet", name: "Internet & phone", icon: "phone.fill", color: "0A84FF" },
  { key: "subscriptions", name: "Subscriptions", icon: "tv.fill", color: "BF5AF2" },
  { key: "transport", name: "Car or transit pass", icon: "car.fill", color: "F3A712" },
];

/** Fixed costs that open into their separate bills. */
const SPLITS: Record<string, string[]> = {
  utilities: ["Electricity", "Gas or heating", "Water"],
  internet: ["Internet & TV", "Mobile phone"],
};
const MORT_KINDS: { kind: MortgageKind; label: string }[] = [
  { kind: "annuity", label: "Annuity" },
  { kind: "linear", label: "Linear" },
  { kind: "interest_only", label: "Interest-only" },
];
const newMortPart = (amount = ""): MortPart => ({ key: crypto.randomUUID(), kind: "annuity", amount, rate: "", years: "", extra: "" });

/** The complete route asks these two on their own screens (Subscriptions,
 *  Insurance), so the fixed-costs screen leaves them out there; the quick
 *  route keeps them as one line each. */
const OWN_SCREEN = ["insurance", "subscriptions"];

/** Subscriptions most people have; the price per month is theirs to fill
 *  in (it differs per country and plan). Brand names stay as they are. */
const SUBS: Omit<Line, "amount" | "on">[] = [
  { key: "netflix", name: "Netflix", icon: "N", color: "E50914" },
  { key: "spotify", name: "Spotify", icon: "S", color: "1DB954" },
  { key: "disney", name: "Disney+", icon: "D", color: "113CCF" },
  { key: "youtube", name: "YouTube Premium", icon: "Y", color: "FF0033" },
  { key: "prime", name: "Amazon Prime", icon: "a", color: "00A8E1" },
  { key: "max", name: "Max", icon: "M", color: "5822B4" },
  { key: "apple", name: "iCloud+ / Apple One", icon: "i", color: "8E8E93" },
  { key: "ai", name: "ChatGPT / AI", icon: "AI", color: "10A37F" },
  { key: "gym", name: "Gym", icon: "G", color: "FF9F0A" },
  { key: "news", name: "News & magazines", icon: "N", color: "6E6E73" },
];
const BRANDS = ["netflix", "spotify", "disney", "youtube", "prime", "max", "apple", "ai"];
const subName = (x: Line) => (x.own || BRANDS.includes(x.key) ? x.name : t(x.name));
const ownSub = (): Line => ({ key: crypto.randomUUID(), name: "", icon: "+", color: "8E8E93", amount: "", on: true, own: true });

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

/** Runway goals on the slider (months the accounts should carry you). */
const BUFFERS = [3, 4, 6, 9, 12];
/** Savings-goal terms on the slider, in months. */
const TERMS = [3, 6, 9, 12, 18, 24, 30, 36, 48, 60];
const OWN_POLICY = { label: "Other", Icon: Shield, color: "#8e8e93" };
const ownLine = (): Line => ({ key: crypto.randomUUID(), name: "", icon: "ellipsis.circle.fill", color: "8E8E93", amount: "", on: true, own: true });

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

/** The day of the month a fixed cost is booked (1–31; a short month books it
 *  on its last day). It books itself on that day every month after, and can
 *  be moved later by changing the booking's date. In the month's figures it
 *  is spread over the month either way. */
function DayField({ value, onChange }: { value?: number; onChange: (day: number) => void }) {
  return (
    <label className="pf-ob-day" title={t("Booked on day {n} of the month", { n: value ?? 1 })}>
      <CalendarDays size={12} />
      <input
        inputMode="numeric"
        value={value ?? 1}
        aria-label={t("Day of the month it's booked")}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(Math.min(31, Math.max(1, parseInt(e.target.value.replace(/\D/g, "").slice(-2), 10) || 1)))}
      />
    </label>
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
  investments: InvestmentDraft[];
  fixed: Line[];
  subs?: Line[];
  policies: { kind: InsurancePolicy["kind"]; premium: string; on: boolean; key?: string; name?: string }[];
  budgets: Line[] | null;
  goal: { name: string; amount: string; months: number };
  runwayGoal?: number;
  home: { value: string; mortgage: string; details?: boolean; parts?: MortPart[] };
  /** Rent or own (Your home); rent and the mortgage payment go to the fixed costs. */
  housing?: "rent" | "own" | null;
  /** Agreed to AI reading a document during the setup (ai_consent_at on finish). */
  aiConsent?: boolean;
  /** Transactions read from a bank statement, waiting for the dashboard. */
  statementRows?: number;
  loans: { key: string; kind: LoanKind; name: string; amount: string; rate: string; monthly: string }[];
  history: "now" | "january" | "years";
  checkin: "daily" | "twice-weekly" | "weekly";
  checkinDays?: number[];
};

const DRAFT_KEY = (preview: boolean) => (preview ? "pf-onboarding-preview-draft" : "pf-onboarding-draft");

/** FOR TESTING (the preview only, nothing is saved): a complete set of
 *  made-up answers, parked on the last question so the tour is one click
 *  away. Generic numbers — never anyone's real data. */
function testDraft(): Draft {
  const id = () => crypto.randomUUID();
  const on = (list: Omit<Line, "amount" | "on">[], amounts: Record<string, string>) => list.map((l) => ({ ...l, on: l.key in amounts, amount: amounts[l.key] ?? "" }));
  const fixed = on(FIXED, { mortgage: "1250", utilities: "185", internet: "75", transport: "120" }).map((l) =>
    l.key === "utilities"
      ? { ...l, split: [{ key: id(), name: "Electricity", amount: "155" }, { key: id(), name: "Gas or heating", amount: "", linked: true }, { key: id(), name: "Water", amount: "180", every: 6 }] }
      : l.key === "internet"
        ? { ...l, split: [{ key: id(), name: "Internet & TV", amount: "55" }, { key: id(), name: "Mobile phone", amount: "20" }] }
        : l,
  );
  return {
    route: "complete", step: "security",
    answered: ["currency", "household", "income", "housing", "accounts", "investments", "fixed", "subscriptions", "insurance", "balance", "budgets", "goal", "history", "statement", "security"], housing: "own",
    currency: "EUR", net: "3800", gross: "5200", payday: 25, together: false, names: [t("Me"), t("Partner")],
    accounts: [
      { key: "checking", name: t("Current account"), type: "checking", amount: "2400" },
      { key: "savings", name: t("Savings"), type: "savings", amount: "14500" },
    ],
    investments: [
      { key: id(), name: "Bitcoin", type: "crypto", amount: "", symbol: "BTC", kind: "Crypto", quantity: "0.05", paid: "2500" },
      { key: id(), name: "Vanguard FTSE All-World", type: "stock", amount: "", symbol: "VWRL.AS", kind: "ETF", quantity: "60", paid: "95", paidEach: true },
      { key: id(), name: t("Pension"), type: "stock", amount: "8000" },
    ],
    fixed,
    subs: on(SUBS, { netflix: "13.99", spotify: "11.99", gym: "35" }),
    policies: POLICIES.map((p) => ({ kind: p.kind, on: ["health", "liability", "contents", "home"].includes(p.kind), premium: { health: "148", liability: "6", contents: "12", home: "21" }[p.kind as string] ?? "" })),
    budgets: BUDGETS.map((b) => ({ ...b, on: true, amount: String(Math.round((3800 * b.share) / 10) * 10) })),
    goal: { name: t("Emergency fund"), amount: "20000", months: 18 },
    home: { value: "425000", mortgage: "310000", details: true, parts: [{ key: id(), kind: "annuity", amount: "310000", rate: "3.9", years: "26", extra: "" }] },
    loans: [{ key: id(), kind: "student", name: "", amount: "18000", rate: "2.6", monthly: "150" }],
    history: "now", checkin: "twice-weekly",
  };
}
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
  const { data, now, source, updateProfile, saveAccount, setBudget, addCategory, addTransaction, addBalanceItem, saveLoan, addHolding, savePolicy, saveGoal, setPassphrase, saveProperty, saveMortgagePart, awardBadges } = useFinance();
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
  // Live prices for the investments linked to a market (every 30 s).
  const linked = investments.filter((x) => x.symbol);
  const fresh = useQuotes(linked.length ? symbolsFor(linked.map((x) => draftHolding(x, currency)), currency) : [], "1d", 30_000)?.quotes ?? null;
  // Adding one more asks for a new set: the ones already there keep their
  // last price meanwhile instead of blinking to "—".
  const [invQuotes, setInvQuotes] = useState<Quotes | null>(null);
  if (fresh && fresh !== invQuotes) setInvQuotes(fresh);
  const invValue = (x: InvestmentDraft) => draftValue(x, invQuotes, currency, num);
  const [fixed, setFixed] = useState<Line[]>(d0.fixed ?? FIXED.map((f) => ({ ...f, amount: "", on: false })));
  const [subs, setSubs] = useState<Line[]>(d0.subs ?? SUBS.map((x) => ({ ...x, amount: "", on: false })));
  const [policies, setPolicies] = useState<Draft["policies"]>(d0.policies ?? POLICIES.map((p) => ({ kind: p.kind, premium: "", on: false })));
  const [budgets, setBudgets] = useState<Line[] | null>(d0.budgets ?? null);
  const [goal, setGoal] = useState(d0.goal ?? { name: "", amount: "", months: 12 });
  const [runwayGoal, setRunwayGoal] = useState(d0.runwayGoal ?? data.profile.runway_goal ?? 6);
  const [home, setHome] = useState<Draft["home"]>(d0.home ?? { value: "", mortgage: "" });
  // Other loans, each with its kind and a name; the complete route also asks
  // the rate and the monthly payment (then the debt goes down by itself).
  const [loans, setLoans] = useState<Draft["loans"]>(d0.loans ?? []);
  const [history, setHistory] = useState<Draft["history"]>(d0.history ?? "now");
  const [housing, setHousingRaw] = useState<Draft["housing"]>(d0.housing ?? null);
  const [aiConsent, setAiConsent] = useState(!!d0.aiConsent || !!data.profile.ai_consent_at);
  const [statementRows, setStatementRows] = useState<number | undefined>(d0.statementRows);
  // A document being read right now (bank statement or mortgage papers).
  const [reading, setReading] = useState<{ kind: "bank" | "mortgage"; expect: number; landed: boolean } | null>(null);
  const [readError, setReadError] = useState<{ kind: "bank" | "mortgage"; text: string } | null>(null);
  const [checkin, setCheckin] = useState<Draft["checkin"]>(d0.checkin ?? data.profile.checkin_interval ?? "twice-weekly");
  const [checkinDays, setCheckinDays] = useState<number[] | undefined>(d0.checkinDays ?? data.profile.checkin_days);
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
  // Complete route: subscriptions and insurance on their own screens, each
  // one a fixed cost of its own (in the categories Subscriptions and
  // Insurance) — so they're counted once, not on the fixed-costs screen too.
  const separate = route !== "quick";
  // Mortgage details (Home step): each part's schedule from this month, so
  // the monthly payment — interest and repayment — is worked out, and the
  // fixed cost "Mortgage" follows it instead of being typed twice.
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  const mortParts = home.details ? (home.parts ?? []).filter((p) => num(p.amount) > 0 && num(p.years) > 0) : [];
  const mortRows = mortParts.map((p) => schedule({ id: p.key, name: "", kind: p.kind, principal: num(p.amount), rate: num(p.rate), start: m0, termMonths: Math.round(num(p.years) * 12), extraMonthly: num(p.extra) }));
  const mort = {
    interest: mortRows.reduce((s2, rows) => s2 + (rows[0]?.interest ?? 0), 0),
    repayment: mortRows.reduce((s2, rows) => s2 + (rows[0] ? rows[0].repayment + rows[0].extra : 0), 0),
    totalInterest: mortRows.reduce((s2, rows) => s2 + rows.reduce((s3, x) => s3 + x.interest, 0), 0),
    end: mortRows.reduce<Date | null>((e, rows) => { const last = rows[rows.length - 1]?.month; return last && (!e || last > e) ? last : e; }, null),
  };
  const mortPay = mort.interest + mort.repayment;
  const fixedShown = (separate ? fixed.filter((f) => !OWN_SCREEN.includes(f.key)) : fixed).map((f) => (f.key === "mortgage" && mortPay > 0 ? { ...f, on: true, amount: mortPay.toFixed(2) } : f));
  const subLines = subs.filter((x) => x.on && num(x.amount) > 0 && (!x.own || x.name.trim()));
  const policyLines = policies.filter((p) => p.on && num(p.premium) > 0);
  const policyName = (p: Draft["policies"][number]) => p.name?.trim() || t((POLICIES.find((x) => x.kind === p.kind) ?? OWN_POLICY).label);
  const costLines: Line[] = [
    ...fixedShown,
    ...(separate ? subLines.map((x) => ({ ...x, key: `sub-${x.key}`, name: subName(x), own: true })) : []),
    ...(separate ? policyLines.map((p, i) => ({ key: `ins-${p.key ?? p.kind}-${i}`, name: policyName(p), icon: "cross.case.fill", color: "E63946", amount: p.premium, on: true, own: true })) : []),
  ];
  const setLine = (i: number, patch: Partial<Line>) => setFixed(fixed.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setParts = (i: number, split: Part[]) => {
    const sum = split.reduce((s2, p) => s2 + monthly(p), 0);
    setLine(i, { split, amount: sum ? String(Math.round(sum * 100) / 100) : "" });
  };
  const toggleLine = (f: Line, i: number) => {
    if (f.on || !SPLITS[f.key] || f.split) return setLine(i, { on: !f.on });
    // First time on: its bills; a mobile phone per person when together.
    const split = SPLITS[f.key].flatMap((name): Part[] =>
      name === "Mobile phone" && together
        ? names.map((n) => ({ key: crypto.randomUUID(), name: `${t("Mobile phone")} · ${n.trim() || t("Me")}`, amount: "", own: true }))
        : [{ key: crypto.randomUUID(), name, amount: "" }],
    );
    setLine(i, { on: true, split });
  };
  const fixedRow = (f: Line, i: number) => {
    const shown = fixedShown.find((x) => x.key === f.key) ?? f;
    const toggle = (
      <button className="pf-ob-toggle" aria-pressed={shown.on} onClick={() => toggleLine(f, i)}>
        <CategoryIcon icon={f.icon} colorHex={shown.on ? f.color : "3a3a3c"} size={30} />
        <span>{t(f.name)}</span>
        {shown.on && <Check size={14} className="pf-ob-check" />}
      </button>
    );
    if (shown.on && f.split)
      return (
        <div key={f.key} className="pf-ob-loanrow">
          <div className="pf-ob-line" data-on>
            {toggle}
            <span className="pf-ob-splitsum pf-rounded">{money(num(f.amount), currency)}</span>
          </div>
          <div className="pf-ob-split">
            {billsOf(f.split).map((b, n, bills) => {
              const split = f.split!;
              const first = b.parts[0], k = b.start;
              const set = (patch: Partial<Part>) => setParts(i, split.map((x, j) => (j === k ? { ...x, ...patch } : x)));
              const label = b.parts.map((p) => (p.own ? p.name || t("Name") : t(p.name))).join(" + ");
              const end = k + b.parts.length;
              // Link the next bill into this one (its amount added to this one's).
              const link = () => {
                const next = bills[n + 1];
                const add = next.parts.reduce((s2, p) => s2 + num(p.amount), 0);
                setParts(i, split.map((x, j) => (j === k ? { ...x, amount: add ? String(num(x.amount) + add) : x.amount } : j === next.start ? { ...x, linked: true, amount: "" } : j > next.start && j < next.start + next.parts.length ? { ...x, amount: "" } : x)));
              };
              const unlink = () => setParts(i, split.map((x, j) => (j > k && j < end ? { ...x, linked: false } : x)));
              return (
                <div key={first.key} className="pf-ob-bill">
                  <div className="pf-ob-splitrow" data-linked={b.parts.length > 1}>
                    {b.parts.length === 1 && first.own
                      ? <input className="pf-ob-name" autoFocus={!first.name} value={first.name} placeholder={t("Name")} aria-label={t("Name")} onChange={(e) => set({ name: e.target.value })} />
                      : <span>{label}{b.parts.length > 1 && <small>{t("One bill")}</small>}</span>}
                    <AmountField autoFocus={n === 0} currency={currency} value={first.amount} label={t("{name} per month", { name: label })} onChange={(v) => set({ amount: v })} />
                    {b.parts.length > 1
                      ? <button type="button" className="pf-icon-button" aria-label={t("Separate bills")} title={t("Separate bills")} onClick={unlink}><Link2Off size={13} /></button>
                      : <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={() => setParts(i, split.filter((_, j) => j !== k))}><X size={13} /></button>}
                  </div>
                  <div className="pf-ob-every" role="group" aria-label={t("How often")}>
                    {EVERY.map((e) => (
                      <button key={e.months} type="button" aria-pressed={(first.every ?? 1) === e.months} onClick={() => set({ every: e.months })}>{t(e.label)}</button>
                    ))}
                    <DayField value={first.day} onChange={(day) => set({ day })} />
                    {(first.every ?? 1) > 1 && num(first.amount) > 0 && <span className="pf-rounded">= {money(monthly(first), currency)} {t("a month")}</span>}
                  </div>
                  {n < bills.length - 1 && (
                    <button type="button" className="pf-ob-link" onClick={link}>
                      <Link2 size={12} /> {t("Same bill as {name}", { name: bills[n + 1].parts.map((p) => (p.own ? p.name || t("Name") : t(p.name))).join(" + ") })}
                    </button>
                  )}
                </div>
              );
            })}
            <button type="button" className="pf-bal-add" onClick={() => setParts(i, [...f.split!, { key: crypto.randomUUID(), name: "", amount: "", own: true }])}>
              <Plus size={13} /> {t("Something else")}
            </button>
          </div>
        </div>
      );
    const auto = f.key === "mortgage" && mortPay > 0;
    return (
      <div key={f.key} className="pf-ob-loanrow">
        <div className="pf-ob-line" data-on={shown.on}>
          {toggle}
          {shown.on && <DayField value={f.day} onChange={(day) => setLine(i, { day })} />}
          {shown.on && (auto
            ? <span className="pf-ob-splitsum pf-rounded">{money(mortPay, currency)}</span>
            : <AmountField autoFocus currency={currency} value={f.amount} label={t("{name} per month", { name: t(f.name) })} onChange={(v) => setLine(i, { amount: v })} />)}
        </div>
        {f.key === "mortgage" && shown.on && separate && (
          <span className="pf-ob-note">{auto ? t("Worked out from your mortgage details: {interest} interest and {repayment} repayment.", { interest: money(mort.interest, currency), repayment: money(mort.repayment, currency) }) : t("Rate and term can be added on the Home step — then this is worked out for you.")}</span>
        )}
      </div>
    );
  };

  // The mortgage's loan parts; the remaining debt is their sum.
  const setMortParts = (parts: MortPart[], open?: boolean) => setHome({ ...home, ...(open ? { details: true } : {}), parts, mortgage: String(parts.reduce((s2, p) => s2 + num(p.amount), 0) || "") });

  const budgetLines = budgets ?? BUDGETS.map((b) => ({ ...b, amount: netIncome ? String(Math.round((netIncome * b.share) / 10) * 10) : "", on: true }));

  const totals = useMemo(() => {
    const fixedTotal = costLines.filter((f) => f.on).reduce((s, f) => s + num(f.amount), 0);
    const budgetTotal = budgetLines.filter((b) => b.on).reduce((s, b) => s + num(b.amount), 0);
    const cash = accounts.reduce((s, a) => s + num(a.amount), 0);
    const invested = investments.reduce((s, x) => s + invValue(x), 0);
    const equity = cash + invested + num(home.value) - num(home.mortgage) - loans.reduce((s, l) => s + num(l.amount), 0);
    return { fixedTotal, budgetTotal, left: netIncome - fixedTotal - budgetTotal, cash, equity };
  }, [costLines, budgetLines, accounts, investments, home, loans, netIncome, invQuotes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember where the setup stands on this device.
  useEffect(() => {
    if (saved || resume) return;
    const draft: Draft = { route, step, answered, currency, net, gross, payday, together, names, accounts, investments, fixed, subs, policies, budgets, goal, runwayGoal, home, loans, history, checkin, checkinDays, housing, aiConsent, statementRows };
    try {
      localStorage.setItem(DRAFT_KEY(preview), JSON.stringify(draft));
    } catch {}
  }, [route, step, answered, currency, net, gross, payday, together, names, accounts, investments, fixed, subs, policies, budgets, goal, runwayGoal, home, loans, history, checkin, checkinDays, housing, aiConsent, statementRows, saved, resume, preview]);

  // Rent or own: the fixed costs follow (rent on, or the mortgage on).
  const setHousing = (h: "rent" | "own") => {
    setHousingRaw(h);
    setFixed(fixed.map((f) => (f.key === "rent" ? { ...f, on: h === "rent" } : f.key === "mortgage" ? { ...f, on: h === "own" } : f)));
  };
  const rentLine = fixed.find((f) => f.key === "rent");
  const mortLine = fixed.find((f) => f.key === "mortgage");
  const setLineAmount = (key: string, amount: string) => setFixed(fixed.map((f) => (f.key === key ? { ...f, amount, on: true } : f)));

  // Read a document with AI during the setup: a bank statement (kept for the
  // dashboard to check once the books are open) or mortgage papers (filling
  // in the loan parts here).
  async function readDoc(kind: "bank" | "mortgage", files: FileList) {
    if (!files.length) return;
    setAiConsent(true);
    setReadError(null);
    setReading({ kind, expect: expectedSeconds(files), landed: false });
    try {
      if (kind === "bank") {
        // The categories this setup will create (in the app's language), so
        // the AI can suggest one for each row.
        const names = [...live(data.categories).map((c) => c.name), ...BUDGETS.map((x) => t(x.name)), ...FIXED.map((x) => t(x.name)), t("Subscriptions"), t("Insurance")];
        const res = await readFiles("bank", files, [...new Set(names)], source === "supabase");
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify(res.transactions));
        } catch {}
        setReading({ kind, expect: 1, landed: true });
        await new Promise((ok) => setTimeout(ok, 450));
        setStatementRows(res.transactions.length);
      } else {
        const res = await readFiles("mortgage", files, [], source === "supabase");
        const parts = res.parts.map((x): MortPart => {
          const startedAgo = x.start_date ? Math.max(0, (now.getFullYear() - Number(x.start_date.slice(0, 4))) * 12 + now.getMonth() + 1 - Number(x.start_date.slice(5, 7))) : 0;
          const left = x.term_months ? Math.max(x.term_months - startedAgo, 1) : 0;
          return { key: crypto.randomUUID(), kind: x.kind, amount: String(Math.round(x.principal)), rate: String(x.rate).replace(".", ","), years: left ? String(Math.round((left / 12) * 10) / 10).replace(".", ",") : "", extra: "" };
        });
        setReading({ kind, expect: 1, landed: true });
        await new Promise((ok) => setTimeout(ok, 450));
        if (parts.length) setMortParts(parts, true);
        else setReadError({ kind, text: t("No loan parts found in this document.") });
      }
    } catch (e) {
      setReadError({ kind, text: (e as Error).message });
    } finally {
      setReading(null);
    }
  }

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
  // The card grows and shrinks smoothly with what's in it (a new step, a
  // line opening) instead of jumping: its height is set from the content's
  // and the change is animated in CSS.
  const [cardH, setCardH] = useState<number | null>(null);
  const sizer = useRef<ResizeObserver | null>(null);
  // A callback ref: the content may mount after the first render.
  const inner = useCallback((el: HTMLDivElement | null) => {
    sizer.current?.disconnect();
    sizer.current = null;
    const box = el?.parentElement;
    if (!el || !box) return;
    const cs = getComputedStyle(box);
    const extra = cs.boxSizing === "border-box" ? ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce((s2, k) => s2 + parseFloat(cs[k as "paddingTop"]), 0) : 0;
    sizer.current = new ResizeObserver(() => setCardH(Math.ceil(el.offsetHeight + extra)));
    sizer.current.observe(el);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A field that used the key itself (the investment search) keeps it.
      if (saved || e.defaultPrevented) return;
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
    // Points for finishing: the quick start, or the whole setup (a quick
    // start finished later still earns the complete one). The dashboard
    // opens with the bang (SetupCelebration).
    const badge = BADGES.find((b) => b.code === (route === "quick" && !resume ? "setup-quick" : "setup-complete"))!;
    const celebrate = (extra?: Partial<Celebration>) => {
      try {
        sessionStorage.setItem(CELEBRATE, JSON.stringify({ points: badge.points, title: badge.title, ...extra }));
      } catch {}
    };
    if (preview) {
      celebrate({ preview: true });
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
        ...(has("goal") ? { runway_goal: runwayGoal } : {}),
        ...(aiConsent && !data.profile.ai_consent_at ? { ai_consent_at: new Date().toISOString() } : {}),
        ...(has("security") ? { checkin_interval: checkin, ...(checkin !== "daily" && checkinDays ? { checkin_days: checkinDays } : {}) } : {}),
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
        for (const x of investments) {
          const date_added = new Date().toISOString();
          if (x.symbol) {
            // Linked: the live price × how many; paid = what was put in
            // (else what it's worth now, so the result starts at zero).
            const qty = num(x.quantity ?? "");
            if (qty <= 0) continue;
            const paid = paidTotal(x) || invValue(x);
            await addHolding({ symbol: x.symbol, name: x.name, asset_type: x.type, quantity: String(qty), cost_basis: paid > 0 ? paid.toFixed(2) : null, cost_basis_currency: currency, date_added });
          } else if (num(x.amount) > 0) {
            await addHolding({ symbol: "", name: x.name.trim() || t(ASSETS.find((a) => a.type === x.type)!.label), asset_type: x.type, quantity: "1", cost_basis: num(x.amount).toFixed(2), cost_basis_currency: currency, date_added });
          }
        }
      }
      const cats = live(data.categories);
      // This month's booking on its day (a short month: its last day).
      const bookDate = (day = 1) => new Date(now.getFullYear(), now.getMonth(), Math.min(day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()), 12).toISOString();
      const categoryFor = async (name: string, icon: string, color: string, isFixed: boolean) =>
        cats.find((c) => c.name.toLowerCase() === name.toLowerCase() && !c.parent_id) ??
        (await addCategory({ name, icon, color_hex: color, is_income_category: false, is_fixed_expense: isFixed }));
      if (has("fixed")) {
        for (const f of fixedShown.filter((f) => f.on && num(f.amount) > 0 && (!f.own || f.name.trim()))) {
          const c = await categoryFor(f.own ? f.name.trim() : t(f.name), f.icon, f.color, true);
          await setBudget(c.id, month, num(f.amount));
          const book = (amount: number, note: string, category_id: string, day?: number) =>
            addTransaction({
              amount: amount.toFixed(2), type: "expense", date: bookDate(day),
              note, is_auto_income: false, is_fixed_expense: true, recurrence_id: crypto.randomUUID(), category_id, account_id: null,
            });
          const parts = billsOf(f.split ?? [])
            .map((b) => ({ amount: String(monthly(b.parts[0])), day: b.parts[0].day, name: b.parts.map((p) => (p.own ? p.name.trim() : t(p.name))).filter(Boolean).join(" + ") }))
            .filter((b) => num(b.amount) > 0 && b.name);
          if (!parts.length) {
            await book(num(f.amount), f.own ? f.name.trim() : t(f.name), c.id, f.day);
            continue;
          }
          // Each bill its own subcategory (Electricity under Energy & water;
          // bills paid together as one: "Electricity + Gas").
          for (const p of parts) {
            const name = p.name;
            const sub = cats.find((x) => x.parent_id === c.id && x.name.toLowerCase() === name.toLowerCase()) ??
              (await addCategory({ name, icon: f.icon, color_hex: f.color, is_income_category: false, is_fixed_expense: true, parent_id: c.id }));
            await book(num(p.amount), name, sub.id, p.day);
          }
        }
      }
      // One category for a group (Subscriptions, Insurance), its budget the
      // group's total, and each item a fixed cost of its own that books
      // itself every month.
      const bookGroup = async (name: string, icon: string, color: string, items: { note: string; amount: number; day?: number }[]) => {
        if (!items.length) return;
        const c = await categoryFor(name, icon, color, true);
        await setBudget(c.id, month, items.reduce((s2, x) => s2 + x.amount, 0));
        for (const x of items)
          await addTransaction({
            amount: x.amount.toFixed(2), type: "expense", date: bookDate(x.day),
            note: x.note, is_auto_income: false, is_fixed_expense: true, recurrence_id: crypto.randomUUID(), category_id: c.id, account_id: null,
          });
      };
      if (has("subscriptions") && separate) {
        await bookGroup(t("Subscriptions"), "tv.fill", "BF5AF2", subLines.map((x) => ({ note: subName(x).trim(), amount: num(x.amount), day: x.day })));
      }
      if (has("insurance")) {
        for (const [i, p] of policyLines.entries()) {
          await savePolicy({ kind: p.kind, name: policyName(p), insurer: "", premium: num(p.premium).toFixed(2), period: "month", deductible: "0.00", coverage: null, start_date: null, renewal_date: null, notice_months: 1, notes: "", sort_order: i });
        }
        if (separate) await bookGroup(t("Insurance"), "cross.case.fill", "E63946", policyLines.map((p) => ({ note: policyName(p), amount: num(p.premium) })));
      }
      // Budgets: answered in the complete route, suggested in the quick one.
      if (has("budgets") || (route === "quick" && has("income"))) {
        for (const b of budgetLines.filter((b) => b.on && num(b.amount) > 0 && (!b.own || b.name.trim()))) {
          const c = await categoryFor(b.own ? b.name.trim() : b.key, b.icon, b.color, false);
          await setBudget(c.id, month, num(b.amount));
        }
      }
      if (has("goal") && num(goal.amount) > 0) {
        const by = new Date(now.getFullYear(), now.getMonth() + goal.months, 1);
        await saveGoal({ kind: "save", name: goal.name.trim() || t("Savings goal"), target: num(goal.amount).toFixed(2), start_value: totals.cash.toFixed(2), target_date: `${by.getFullYear()}-${String(by.getMonth() + 1).padStart(2, "0")}-01`, category_id: null, achieved_at: null, sort_order: 0 });
      }
      if ((has("housing") && housing === "own") || (has("balance") && !has("housing"))) {
        if (mortParts.length) {
          // With details: the home and its loan parts go to Real estate (the
          // balance sheet reads them from there, the debt going down by itself).
          const property_id = await saveProperty({ name: t("Home"), value: num(home.value).toFixed(2), value_date: today, purchase_price: null, purchase_date: null, country: countryOf(data.profile) === "NL" ? "NL" : "INTL", sort_order: 0 });
          for (const [i, p] of mortParts.entries()) {
            const kind = MORT_KINDS.find((k) => k.kind === p.kind)!;
            await saveMortgagePart({ property_id, name: mortParts.length > 1 ? `${t(kind.label)} ${i + 1}` : t("Mortgage"), kind: p.kind, principal: num(p.amount).toFixed(2), rate: num(p.rate).toFixed(3), fixed_until: null, start_date: today.slice(0, 8) + "01", term_months: Math.round(num(p.years) * 12), nhg: false, extra_monthly: num(p.extra).toFixed(2), sort_order: i });
          }
        } else {
          if (num(home.value)) await addBalanceItem({ name: t("Home"), side: "asset", value: num(home.value) });
          if (num(home.mortgage)) await addBalanceItem({ name: t("Mortgage"), side: "liability", value: num(home.mortgage) });
        }
      }
      if (has("balance")) {
        for (const [i, l] of loans.filter((l) => num(l.amount) > 0).entries()) {
          await saveLoan({ kind: l.kind, name: l.name.trim() || t(LOAN_STYLE[l.kind].label), balance: num(l.amount).toFixed(2), rate: num(l.rate).toFixed(2), monthly: num(l.monthly).toFixed(2), start_date: today, sort_order: i });
        }
      }
      if (has("security") && protect && source === "vault") await setPassphrase(pass);
      await awardBadges([{ code: badge.code, points: badge.points }]);
      celebrate();
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
      <OnboardingTrail
        nodes={nodes}
        done={nodes.map((nd) => nd.steps.every((x) => answered.includes(x) || finished.includes(x)))}
        current={nodes.findIndex((nd) => nd.steps.includes(step))}
      />
      <button className="pf-ob-close pf-icon-button" aria-label={t("Close")} onClick={onClose}>
        <X size={18} />
      </button>

      <div className="pf-ob-layout">
        <div className="pf-ob-card" ref={card} style={cardH ? { height: cardH } : undefined}>
          {/* The card's height follows this, gliding (pf-ob-card transition). */}
          <div className="pf-ob-inner" ref={inner}>
          <OnboardingProgress nodes={nodes} chapters={route !== "quick"} step={step} onPick={(to) => goTo(to, -1)} />
          {preview && (
            <div className="pf-ob-drafts">
              <div className="pf-ob-draft">{t("Draft · preview — nothing is saved")}</div>
              {/* Testing only: fill every answer with made-up data, or start over. */}
              <span className="pf-ob-testfill">
                <button type="button" onClick={() => { try { localStorage.setItem(DRAFT_KEY(true), JSON.stringify(testDraft())); } catch {} location.reload(); }}>Test: fill</button>
                <button type="button" onClick={() => { try { localStorage.removeItem(DRAFT_KEY(true)); } catch {} location.reload(); }}>Test: clear</button>
              </span>
            </div>
          )}

          {saved ? (
            <OnboardingReveal
              f={{
                ...reveal,
                left: reveal.income - reveal.fixed - reveal.budgets,
                equity: totals.equity + bookCash,
                debtFree,
                runwayGoal,
                // The mortgage's parts together, month by month (Debt-free card).
                mortgage: mortRows.length
                  ? {
                      owed: mortParts.reduce((s2, p) => s2 + num(p.amount), 0),
                      monthly: mortPay,
                      months: Array.from({ length: Math.max(...mortRows.map((rows) => rows.length)) }, (_, k) => ({
                        date: mortRows.find((rows) => rows[k])![k].month,
                        balance: mortRows.reduce((s2, rows) => s2 + (rows[k]?.balance ?? 0), 0),
                        interest: mortRows.reduce((s2, rows) => s2 + (rows[k]?.interest ?? 0), 0),
                      })),
                    }
                  : null,
                loans: loans.filter((l) => num(l.amount) > 0).map((l) => ({ name: l.name.trim() || t(LOAN_STYLE[l.kind].label), balance: num(l.amount), rate: num(l.rate), monthly: num(l.monthly) })),
                // The balance sheet as entered, post by post.
                assets: [
                  ...accounts.map((a) => ({ name: a.name, amount: num(a.amount) })),
                  { name: t("Investments"), amount: investments.reduce((s2, x) => s2 + invValue(x), 0) },
                  { name: t("Home"), amount: num(home.value) },
                ],
                debts: [
                  { name: t("Mortgage"), amount: num(home.mortgage) },
                  ...loans.map((l) => ({ name: l.name.trim() || t(LOAN_STYLE[l.kind].label), amount: num(l.amount) })),
                ],
                fixedLines: costLines.filter((x) => x.on && num(x.amount) > 0).map((x) => ({ name: x.own ? x.name : t(x.name), amount: num(x.amount), day: x.split ? Math.min(...x.split.map((p) => p.day ?? 1)) : (x.day ?? 1) })),
                budgetLines: budgetLines.filter((x) => x.on && num(x.amount) > 0).map((x) => ({ name: x.own ? x.name : t(x.name), amount: num(x.amount) })),
                invest: {
                  total: investments.reduce((s2, x) => s2 + invValue(x), 0),
                  day: investments.filter((x) => x.symbol).reduce((s2, x) => s2 + (holdingValue(draftHolding(x, currency), invQuotes ?? {}, currency).day ?? 0), 0),
                  items: investments.map((x) => ({ name: x.name, value: invValue(x) })).filter((x) => x.value > 0),
                },
                payday,
                goal: num(goal.amount) > 0 ? { name: goal.name.trim() || t("Savings goal"), amount: num(goal.amount), months: goal.months } : null,
                checkin: answered.includes("security") ? (checkin === "daily" ? t("Daily") : `${checkin === "weekly" ? t("Weekly") : t("Twice a week")} (${periodsLabel(checkin, checkinDays)})`) : undefined,
              }}
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
                {/* The big hello: line by line, the key words in the brand gradient. */}
                <div className="pf-ob-hello">
                  <h1>
                    <span style={{ ["--d" as string]: "0.1s" }}>{t("Welcome to the best")}</span>
                    <span style={{ ["--d" as string]: "0.3s" }}><em>{t("personal finance app")}</em></span>
                    <span style={{ ["--d" as string]: "0.5s" }}>{t("in the world.")}</span>
                  </h1>
                  <p className="pf-ob-hello-promise" style={{ ["--d" as string]: "0.8s" }}>{t("From now on you're always in control of your money.")}</p>
                </div>
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

            {step === "housing" && (
              <Screen title={t("Do you rent or own your home?")} hint={t("Your housing costs are often the biggest fixed cost. Fill in what you know — the details can wait.")}>
                <div className="pf-ob-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                  {[
                    { v: "rent" as const, t: t("I rent"), d: t("Rent goes to your fixed costs") },
                    { v: "own" as const, t: t("I own my home"), d: t("With or without a mortgage") },
                  ].map((o) => (
                    <button key={o.v} className="pf-ob-choice" aria-pressed={housing === o.v} onClick={() => setHousing(o.v)}>
                      <span><b>{o.t}</b><small>{o.d}</small></span>
                    </button>
                  ))}
                </div>
                {housing === "rent" && rentLine && (
                  <div className="pf-ob-list">
                    <div className="pf-ob-line" data-on>
                      <CategoryIcon icon={rentLine.icon} colorHex={rentLine.color} size={30} />
                      <span className="pf-ob-name">{t("Rent per month")}</span>
                      <DayField value={rentLine.day} onChange={(day) => setFixed(fixed.map((f) => (f.key === "rent" ? { ...f, day } : f)))} />
                      <AmountField autoFocus currency={currency} value={rentLine.amount} label={t("Rent per month")} onChange={(v) => setLineAmount("rent", v)} />
                    </div>
                  </div>
                )}
                {housing === "own" && (
                  <>
                    <div className="pf-ob-list">
                  <Labeled label={t("Home value (WOZ or estimate)")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={home.value} onChange={(e) => setHome({ ...home, value: e.target.value })} /></Labeled>
                  {!home.details && mortLine && <Labeled label={t("Mortgage payment per month")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={mortLine.amount} onChange={(e) => setLineAmount("mortgage", e.target.value)} /></Labeled>}
                  <Labeled label={t("Mortgage remaining")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={home.mortgage} disabled={!!home.details} onChange={(e) => setHome({ ...home, mortgage: e.target.value })} /></Labeled>
                  <button type="button" className="pf-ob-more" aria-expanded={!!home.details} onClick={() => setHome({ ...home, details: !home.details, parts: home.parts?.length ? home.parts : [newMortPart(home.mortgage)] })}>
                    <Layers size={15} />
                    <span>{t("Mortgage details")}<small>{t("Optional — rate, years to go, annuity or linear")}</small></span>
                    <ArrowRight size={14} className="pf-ob-more-arrow" />
                  </button>
                  {home.details && (
                    <div className="pf-ob-mort">
                      {(home.parts ?? []).map((p, k, all) => {
                        const set = (patch: Partial<MortPart>) => setMortParts(all.map((x, j) => (j === k ? { ...x, ...patch } : x)));
                        return (
                          <div key={p.key} className="pf-ob-mortpart">
                            <div className="pf-ob-chips" role="group" aria-label={t("Kind")}>
                              {MORT_KINDS.map((m) => (
                                <button key={m.kind} type="button" aria-pressed={p.kind === m.kind} style={{ ["--c" as string]: "#0a84ff" }} onClick={() => set({ kind: m.kind })}>{t(m.label)}</button>
                              ))}
                              {all.length > 1 && <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={() => setMortParts(all.filter((_, j) => j !== k))}><X size={13} /></button>}
                            </div>
                            <div className="pf-ob-loanterms pf-ob-mortterms">
                              <label>{t("Left on this part")}<input className="pf-input" inputMode="decimal" placeholder={money(0, currency)} value={p.amount} onChange={(e) => set({ amount: e.target.value })} /></label>
                              <label>{t("Interest rate (%)")}<input className="pf-input" inputMode="decimal" placeholder="3,8" value={p.rate} onChange={(e) => set({ rate: e.target.value })} /></label>
                              <label>{t("Years to go")}<input className="pf-input" inputMode="decimal" placeholder="25" value={p.years} onChange={(e) => set({ years: e.target.value })} /></label>
                              <label>{t("Extra repayment a month")}<input className="pf-input" inputMode="decimal" placeholder={money(0, currency)} value={p.extra} onChange={(e) => set({ extra: e.target.value })} /></label>
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" className="pf-bal-add" onClick={() => setMortParts([...(home.parts ?? []), newMortPart()])}>
                        <Plus size={13} /> {t("Add a loan part")}
                      </button>
                      {mortPay > 0 && (
                        <div className="pf-ob-mortsum">
                          <div><span>{t("This month")}</span><b className="pf-rounded">{money(mortPay, currency)}</b></div>
                          <div className="pf-ob-mortbar" aria-hidden>
                            <i style={{ flexGrow: mort.interest, background: "var(--pf-red)" }} />
                            <i style={{ flexGrow: mort.repayment, background: "var(--pf-green)" }} />
                          </div>
                          <div className="pf-ob-mortkey">
                            <span><i style={{ background: "var(--pf-red)" }} /> {t("Interest")} {money(mort.interest, currency)}</span>
                            <span><i style={{ background: "var(--pf-green)" }} /> {t("Repayment")} {money(mort.repayment, currency)}</span>
                          </div>
                          {mort.end && <small>{t("Mortgage-free in {month} · {interest} interest still to pay", { month: monthYear(mort.end), interest: money(mort.totalInterest, currency) })}</small>}
                          <small>{t("Only the interest is a cost: the repayment moves money from your account into your home, so your equity grows by it every month.")}</small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                    <label className="pf-ob-more pf-ob-ai" data-busy={reading?.kind === "mortgage" || undefined}>
                      <Sparkles size={15} />
                      {reading?.kind === "mortgage" ? (
                        <span style={{ flex: 1 }}><ReadingProgress expect={reading.expect} landed={reading.landed} /></span>
                      ) : (
                        <span>{t("Let AI fill it in from your mortgage papers")}<small>{t("A PDF or photo of your offer or annual statement. Sent once to Claude to read, never kept.")}</small></span>
                      )}
                      <input type="file" accept={ACCEPT} hidden disabled={!!reading} onChange={(e) => { const f = e.target.files; if (f) void readDoc("mortgage", f); e.target.value = ""; }} />
                    </label>
                    {readError?.kind === "mortgage" && <p style={{ color: "var(--pf-red)", fontSize: "0.85rem" }}>{readError.text}</p>}
                  </>
                )}
                <span className="pf-unlock-hint">{t("Not at hand? Skip it — no problem. You can fill it in later under Real estate.")}</span>
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
              <Screen title={t("Do you invest?")} hint={t("Find each share, fund or coin and say how many you have: its value then follows the live price. Not listed? Add it by hand.")}>
                <div className="pf-ob-list">
                  {investments.map((x, i) => (
                    <InvestmentLine
                      key={x.key}
                      x={x}
                      currency={currency}
                      quotes={invQuotes}
                      AmountField={AmountField}
                      autoFocus={i === investments.length - 1 && !x.symbol && !x.name}
                      onChange={(patch) => setInvestments((all) => all.map((y) => (y.key === x.key ? { ...y, ...patch } : y)))}
                      onRemove={() => setInvestments((all) => all.filter((y) => y.key !== x.key))}
                    />
                  ))}
                  <button type="button" className="pf-bal-add" onClick={() => setInvestments([...investments, { key: crypto.randomUUID(), name: "", type: "stock", amount: "" }])}>
                    <Plus size={13} /> {t("Add investment")}
                  </button>
                  {investments.some((x) => invValue(x) > 0) && (
                    <div className="pf-inv-total">
                      <span>{t("Invested now")}</span>
                      <b className="pf-rounded">{money(investments.reduce((s2, x) => s2 + invValue(x), 0), currency)}</b>
                    </div>
                  )}
                </div>
              </Screen>
            )}

            {step === "fixed" && (
              <Screen title={t("Your fixed costs")} hint={`${t("The same every month. Tap what you have and fill in the amount — they become this month's fixed costs and budgets.")} ${t("Several bills in one? Add them up with +, like 40+24.")}${separate ? ` ${t("Subscriptions and insurance come next.")}` : ""}`}>
                <div className="pf-ob-list">
                  {fixed.map((f, i) => separate && OWN_SCREEN.includes(f.key) ? null : f.own ? (
                    <div key={f.key} className="pf-ob-line" data-on>
                      <CategoryIcon icon={f.icon} colorHex={f.color} size={30} />
                      <input className="pf-ob-name" autoFocus={!f.name} value={f.name} placeholder={t("Name, e.g. gym or childcare")} aria-label={t("Name")} onChange={(e) => setFixed(fixed.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <AmountField currency={currency} value={f.amount} label={t("Per month")} onChange={(v) => setFixed(fixed.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                      <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={() => setFixed(fixed.filter((_, j) => j !== i))}><X size={14} /></button>
                    </div>
                  ) : fixedRow(f, i))}
                  <button type="button" className="pf-bal-add" onClick={() => setFixed([...fixed, ownLine()])}>
                    <Plus size={13} /> {t("Add a fixed cost")}
                  </button>
                </div>
              </Screen>
            )}

            {step === "subscriptions" && (
              <Screen title={t("Your subscriptions")} hint={t("Tap what you pay for and fill in the price per month. Each one becomes a fixed cost under Subscriptions that books itself every month.")}>
                <div className="pf-ob-list">
                  {subs.map((x, i) => {
                    const set = (patch: Partial<Line>) => setSubs(subs.map((y, j) => (j === i ? { ...y, ...patch } : y)));
                    if (x.own)
                      return (
                        <div key={x.key} className="pf-ob-line" data-on>
                          <span className="pf-ob-loankind pf-ob-sub" style={{ ["--c" as string]: `#${x.color}` }}>{(x.name.trim()[0] ?? "+").toUpperCase()}</span>
                          <input className="pf-ob-name" autoFocus={!x.name} value={x.name} placeholder={t("Name, e.g. Videoland or a game pass")} aria-label={t("Name")} onChange={(e) => set({ name: e.target.value })} />
                          <DayField value={x.day} onChange={(day) => set({ day })} />
                          <AmountField currency={currency} value={x.amount} label={t("Per month")} onChange={(v) => set({ amount: v })} />
                          <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={() => setSubs(subs.filter((_, j) => j !== i))}><X size={14} /></button>
                        </div>
                      );
                    return (
                      <div key={x.key} className="pf-ob-line" data-on={x.on}>
                        <button className="pf-ob-toggle" aria-pressed={x.on} onClick={() => set({ on: !x.on })}>
                          <span className="pf-ob-loankind pf-ob-sub" style={{ ["--c" as string]: x.on ? `#${x.color}` : "#636366" }}>{x.icon}</span>
                          <span>{subName(x)}</span>
                          {x.on && <Check size={14} className="pf-ob-check" />}
                        </button>
                        {x.on && <DayField value={x.day} onChange={(day) => set({ day })} />}
                        {x.on && <AmountField autoFocus currency={currency} value={x.amount} label={t("{name} per month", { name: subName(x) })} onChange={(v) => set({ amount: v })} />}
                      </div>
                    );
                  })}
                  <button type="button" className="pf-bal-add" onClick={() => setSubs([...subs, ownSub()])}>
                    <Plus size={13} /> {t("Add a subscription")}
                  </button>
                </div>
              </Screen>
            )}

            {step === "insurance" && (
              <Screen title={t("Which insurance do you have?")} hint={t("Tap each policy and fill in the premium per month — the Insurance page checks your cover and keeps track of renewals.")}>
                <div className="pf-ob-list">
                  {policies.map((p, i) => {
                    const S = POLICIES.find((x) => x.kind === p.kind) ?? OWN_POLICY;
                    if (p.key)
                      return (
                        <div key={p.key} className="pf-ob-line" data-on>
                          <span className="pf-ob-loankind" style={{ ["--c" as string]: S.color }}><S.Icon size={16} /></span>
                          <input className="pf-ob-name" autoFocus={!p.name} value={p.name ?? ""} placeholder={t("Name, e.g. pet or phone insurance")} aria-label={t("Name")} onChange={(e) => setPolicies(policies.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                          <AmountField currency={currency} value={p.premium} label={t("Per month")} onChange={(v) => setPolicies(policies.map((x, j) => (j === i ? { ...x, premium: v } : x)))} />
                          <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={() => setPolicies(policies.filter((_, j) => j !== i))}><X size={14} /></button>
                        </div>
                      );
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
                  <button type="button" className="pf-bal-add" onClick={() => setPolicies([...policies, { key: crypto.randomUUID(), kind: "other", name: "", premium: "", on: true }])}>
                    <Plus size={13} /> {t("Add insurance")}
                  </button>
                </div>
              </Screen>
            )}

            {step === "balance" && (
              <Screen title={t("Your other debts")} hint={t("Optional — a student loan, car loan or credit card. It goes on your balance sheet.")}>
                <div className="pf-ob-list">
                  <span className="pf-ob-sublabel">{t("Other loans")}</span>
                  {loans.map((l, i) => {
                    const S = LOAN_STYLE[l.kind];
                    const set = (patch: Partial<typeof l>) => setLoans(loans.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <div key={l.key} className="pf-ob-loanrow">
                        <div className="pf-ob-line pf-ob-loan">
                          <span className="pf-ob-loankind" style={{ ["--c" as string]: S.color }} title={t(S.label)}>
                            <S.Icon key={l.kind} size={16} />
                          </span>
                          <input className="pf-ob-name" value={l.name} placeholder={l.kind === "other" ? t("Name, e.g. family loan") : t(S.label)} aria-label={t("Name")} onChange={(e) => set({ name: e.target.value })} />
                          <AmountField currency={currency} value={l.amount} label={t("Left now")} onChange={(v) => set({ amount: v })} />
                          <button type="button" className="pf-icon-button" aria-label={t("Remove loan")} onClick={() => setLoans(loans.filter((_, j) => j !== i))}>
                            <X size={14} />
                          </button>
                        </div>
                        {/* What kind of loan; not listed → Other, with its own name. */}
                        <div className="pf-ob-chips" role="group" aria-label={t("Kind")}>
                          {LOAN_KINDS.map((k) => {
                            const K = LOAN_STYLE[k];
                            return (
                              <button key={k} type="button" aria-pressed={l.kind === k} style={{ ["--c" as string]: K.color }} onClick={() => set({ kind: k })}>
                                <K.Icon size={13} /> {t(K.label)}
                              </button>
                            );
                          })}
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
                  <button type="button" className="pf-bal-add" onClick={() => setLoans([...loans, { key: crypto.randomUUID(), kind: "other", name: "", amount: "", rate: "", monthly: "" }])}>
                    <Plus size={13} /> {t("Add loan")}
                  </button>
                  {loans.length > 0 && route !== "complete" && <span className="pf-unlock-hint">{t("Interest and the monthly payment can be added later under Loans — then the debt goes down by itself.")}</span>}
                </div>
              </Screen>
            )}

            {step === "budgets" && (
              <Screen title={t("Budgets for the rest")} hint={netIncome ? t("Suggested from your income — adjust them, or switch off what you don't need.") : t("Set a monthly limit for each, or switch off what you don't need.")}>
                <div className="pf-ob-list">
                  {budgetLines.map((b, i) => b.own ? (
                    <div key={b.key} className="pf-ob-line" data-on>
                      <CategoryIcon icon={b.icon} colorHex={b.color} size={30} />
                      <input className="pf-ob-name" autoFocus={!b.name} value={b.name} placeholder={t("Name, e.g. hobbies or kids")} aria-label={t("Name")} onChange={(e) => setBudgets(budgetLines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <AmountField currency={currency} value={b.amount} label={t("Per month")} onChange={(v) => setBudgets(budgetLines.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                      <button type="button" className="pf-icon-button" aria-label={t("Remove")} onClick={() => setBudgets(budgetLines.filter((_, j) => j !== i))}><X size={14} /></button>
                    </div>
                  ) : (
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
                  <button type="button" className="pf-bal-add" onClick={() => setBudgets([...budgetLines, ownLine()])}>
                    <Plus size={13} /> {t("Add a budget")}
                  </button>
                </div>
              </Screen>
            )}

            {step === "goal" && (
              <Screen title={t("What are you saving for?")} hint={t("A goal on your Progress page, with what you need to put aside each month.")}>
                <div className="pf-ob-list">
                  <Labeled label={t("Name")}><input className="pf-input pf-ob-amount" placeholder={t("Emergency fund")} value={goal.name} onChange={(e) => setGoal({ ...goal, name: e.target.value })} /></Labeled>
                  <Labeled label={t("Target")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={goal.amount} onChange={(e) => setGoal({ ...goal, amount: e.target.value })} /></Labeled>
                </div>
                <div className="pf-ob-goalterm">
                  <span>
                    {t("Within")} <b style={{ color: "var(--pf-ink)" }}>{goal.months < 12 || goal.months % 12 ? t("{n} months", { n: goal.months }) : t("{n} years", { n: goal.months / 12 })}</b>
                    {" · "}
                    {t("by {date}", { date: monthYear(new Date(now.getFullYear(), now.getMonth() + goal.months, 1)) })}
                  </span>
                  <StepSlider
                    label={t("Within")}
                    animKey="goal"
                    value={Math.max(0, TERMS.findIndex((m) => m >= goal.months))}
                    onChange={(i) => setGoal({ ...goal, months: TERMS[i] })}
                    steps={TERMS.map((m) => ({ label: m < 12 || m % 12 ? t("{n} mo", { n: m }) : t("{n} yrs", { n: m / 12 }), full: t("{n} months", { n: m }) }))}
                  />
                </div>
                {num(goal.amount) > 0 && (
                  <p key={`${goal.amount}-${goal.months}`} className="pf-readout pf-loan-preview">
                    {t("{amount} a month", { amount: money(num(goal.amount) / goal.months, currency) })}
                    {netIncome > 0 && ` · ${t("{pct}% of your income", { pct: Math.round((num(goal.amount) / goal.months / netIncome) * 100) })}`}
                  </p>
                )}
                {/* The buffer: how long the accounts should carry you without income. */}
                <div className="pf-ob-goalterm">
                  <span>
                    {t("Buffer goal")} <b style={{ color: "var(--pf-ink)" }}>{t("{n} months", { n: runwayGoal })}</b>
                    {(reveal.fixed + reveal.budgets) > 0 && <>{" · "}{money((reveal.fixed + reveal.budgets) * runwayGoal, currency)}</>}
                  </span>
                  <StepSlider
                    label={t("Buffer goal")}
                    animKey="buffer"
                    value={Math.max(0, BUFFERS.indexOf(runwayGoal))}
                    onChange={(i) => setRunwayGoal(BUFFERS[i])}
                    steps={BUFFERS.map((m) => ({ label: t("{n} mo", { n: m }), full: t("{n} months", { n: m }) }))}
                  />
                  <small className="pf-ob-note" style={{ paddingInlineStart: 0 }}>{t("How many months your accounts should cover your fixed costs and budgets if no income came in. 3–6 months is usual.")}</small>
                </div>
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

            {step === "statement" && (
              <Screen title={t("Let AI read your bank statement")} hint={t("Drop a PDF statement or screenshots of your bank app. The AI lists what came in and went out, with a category for each — you check the list as soon as your books are open.")}>
                {statementRows !== undefined && !reading ? (
                  <p className="pf-sub-on"><Check size={16} /> {t("{n} transactions read. You'll check them on your dashboard right after this.", { n: statementRows })}</p>
                ) : (
                  <label className="pf-ai-drop" data-busy={reading?.kind === "bank" || undefined} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!reading) void readDoc("bank", e.dataTransfer.files); }}>
                    {reading?.kind === "bank" ? (
                      <ReadingProgress expect={reading.expect} landed={reading.landed} />
                    ) : (
                      <>
                        <FileText size={28} />
                        <b>{t("Choose your statement")}</b>
                        <span>{t("Up to 8 screenshots of your bank app, or a PDF statement.")}</span>
                      </>
                    )}
                    <input type="file" accept={ACCEPT} multiple hidden disabled={!!reading} onChange={(e) => { const f = e.target.files; if (f) void readDoc("bank", f); e.target.value = ""; }} />
                  </label>
                )}
                {readError?.kind === "bank" && <p style={{ color: "var(--pf-red)", fontSize: "0.85rem" }}>{readError.text}</p>}
                <span className="pf-unlock-hint">{t("The file is sent once to Claude, the AI of Anthropic, only to read it: it's never kept or used for training. Nothing is added until you've checked it.")}</span>
                <span className="pf-unlock-hint">{t("Rather later? Skip it — no problem. It's always there under Expenses › Read with AI.")}</span>
              </Screen>
            )}

            {step === "security" && (
              <Screen title={t("Keeping your books up to date")} hint={t("A short check-in now and then keeps every figure right — and earns points on your Progress page.")}>
                <div className="pf-ob-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                  {[
                    { v: "daily" as const, t: t("Daily"), d: t("A minute a day") },
                    { v: "twice-weekly" as const, t: t("Twice a week"), d: t("Pick two days") },
                    { v: "weekly" as const, t: t("Weekly"), d: t("Pick a day") },
                  ].map((o) => (
                    <button key={o.v} className="pf-ob-choice" aria-pressed={checkin === o.v} onClick={() => setCheckin(o.v)}>
                      <span><b>{o.t}</b><small>{o.d}</small></span>
                    </button>
                  ))}
                </div>
                {checkin !== "daily" && (
                  <WeekdayPicker key={checkin} interval={checkin} days={checkinDays} onChange={setCheckinDays} />
                )}
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
        </div>

        <Preview totals={totals} netIncome={netIncome} currency={currency} step={step} fixed={costLines} budgets={budgetLines} />
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
  // Live from the moment income is known: this month so far (income and
  // costs spread over every second of the month), and equity moving from
  // here at what's left to save per second. The day and time on top.
  const now = useNow(250);
  const [opened] = useState(() => Date.now());
  const frac = monthFraction(now);
  const d = new Date(now);
  const daysIn = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const monthMs = daysIn * 86_400_000;
  const live = netIncome > 0;
  const earned = netIncome * frac;
  const spent = (totals.fixedTotal + totals.budgetTotal) * frac;
  const equityLive = eq + (live ? (totals.left / monthMs) * (now - opened) : 0);
  const base = Math.max(netIncome, totals.fixedTotal + totals.budgetTotal, 1);
  // Where the money goes, in a few calm blocks: each fixed cost, then all
  // subscriptions as one, all insurance as one, all budgets as one; pieces
  // too small to read (< 4%) go together as "the rest".
  const groups = new Map<string, { v: number; c: string; n: string }>();
  const put = (k: string, v: number, c: string, n: string) => groups.set(k, { v: (groups.get(k)?.v ?? 0) + v, c, n });
  for (const f of fixed.filter((f) => f.on && num(f.amount) > 0)) {
    const sub = f.key.startsWith("sub-"), ins = f.key.startsWith("ins-");
    put(sub ? "subs" : ins ? "ins" : f.key, num(f.amount), sub ? "#BF5AF2" : ins ? "#E63946" : `#${f.color}`, sub ? t("Subscriptions") : ins ? t("Insurance") : f.own ? f.name : t(f.name));
  }
  const budgeted = budgets.filter((b) => b.on).reduce((s2, b) => s2 + num(b.amount), 0);
  if (budgeted > 0) put("budgets", budgeted, "#2E8B57", t("Budgets"));
  const parts: { k: string; v: number; c: string; n: string }[] = [];
  const small: string[] = [];
  let rest = 0;
  for (const [k, g] of groups) if (g.v / base < 0.04) { rest += g.v; small.push(g.n); } else parts.push({ k, v: g.v, c: g.c, n: g.n });
  if (rest > 0) parts.push({ k: "rest", v: rest, c: "#636366", n: small.length === 1 ? small[0] : small.join(", ") });
  // Hovering (or tapping) a block names it below the bar.
  const [hover, setHover] = useState<string | null>(null);
  const shown = parts.find((p) => p.k === hover);
  const lit = (s: Step[]) => (s.includes(step) ? "true" : "false");
  return (
    <aside className="pf-ob-preview" aria-label={t("Your month so far")}>
      <div className="pf-ob-preview-head">{t("Your month")}</div>
      <div className="pf-ob-clock">
        <b>{d.toLocaleDateString(intlLocale(), { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (c) => c.toLocaleUpperCase(intlLocale()))}</b>
        <span className="pf-rounded">{d.toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        <div className="pf-ob-clock-bar"><i style={{ width: `${frac * 100}%` }} /></div>
        <small>{t("Day {n} of {total}", { n: d.getDate(), total: daysIn })} · {Math.round(frac * 100)}%</small>
      </div>
      {live && (
        <div className="pf-ob-live">
          <div><span><i className="pf-ob-live-dot" /> {t("Earned so far")}</span><LiveAmount value={earned} currency={currency} size="0.95rem" color="var(--pf-green)" /></div>
          <div><span>{t("Spent so far")}</span><LiveAmount value={spent} currency={currency} size="0.95rem" color="var(--pf-red)" /></div>
          <div><span>{t("Saved so far")}</span><LiveAmount value={earned - spent} currency={currency} size="0.95rem" color={earned - spent >= 0 ? "#40c8e0" : "var(--pf-red)"} /></div>
        </div>
      )}
      <div className="pf-ob-stat" data-lit={lit(["income"])}>
        <span>{t("Comes in")}</span>
        <b className="pf-rounded" style={{ color: "var(--pf-green)" }}>{money(inc, currency)}</b>
      </div>
      <div className="pf-ob-flow">
        <div className="pf-ob-flow-in" style={{ width: `${(netIncome / base) * 100}%` }} />
        <div className="pf-ob-flow-out">
          {parts.map((p) => (
            <span key={p.k} data-dim={hover != null && hover !== p.k} style={{ flexBasis: `${(p.v / base) * 100}%`, background: p.c }} title={`${p.n} · ${money(p.v, currency)}`} onMouseEnter={() => setHover(p.k)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === p.k ? null : p.k)} />
          ))}
        </div>
        {/* Always the same height, so the panel doesn't move when it shows. */}
        <div className="pf-ob-flow-tip" data-on={!!shown}>
          {shown && (
            <>
              <i style={{ background: shown.c }} />
              <span>{shown.n}</span>
              <b className="pf-rounded">{money(shown.v, currency)}</b>
              <small>{Math.round((shown.v / Math.max(netIncome, 1)) * 100)}%</small>
            </>
          )}
        </div>
      </div>
      <div className="pf-ob-stat" data-lit={lit(["fixed", "subscriptions", "insurance"])}>
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
      <div className="pf-ob-stat pf-ob-stat-big" data-lit={lit(["investments", "housing", "balance", "done"])}>
        <span>{t("Equity")}</span>
        {live ? <LiveAmount value={equityLive} currency={currency} size="1.25rem" color="#40c8e0" /> : <b className="pf-rounded" style={{ color: "#40c8e0" }}>{money(eq, currency)}</b>}
      </div>
    </aside>
  );
}
