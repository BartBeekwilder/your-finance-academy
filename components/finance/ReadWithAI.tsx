"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, CopyCheck, History, ImageUp, Sparkles, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { live, num } from "@/lib/finance/calc";
import { money, monthYear, shortMonth } from "@/lib/finance/format";
import { bookedAs, isTransfer, learnCategories, suggestCategory, type ReadRow } from "@/lib/finance/importMatch";
import type { ReadResult } from "@/lib/ai/reader";
import { intlLocale, t } from "@/lib/i18n";
import { useFinance } from "./FinanceProvider";
import { salaryOf } from "./Payslips";
import Sheet from "./Sheet";

// Read with AI (Premium): a bank screenshot on Expenses, a payslip on
// Income, a mortgage document on Real estate. The first time it asks for
// consent (the file goes to Claude for this one read; profile.ai_consent_at).
// Images are shrunk in the browser first. What comes back is shown for
// checking — rows can be ticked off, categories changed — and nothing is
// booked until "Add". The file itself is never kept.

type Kind = "bank" | "payslip" | "mortgage";
type Step = "consent" | "pick" | "reading" | "review" | "done";

export const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf";
const MAX_SIDE = 1800;
const MAX_PDF = 3 * 1024 * 1024;
const TITLE: Record<Kind, string> = { bank: "Read bank screenshots", payslip: "Read payslip", mortgage: "Read mortgage document" };
const PICK: Record<Kind, string> = { bank: "Choose screenshots", payslip: "Choose payslip", mortgage: "Choose document" };

const b64 = (buf: ArrayBuffer) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** An image as a JPEG of at most MAX_SIDE px; a PDF as is. */
async function prepare(file: File): Promise<{ mime: string; data: string }> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF) throw new Error(t("This PDF is too large (max 3 MB)."));
    return { mime: file.type, data: b64(await file.arrayBuffer()) };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(t("This image can't be opened here. Use a screenshot (PNG or JPEG)."));
  }
  const s = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * s);
  canvas.height = Math.round(bitmap.height * s);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), "image/jpeg", 0.86));
  return { mime: "image/jpeg", data: b64(await blob.arrayBuffer()) };
}

/** Send files to /api/ai/read and return what was read (throws a message). */
export async function readFiles<K extends Kind>(kind: K, list: FileList | File[], categories: string[], signedIn: boolean): Promise<ReadResult[K]> {
  const files = [...list].slice(0, kind === "bank" ? 8 : 1);
  const prepared = await Promise.all(files.map(prepare));
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signedIn) {
    const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const r = await fetch("/api/ai/read", { method: "POST", headers, body: JSON.stringify({ kind, files: prepared, today: isoDay(new Date()), categories }) });
  const j = await r.json().catch(() => ({ error: t("Something went wrong.") }));
  if (!r.ok) throw Object.assign(new Error(j.error ? t(j.error) : t("Something went wrong.")), { nextAt: (j.next_at as string | undefined) ?? null });
  return j;
}

/** Reads left in the last 24 hours (2 per account; null = no limit here,
 *  e.g. the local dev site or the demo). */
export type AiQuota = { limit: number; used: number; left: number; next_at: string | null };
export function useAiQuota(signedIn: boolean, when: unknown = true) {
  const [q, setQ] = useState<AiQuota | null>(null);
  useEffect(() => {
    if (!signedIn || !when) return;
    let off = false;
    (async () => {
      const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
      if (!token) return;
      const r = await fetch("/api/ai/read", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      const j = r?.ok ? ((await r.json()) as AiQuota | null) : null;
      if (!off) setQ(j);
    })();
    return () => { off = true; };
  }, [signedIn, when]);
  return [q, setQ] as const;
}

/** "2 of 2 reads left today", or when the next one frees up — with the tip to make it a weekly habit. */
export function QuotaNote({ q }: { q: AiQuota | null }) {
  if (!q) return null;
  const at = q.next_at ? new Date(q.next_at) : null;
  return (
    <p className="pf-ai-quota" data-empty={q.left <= 0 || undefined}>
      {q.left > 0
        ? t("{n} of {limit} reads left today.", { n: q.left, limit: q.limit })
        : at
          ? t("No reads left today. You can read again on {when}.", { when: at.toLocaleString(intlLocale(), { weekday: "long", hour: "2-digit", minute: "2-digit" }) })
          : t("No reads left today.")}{" "}
      <span>{t("Tip: once a week is plenty — collect the week's screenshots and read them in one go.")}</span>
    </p>
  );
}

/** About how long reading takes, in seconds (a PDF ~half a minute, a screenshot ~10 s). */
export const expectedSeconds = (files: FileList | File[]) => Math.min(60, [...files].slice(0, 8).reduce((s, f) => s + (f.type === "application/pdf" ? 28 : 9), 0));

/** A statement read during the setup waits here (this tab only) until the
 *  books are open; the dashboard offers it for checking (PendingStatement).
 *  `demo`: read in the preview — only the demo may show it, never an account. */
export const PENDING_KEY = "pf-ai-pending-statement";
export type Pending = { rows: ReadRow[]; demo: boolean };
export function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Pending | ReadRow[];
    return Array.isArray(v) ? { rows: v, demo: false } : v;
  } catch {
    return null;
  }
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const atNoon = (day: string) => new Date(`${day}T12:00:00`).toISOString();
const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export default function ReadWithAI({ kind, propertyId }: { kind: Kind; propertyId?: string }) {
  const { data, updateProfile, source } = useFinance();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReadResult[Kind] | null>(null);
  const [added, setAdded] = useState(0);
  const [origin, setOrigin] = useState<Element | null>(null);
  const consented = !!data.profile.ai_consent_at;
  const [quota, setQuota] = useAiQuota(source === "supabase" || source === "vault", open);
  // Reading: roughly how long it'll take (a PDF ~half a minute, a
  // screenshot ~10 s), for the progress bar; `landed` fills it before the list.
  const [expect, setExpect] = useState(10);
  const [landed, setLanded] = useState(false);
  // The review list gets the wide sheet, which has no padding of its own.
  const wide = kind !== "payslip" && step === "review";

  function start(from: Element) {
    setOrigin(from);
    setError(null);
    setResult(null);
    setStep(consented ? "pick" : "consent");
    setOpen(true);
  }

  async function read(list: FileList | File[]) {
    if (!list.length) return;
    setError(null);
    setExpect(expectedSeconds(list));
    setLanded(false);
    setStep("reading");
    try {
      const j = await readFiles(kind, list, kind === "bank" ? live(data.categories).map((c) => c.name) : [], source === "supabase" || source === "vault");
      setLanded(true);
      if (quota) setQuota({ ...quota, used: quota.used + 1, left: Math.max(0, quota.left - 1) });
      await new Promise((ok) => setTimeout(ok, 450));
      setResult(j);
      setStep("review");
    } catch (e) {
      const nextAt = (e as { nextAt?: string | null }).nextAt;
      if (nextAt) setQuota((q) => ({ limit: q?.limit ?? 2, used: q?.limit ?? 2, left: 0, next_at: nextAt }));
      else if (quota) setQuota({ ...quota });
      setError((e as Error).message);
      setStep("pick");
    }
  }

  return (
    <>
      <button type="button" className="pf-chip" onClick={(e) => start(e.currentTarget)}>
        <Sparkles size={14} /> {t(TITLE[kind])}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} origin={origin} label={t(TITLE[kind])} wide={wide}>
        <div className="pf-ai-body" data-wide={wide || undefined}>
          <button type="button" className="pf-icon-button pf-ai-close" aria-label={t("Close")} onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 650, display: "flex", alignItems: "center", gap: 8, paddingRight: 36 }}>
            <Sparkles size={18} color="#bf5af2" /> {t(TITLE[kind])}
          </h2>

          {step === "consent" && (
            <>
              <p style={{ color: "var(--pf-ink-2)", lineHeight: 1.5 }}>
                {t("To read it, the image or PDF is sent once to Claude, the AI of Anthropic. It's used only to read the figures: we don't keep the file, and Anthropic doesn't use it to train its AI. Besides the file, only your category names are sent, so a category can be suggested.")}
              </p>
              <p style={{ color: "var(--pf-ink-2)", lineHeight: 1.5 }}>{t("Nothing is added until you've checked it.")}</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="pf-button" onClick={async () => { await updateProfile({ ai_consent_at: new Date().toISOString() }); setStep("pick"); }}>
                  {t("Agree and continue")}
                </button>
                <button className="pf-chip" onClick={() => setOpen(false)}>{t("Not now")}</button>
              </div>
            </>
          )}

          {(step === "pick" || step === "reading") && (
            <label
              className="pf-ai-drop"
              data-busy={step === "reading" || undefined}
              data-off={(step === "pick" && quota?.left === 0) || undefined}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (step === "pick" && quota?.left !== 0) void read(e.dataTransfer.files); }}
            >
              {step === "reading" ? (
                <ReadingProgress expect={expect} landed={landed} />
              ) : (
                <>
                  <ImageUp size={28} />
                  <b>{t(PICK[kind])}</b>
                  <span>{kind === "bank" ? t("Up to 8 screenshots of your bank app, or a PDF statement.") : t("A PDF or a photo.")}</span>
                </>
              )}
              <input type="file" accept={ACCEPT} multiple={kind === "bank"} hidden disabled={step === "reading" || quota?.left === 0} onChange={(e) => { const f = e.target.files; if (f) void read(f); e.target.value = ""; }} />
            </label>
          )}
          {step === "pick" && <QuotaNote q={quota} />}

          {step === "review" && result && kind === "bank" && <BankReview rows={(result as ReadResult["bank"]).transactions} onDone={(n) => { setAdded(n); setStep("done"); }} />}
          {step === "review" && result && kind === "payslip" && <PayslipReview read={result as ReadResult["payslip"]} onDone={() => { setAdded(1); setStep("done"); }} />}
          {step === "review" && result && kind === "mortgage" && propertyId && <MortgageReview read={result as ReadResult["mortgage"]} propertyId={propertyId} onDone={(n) => { setAdded(n); setStep("done"); }} />}

          {step === "done" && (
            <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
              <p className="pf-sub-on"><Check size={16} /> {kind === "bank" ? t("{n} added.", { n: added }) : kind === "mortgage" ? t("{n} loan parts added.", { n: added }) : t("Payslip figures saved.")}</p>
              <div style={{ display: "flex", gap: 10 }}>
                {kind === "bank" && <button className="pf-chip" onClick={() => { setStep("pick"); setResult(null); }}>{t("Read more")}</button>}
                <button className="pf-button" onClick={() => setOpen(false)}>{t("Done")}</button>
              </div>
            </div>
          )}

          {error && <p style={{ color: "var(--pf-red)", fontSize: "0.85rem" }}>{error}</p>}
        </div>
      </Sheet>
    </>
  );
}

/** `booked`: the booking this row already is, as "note · day" (null = new). */
type Draft = ReadRow & { on: boolean; categoryId: string | null; from: "history" | "ai" | null; booked: string | null; own: boolean };

/** A bar that fills with the work. */
function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="pf-ai-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <span className="pf-ai-progress-track"><i style={{ width: `${Math.max(3, value * 100)}%` }} /></span>
      <span className="pf-ai-progress-label">{label}</span>
    </div>
  );
}

/** Reading has no real progress to report, so the bar follows the expected
 *  time: quick at first, slowing towards 95%, full when the answer lands. */
export function ReadingProgress({ expect, landed }: { expect: number; landed: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 200);
    return () => clearInterval(id);
  }, []);
  const value = landed ? 1 : 0.95 * (1 - Math.exp((-2.2 * elapsed) / expect));
  const label = landed ? t("Done") : elapsed < 2 ? t("Sending…") : value < 0.85 ? t("Reading the figures…") : t("Almost done…");
  return <Progress value={value} label={label} />;
}

/** A small icon saying why a row is (un)ticked or where its category came
 *  from; the full sentence on hover. Orange when ticked against the advice. */
function RowStatus({ d }: { d: Draft }) {
  const [Icon, text, warn] = d.booked
    ? [CopyCheck, d.on ? t("Will be added a second time") : t("Already in your expenses: {what}", { what: d.booked }), d.on]
    : d.own
      ? [ArrowLeftRight, d.on ? t("Will count as spending") : t("Transfer to your own account, not spending"), d.on]
      : d.from === "history"
        ? [History, t("As last time"), false]
        : d.from === "ai"
          ? [Sparkles, t("Suggested"), false]
          : [null, "", false];
  return (
    <span className="pf-ai-why" data-warn={warn || undefined} title={text || undefined} aria-label={text || undefined} role={text ? "img" : undefined}>
      {Icon && <Icon size={15} />}
    </span>
  );
}

function BankReview({ rows, onDone }: { rows: ReadRow[]; onDone: (n: number) => void }) {
  const { data, addTransactions } = useFinance();
  const currency = data.profile.currency_code;
  const categories = live(data.categories);
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    const learned = learnCategories(data.transactions);
    return rows.map((r) => {
      const match = bookedAs(r, data.transactions);
      // Already booked: show it with the category it was booked under.
      const s = match?.category_id ? { id: match.category_id, from: "history" as const } : suggestCategory(r, learned, data.categories);
      const own = !match && isTransfer(r);
      const when = match && new Date(match.date);
      const booked = match && when ? `${match.note || categories.find((c) => c.id === match.category_id)?.name || money(r.amount, currency)} · ${when.getDate()} ${shortMonth(when)}` : null;
      return { ...r, on: !r.off && !match && !own && r.amount > 0, categoryId: s.id, from: s.from, booked, own };
    });
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const set = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const chosen = drafts.filter((d) => d.on);
  const today = isoDay(new Date());

  if (!drafts.length) return <p style={{ color: "var(--pf-ink-2)" }}>{t("No transactions found. Try a sharper screenshot of the list.")}</p>;

  async function add() {
    setBusy(true);
    setSaved(0);
    setErr(null);
    try {
      // Let the spinner show before the work starts (it keeps turning while
      // the page recalculates), then add them all in one go.
      await new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 60)));
      await addTransactions(chosen.map((d) => {
        const cat = categories.find((c) => c.id === d.categoryId);
        return {
          amount: d.amount.toFixed(2), type: d.direction === "in" ? "income" : "expense", date: atNoon(d.date ?? today), note: d.description.trim() || null,
          is_auto_income: false, is_fixed_expense: !!cat?.is_fixed_expense, recurrence_id: null, category_id: d.categoryId, account_id: null,
        };
      }));
      setSaved(chosen.length);
      await new Promise((ok) => setTimeout(ok, 450));
      onDone(chosen.length);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("Check the list: untick what you don't want, change a category if needed.")}</p>
      <label className="pf-ai-all">
        <input
          type="checkbox"
          checked={chosen.length === drafts.length}
          ref={(el) => { if (el) el.indeterminate = chosen.length > 0 && chosen.length < drafts.length; }}
          onChange={(e) => setDrafts((list) => list.map((x) => ({ ...x, on: e.target.checked })))}
        />
        <b>{t("Tick all")}</b>
        <span>{t("{n} of {total}", { n: chosen.length, total: drafts.length })}</span>
      </label>
      <ul className="pf-ai-rows">
        {drafts.map((d, i) => (
          <li key={i} data-off={!d.on || undefined}>
            <input type="checkbox" checked={d.on} onChange={(e) => set(i, { on: e.target.checked })} aria-label={t("Add")} />
            <input className="pf-input pf-ai-date" type="date" value={d.date ?? today} max={today} onChange={(e) => set(i, { date: e.target.value })} aria-label={t("Date")} />
            <input className="pf-input pf-ai-desc" value={d.description} onChange={(e) => set(i, { description: e.target.value })} aria-label={t("Description")} />
            <b className="pf-rounded pf-ai-amt" style={{ color: d.direction === "in" ? "var(--pf-green)" : undefined }}>
              {d.direction === "in" ? "+" : "−"}{money(d.amount, currency)}
            </b>
            <RowStatus d={d} />
            <select className="pf-input pf-ai-cat" value={d.categoryId ?? ""} onChange={(e) => set(i, { categoryId: e.target.value || null, from: null })} aria-label={t("Category")}>
              <option value="">{t("No category")}</option>
              {categories.filter((c) => c.is_income_category === (d.direction === "in")).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {busy ? (
        <div className="pf-ai-saving">
          <span className="pf-slip-spin" aria-hidden />
          <Progress value={saved ? 1 : 0.35} label={saved ? t("{n} added.", { n: saved }) : t("Adding {n} transactions…", { n: chosen.length })} />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="pf-button" disabled={!chosen.length} onClick={add}>
            {t("Add {n}", { n: chosen.length })}
          </button>
          <span style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>
            {money(chosen.filter((d) => d.direction === "out").reduce((s, d) => s + d.amount, 0), currency)} {t("out")}
          </span>
        </div>
      )}
      {err && <p style={{ color: "var(--pf-red)", fontSize: "0.85rem" }}>{err}</p>}
    </div>
  );
}

function PayslipReview({ read, onDone }: { read: ReadResult["payslip"]; onDone: () => void }) {
  const { data, addTransaction, updateTransaction } = useFinance();
  const currency = data.profile.currency_code;
  const now = new Date();
  const [month, setMonth] = useState(() => (read.year && read.month ? `${read.year}-${String(read.month).padStart(2, "0")}` : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`));
  const [gross, setGross] = useState(read.gross != null ? String(read.gross) : "");
  const [net, setNet] = useState(read.net != null ? String(read.net) : "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const at = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
  const salary = salaryOf(data.transactions, at);

  async function apply() {
    const n = parseNum(net), g = gross.trim() ? parseNum(gross) : null;
    if (!(n > 0) || (g != null && !(g > 0))) return setErr(t("Check the amounts."));
    setBusy(true);
    setErr(null);
    try {
      if (salary) {
        const { id: _id, updated_at: _u, deleted_at: _d, ...rest } = salary;
        void _id; void _u; void _d;
        await updateTransaction(salary.id, { ...rest, amount: n.toFixed(2), gross_amount: g != null ? g.toFixed(2) : (salary.gross_amount ?? null) });
      } else {
        const day = Math.min(data.profile.payday_day ?? 25, new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate());
        const cat = live(data.categories).find((c) => c.is_income_category && !c.parent_id);
        await addTransaction({
          amount: n.toFixed(2), type: "income", date: new Date(at.getFullYear(), at.getMonth(), day, 12).toISOString(), note: t("Salary"),
          is_auto_income: false, is_fixed_expense: false, recurrence_id: null, category_id: cat?.id ?? null, account_id: null, gross_amount: g != null ? g.toFixed(2) : null,
        });
      }
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {read.employer && <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{read.employer}</p>}
      <label className="pf-field">{t("Month")}<input className="pf-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
      <label className="pf-field">{t("Gross")}<input className="pf-input" inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} /></label>
      <label className="pf-field">{t("Net paid")}<input className="pf-input" inputMode="decimal" value={net} onChange={(e) => setNet(e.target.value)} /></label>
      {read.tax != null && <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{t("Wage tax")}: {money(read.tax, currency)}</p>}
      <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>
        {salary
          ? t("Replaces the salary of {month} ({amount}).", { month: monthYear(at), amount: money(num(salary.amount), currency) })
          : t("Adds a salary for {month}.", { month: monthYear(at) })}
      </p>
      <button className="pf-button" style={{ justifySelf: "start" }} disabled={busy} onClick={apply}>{busy ? t("One moment…") : t("Use these")}</button>
      {err && <p style={{ color: "var(--pf-red)", fontSize: "0.85rem" }}>{err}</p>}
    </div>
  );
}

type PartDraft = ReadResult["mortgage"]["parts"][number] & { on: boolean };
const KIND_LABEL = { annuity: "Annuity", linear: "Linear", interest_only: "Interest-only" } as const;

function MortgageReview({ read, propertyId, onDone }: { read: ReadResult["mortgage"]; propertyId: string; onDone: (n: number) => void }) {
  const { data, saveMortgagePart } = useFinance();
  const currency = data.profile.currency_code;
  const existing = useMemo(() => data.mortgageParts.filter((m) => m.property_id === propertyId && !m.deleted_at).length, [data.mortgageParts, propertyId]);
  const [parts, setParts] = useState<PartDraft[]>(() => read.parts.map((p) => ({ ...p, on: p.principal > 0 })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (i: number, patch: Partial<PartDraft>) => setParts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const chosen = parts.filter((p) => p.on);

  if (!parts.length) return <p style={{ color: "var(--pf-ink-2)" }}>{t("No loan parts found in this document.")}</p>;

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      let order = existing;
      for (const p of chosen) {
        await saveMortgagePart({
          property_id: propertyId, name: p.name, kind: p.kind, principal: p.principal.toFixed(2), rate: p.rate.toFixed(3), fixed_until: p.fixed_until,
          start_date: p.start_date ?? isoDay(new Date()), term_months: p.term_months ?? 360, nhg: p.nhg, extra_monthly: "0", sort_order: order++,
        });
      }
      onDone(chosen.length);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {read.lender && <p style={{ color: "var(--pf-ink-2)", fontSize: "0.85rem" }}>{read.lender}</p>}
      {existing > 0 && <p className="pf-close-note">{t("This home already has {n} loan parts. These are added next to them.", { n: existing })}</p>}
      <ul className="pf-ai-rows pf-ai-parts">
        {parts.map((p, i) => (
          <li key={i} data-off={!p.on || undefined}>
            <input type="checkbox" checked={p.on} onChange={(e) => set(i, { on: e.target.checked })} aria-label={t("Add")} />
            <input className="pf-input pf-ai-desc" value={p.name} onChange={(e) => set(i, { name: e.target.value })} aria-label={t("Name")} />
            <b className="pf-rounded pf-ai-amt">{money(p.principal, currency)}</b>
            <span className="pf-ai-cat">
              <select className="pf-input" value={p.kind} onChange={(e) => set(i, { kind: e.target.value as PartDraft["kind"] })} aria-label={t("Type")}>
                {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => <option key={k} value={k}>{t(KIND_LABEL[k])}</option>)}
              </select>
              <small>
                {p.rate.toLocaleString(undefined, { maximumFractionDigits: 3 })}% · {Math.round((p.term_months ?? 360) / 12)} {t("years")}
                {p.fixed_until ? ` · ${t("fixed until {date}", { date: monthYear(new Date(`${p.fixed_until.slice(0, 10)}T12:00:00`)) })}` : ""}{p.nhg ? " · NHG" : ""}
              </small>
            </span>
          </li>
        ))}
      </ul>
      <button className="pf-button" style={{ justifySelf: "start" }} disabled={busy || !chosen.length} onClick={add}>
        {busy ? t("One moment…") : t("Add {n} loan parts", { n: chosen.length })}
      </button>
      {err && <p style={{ color: "var(--pf-red)", fontSize: "0.85rem" }}>{err}</p>}
    </div>
  );
}

/** On the dashboard after the setup: the bank statement read during it,
 *  ready to check and add (the same list as Expenses › Read with AI). */
export function PendingStatement() {
  const { source } = useFinance();
  const [rows, setRows] = useState<ReadRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [origin, setOrigin] = useState<Element | null>(null);
  useEffect(() => {
    try {
      const saved = readPending();
      // Read in the preview: never into a real account.
      if (saved?.demo && source !== "demo") sessionStorage.removeItem(PENDING_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this tab's storage after mount
      else if (saved) setRows(saved.rows);
    } catch {}
  }, [source]);
  const forget = () => {
    try { sessionStorage.removeItem(PENDING_KEY); } catch {}
  };
  if (!rows || (added === null && !rows.length)) return null;
  if (added !== null && !open) return null;
  return (
    <>
      <section className="pf-card pf-ai-pending">
        <Sparkles size={20} color="#bf5af2" />
        <span style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
          <b>{t("Your bank statement is read")}</b>
          <span style={{ fontSize: "0.82rem", color: "var(--pf-ink-2)" }}>{t("{n} transactions are ready to check. Nothing is added until you say so.", { n: rows.length })}</span>
        </span>
        <button className="pf-button" onClick={(e) => { setOrigin(e.currentTarget); setOpen(true); }}>{t("Check them")}</button>
        <button className="pf-icon-button" aria-label={t("Not now")} title={t("Not now")} onClick={() => { forget(); setRows(null); }}><X size={16} /></button>
      </section>
      <Sheet open={open} onClose={() => setOpen(false)} origin={origin} label={t("Read bank screenshots")} wide={added === null}>
        <div className="pf-ai-body" data-wide={added === null || undefined}>
          <button type="button" className="pf-icon-button pf-ai-close" aria-label={t("Close")} onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 650, display: "flex", alignItems: "center", gap: 8, paddingRight: 36 }}>
            <Sparkles size={18} color="#bf5af2" /> {t("Your bank statement")}
          </h2>
          {added === null ? (
            <BankReview rows={rows} onDone={(n) => { forget(); setAdded(n); }} />
          ) : (
            <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
              <p className="pf-sub-on"><Check size={16} /> {t("{n} added.", { n: added })}</p>
              <button className="pf-button" onClick={() => setOpen(false)}>{t("Done")}</button>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
