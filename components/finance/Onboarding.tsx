"use client";

import { newHousehold } from "@/lib/finance/household";
import { t, intlLocale } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, X } from "lucide-react";
import { live } from "@/lib/finance/calc";
import { currencyName } from "@/lib/finance/currencies";
import { money } from "@/lib/finance/format";
import BrandMark from "./BrandMark";
import { useTween } from "./charts";
import CategoryIcon from "./CategoryIcon";
import { useFinance } from "./FinanceProvider";

// Onboarding — "open your books": a few short steps, one question per
// screen, while a live preview beside it (on wide screens) builds the
// month as you answer: income, fixed costs, budgets, what's left to save,
// and your equity. Every step can be skipped; the last one shows the
// result and opens the dashboard.
//
// `preview` (the draft for review): nothing is saved — the last step says
// so. Otherwise finishing writes the profile, accounts, this month's fixed
// costs (as fixed transactions + budgets), budgets and balance posts.

type Step = "welcome" | "currency" | "household" | "income" | "accounts" | "fixed" | "budgets" | "balance" | "history" | "done";
const STEPS: Step[] = ["welcome", "currency", "household", "income", "accounts", "fixed", "budgets", "balance", "history", "done"];

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

const num = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

export default function Onboarding({ preview, onClose }: { preview: boolean; onClose: () => void }) {
  const { data, now, updateProfile, saveAccount, setBudget, addCategory, addTransaction, addBalanceItem, source } = useFinance();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [currency, setCurrency] = useState(data.profile.currency_code || "EUR");
  const [net, setNet] = useState("");
  const [gross, setGross] = useState("");
  const [payday, setPayday] = useState(25);
  // Who keeps these books: just me, or two people (incomes per person,
  // expenses paid by one or shared).
  const [together, setTogether] = useState((data.profile.household ?? []).length >= 2);
  const [names, setNames] = useState<[string, string]>([
    data.profile.household?.[0]?.name ?? t("Me"),
    data.profile.household?.[1]?.name ?? t("Partner"),
  ]);
  const [accounts, setAccounts] = useState([
    { key: "checking", name: t("Current account"), type: "checking" as const, amount: "" },
    { key: "savings", name: t("Savings"), type: "savings" as const, amount: "" },
  ]);
  const [fixed, setFixed] = useState<Line[]>(FIXED.map((f) => ({ ...f, amount: "", on: false })));
  const [budgets, setBudgets] = useState<Line[] | null>(null);
  const [home, setHome] = useState({ value: "", mortgage: "", loans: "" });
  const [history, setHistory] = useState<"now" | "january" | "years">("now");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const id = STEPS[step];
  const netIncome = num(net);
  // Budgets are suggested once income is known; edits stay.
  const budgetLines = budgets ?? BUDGETS.map((b) => ({ ...b, amount: netIncome ? String(Math.round((netIncome * b.share) / 10) * 10) : "", on: true }));

  const totals = useMemo(() => {
    const fixedTotal = fixed.filter((f) => f.on).reduce((t, f) => t + num(f.amount), 0);
    const budgetTotal = budgetLines.filter((b) => b.on).reduce((t, b) => t + num(b.amount), 0);
    const cash = accounts.reduce((t, a) => t + num(a.amount), 0);
    const equity = cash + num(home.value) - num(home.mortgage) - num(home.loans);
    return { fixedTotal, budgetTotal, left: netIncome - fixedTotal - budgetTotal, cash, equity };
  }, [fixed, budgetLines, accounts, home, netIncome]);

  const go = (d: 1 | -1) => {
    setDir(d);
    setStep((s) => Math.min(Math.max(s + d, 0), STEPS.length - 1));
  };

  // Enter continues; Escape closes.
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && id !== "done") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    card.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, [step]);

  async function finish() {
    if (preview) {
      setSaved(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const month = new Date(now.getFullYear(), now.getMonth(), 1);
      await updateProfile({
        currency_code: currency,
        expected_net_monthly: netIncome ? netIncome.toFixed(2) : null,
        expected_gross_monthly: num(gross) ? num(gross).toFixed(2) : null,
        payday_day: payday,
        household: together ? newHousehold(names[0].trim() || t("Me"), names[1].trim() || t("Partner"), () => crypto.randomUUID()) : [],
      });
      const def = live(data.accounts).find((a) => a.is_default);
      for (const a of accounts) {
        if (!num(a.amount) && a.type !== "checking") continue;
        await saveAccount({ id: a.type === "checking" ? def?.id : undefined, name: a.name, type: a.type, balance: num(a.amount) });
      }
      const cats = live(data.categories);
      const categoryFor = async (name: string, icon: string, color: string, isFixed: boolean) =>
        cats.find((c) => c.name.toLowerCase() === name.toLowerCase() && !c.parent_id) ??
        (await addCategory({ name, icon, color_hex: color, is_income_category: false, is_fixed_expense: isFixed }));
      for (const f of fixed.filter((f) => f.on && num(f.amount) > 0)) {
        const c = await categoryFor(t(f.name), f.icon, f.color, true);
        await setBudget(c.id, month, num(f.amount));
        await addTransaction({
          amount: num(f.amount).toFixed(2), type: "expense", date: new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString(),
          note: f.name, is_auto_income: false, is_fixed_expense: true, recurrence_id: crypto.randomUUID(), category_id: c.id, account_id: null,
        });
      }
      for (const b of budgetLines.filter((b) => b.on && num(b.amount) > 0)) {
        const c = await categoryFor(b.key, b.icon, b.color, false);
        await setBudget(c.id, month, num(b.amount));
      }
      if (num(home.value)) await addBalanceItem({ name: t("Home"), side: "asset", value: num(home.value) });
      if (num(home.mortgage)) await addBalanceItem({ name: t("Mortgage"), side: "liability", value: num(home.mortgage) });
      if (num(home.loans)) await addBalanceItem({ name: t("Other loans"), side: "liability", value: num(home.loans) });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const progress = step / (STEPS.length - 1);

  return (
    <div className="pf-ob" role="dialog" aria-modal="true" aria-label={t("Set up your finances")}>
      <div className="pf-ob-glow" />
      <button className="pf-ob-close pf-icon-button" aria-label={t("Close")} onClick={onClose}>
        <X size={18} />
      </button>

      <div className="pf-ob-layout">
        <div className="pf-ob-card" ref={card}>
          <div className="pf-ob-progress" aria-hidden>
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          {preview && <div className="pf-ob-draft">{t("Draft · preview — nothing is saved")}</div>}

          <div key={id} className="pf-ob-step" data-dir={dir}>
            {id === "welcome" && (
              <Screen>
                <div className="pf-ob-mark">
                  <BrandMark size={72} currency={currency} />
                </div>
                <h1>{t("Run your money like a business.")}</h1>
                <p>{t("A few questions and your books are open: what comes in, what goes out, what you own and what you owe. About two minutes — and you can skip anything.")}</p>
              </Screen>
            )}

            {id === "currency" && (
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

            {id === "household" && (
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

            {id === "income" && (
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

            {id === "accounts" && (
              <Screen title={t("What's in your accounts today?")} hint={t("Your starting point. From here every month adds what you saved.")}>
                <div className="pf-ob-list">
                  {accounts.map((a, i) => (
                    <div key={a.key} className="pf-ob-line">
                      <input className="pf-ob-name" value={a.name} aria-label={t("Account name")} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={a.amount} aria-label={t("{name} balance", { name: a.name })} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                    </div>
                  ))}
                  <button className="pf-bal-add" onClick={() => setAccounts([...accounts, { key: crypto.randomUUID(), name: t("Another account"), type: "savings", amount: "" }])}>
                    <Plus size={13} /> {t("Add account")}
                  </button>
                </div>
              </Screen>
            )}

            {id === "fixed" && (
              <Screen title={t("Your fixed costs")} hint={t("The same every month. Tap what you have and fill in the amount — they become this month's fixed costs and budgets.")}>
                <div className="pf-ob-list">
                  {fixed.map((f, i) => (
                    <div key={f.key} className="pf-ob-line" data-on={f.on}>
                      <button className="pf-ob-toggle" aria-pressed={f.on} onClick={() => setFixed(fixed.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}>
                        <CategoryIcon icon={f.icon} colorHex={f.on ? f.color : "3a3a3c"} size={30} />
                        <span>{t(f.name)}</span>
                        {f.on && <Check size={14} className="pf-ob-check" />}
                      </button>
                      {f.on && (
                        <input className="pf-input pf-ob-amount" inputMode="decimal" autoFocus placeholder={money(0, currency)} value={f.amount} aria-label={t("{name} per month", { name: t(f.name) })} onChange={(e) => setFixed(fixed.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                      )}
                    </div>
                  ))}
                </div>
              </Screen>
            )}

            {id === "budgets" && (
              <Screen title={t("Budgets for the rest")} hint={netIncome ? t("Suggested from your income — adjust them, or switch off what you don't need.") : t("Set a monthly limit for each, or switch off what you don't need.")}>
                <div className="pf-ob-list">
                  {budgetLines.map((b, i) => (
                    <div key={b.key} className="pf-ob-line" data-on={b.on}>
                      <button className="pf-ob-toggle" aria-pressed={b.on} onClick={() => setBudgets(budgetLines.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}>
                        <CategoryIcon icon={b.icon} colorHex={b.on ? b.color : "3a3a3c"} size={30} />
                        <span>{t(b.name)}</span>
                      </button>
                      {b.on && (
                        <input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={b.amount} aria-label={t("{name} budget", { name: t(b.name) })} onChange={(e) => setBudgets(budgetLines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                      )}
                    </div>
                  ))}
                </div>
              </Screen>
            )}

            {id === "balance" && (
              <Screen title={t("Do you own a home?")} hint={t("Optional — it goes on your balance sheet. A real-estate module with mortgage details comes later.")}>
                <div className="pf-ob-list">
                  <Labeled label={t("Home value (WOZ or estimate)")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={home.value} onChange={(e) => setHome({ ...home, value: e.target.value })} /></Labeled>
                  <Labeled label={t("Mortgage remaining")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={home.mortgage} onChange={(e) => setHome({ ...home, mortgage: e.target.value })} /></Labeled>
                  <Labeled label={t("Other loans (car, study…)")}><input className="pf-input pf-ob-amount" inputMode="decimal" placeholder={money(0, currency)} value={home.loans} onChange={(e) => setHome({ ...home, loans: e.target.value })} /></Labeled>
                </div>
              </Screen>
            )}

            {id === "history" && (
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

            {id === "done" && (
              <Screen>
                <div className="pf-ob-mark pf-ob-mark-done">
                  <Sparkles size={34} />
                </div>
                <h1>{saved ? (preview ? t("That was the preview.") : t("Your books are open.")) : t("Ready to open your books")}</h1>
                <p>
                  {saved
                    ? preview
                      ? t("Nothing was saved. Tell me what to change — order, wording, steps — and this becomes the real thing.")
                      : t("Your dashboard is ready. The month counts along live from here.")
                    : t("Each month {income} comes in; {fixed} is fixed and {budgets} budgeted — leaving {left} to save.", { income: money(netIncome, currency), fixed: money(totals.fixedTotal, currency), budgets: money(totals.budgetTotal, currency), left: money(totals.left, currency) })}
                </p>
                {error && <p style={{ color: "var(--pf-red)" }}>{error}</p>}
                {source === "supabase" && !preview && !saved && <p className="pf-ob-note">{t("This saves to your account.")}</p>}
              </Screen>
            )}
          </div>

          <div className="pf-ob-nav">
            {step > 0 && id !== "done" ? (
              <button className="pf-link" onClick={() => go(-1)}>
                <ArrowLeft size={15} /> Back
              </button>
            ) : (
              <span />
            )}
            <span className="pf-ob-count">{step > 0 && id !== "done" ? t("{step} of {total}", { step, total: STEPS.length - 2 }) : ""}</span>
            {id === "done" ? (
              saved ? (
                <button className="pf-button" onClick={onClose}>
                  {preview ? t("Close preview") : t("Open my dashboard")} <ArrowRight size={16} />
                </button>
              ) : (
                <button className="pf-button" onClick={finish} disabled={saving}>
                  {saving ? t("Opening…") : preview ? t("Finish preview") : t("Open my books")} <ArrowRight size={16} />
                </button>
              )
            ) : (
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {id !== "welcome" && (
                  <button className="pf-link" onClick={() => go(1)}>
                    {t("Skip")}
                  </button>
                )}
                <button className="pf-button" onClick={() => go(1)}>
                  {id === "welcome" ? t("Let's start") : t("Continue")} <ArrowRight size={16} />
                </button>
              </span>
            )}
          </div>
        </div>

        <Preview totals={totals} netIncome={netIncome} currency={currency} step={id} fixed={fixed} budgets={budgetLines} />
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
      <div className="pf-ob-stat" data-lit={lit(["fixed"])}>
        <span>{t("Fixed costs")}</span>
        <b className="pf-rounded">{money(fix, currency)}</b>
      </div>
      <div className="pf-ob-stat" data-lit={lit(["budgets"])}>
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
      <div className="pf-ob-stat pf-ob-stat-big" data-lit={lit(["balance", "done"])}>
        <span>{t("Equity")}</span>
        <b className="pf-rounded" style={{ color: "#40c8e0" }}>{money(eq, currency)}</b>
      </div>
    </aside>
  );
}
