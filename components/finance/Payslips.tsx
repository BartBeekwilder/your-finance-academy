"use client";

import { intlLocale, t } from "@/lib/i18n";
import { Check, ExternalLink, FileText, Paperclip, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { live, num } from "@/lib/finance/calc";
import { money, monthName, monthYear } from "@/lib/finance/format";
import type { FinanceDocument, Transaction } from "@/lib/finance/types";
import { useFinance } from "./FinanceProvider";
import Sheet from "./Sheet";

// Payslips on the Income page: a paperclip per month to attach one (PDF or
// image), the figures read from a PDF shown next to what's entered with a
// one-click "Use these", and an archive of every payslip by year. Files stay
// in private storage (local data: .private/docs).

const DOCS = "/api/local-docs";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

/** The month's main income (largest income transaction), the one a payslip
 *  belongs to. */
function salaryOf(transactions: Transaction[], month: Date) {
  return live(transactions)
    .filter((x) => x.type === "income" && !x.spread_of && new Date(x.date).getFullYear() === month.getFullYear() && new Date(x.date).getMonth() === month.getMonth())
    .sort((a, b) => num(b.amount) - num(a.amount))[0];
}

export function usePayslips() {
  const { data } = useFinance();
  return (data.documents ?? []).filter((d) => d.kind === "payslip");
}

/** Upload: stores the file and records it for the month; returns the doc. */
function useUpload() {
  const { addDocument } = useFinance();
  return async (file: File, month: Date): Promise<FinanceDocument> => {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(DOCS, { method: "POST", body: form });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? t("Upload failed"));
    const doc: FinanceDocument = {
      id: j.id,
      kind: "payslip",
      month: iso(month),
      person_id: null,
      name: j.name,
      mime: j.mime,
      size: j.size,
      added_at: new Date().toISOString(),
      extracted: j.extracted ? { gross: j.extracted.gross, net: j.extracted.net, tax: j.extracted.tax } : null,
    };
    await addDocument(doc);
    return doc;
  };
}

/** The paperclip on a month row. */
export function PayslipButton({ month, onOpen }: { month: Date; onOpen: (doc: FinanceDocument, from: Element) => void }) {
  const { source } = useFinance();
  const docs = usePayslips().filter((d) => d.month === iso(month));
  const upload = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (source !== "local") return null;
  if (docs.length)
    return (
      <button type="button" className="pf-slip-btn" data-has="true" title={t("Payslip")} onClick={(e) => onOpen(docs[docs.length - 1], e.currentTarget)}>
        <Paperclip size={14} /> {docs.length > 1 ? docs.length : ""}
      </button>
    );
  return (
    <>
      <button type="button" className="pf-slip-btn" title={t("Add payslip")} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <span className="pf-slip-spin" /> : <Upload size={14} />}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/heic,image/webp"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const doc = await upload(f, month);
            onOpen(doc, input.current!.previousElementSibling ?? input.current!);
          } catch (err) {
            alert((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

/** Sheet for one payslip: the file, what was read, and "Use these". */
export function PayslipSheet({ doc, open, origin, onClose }: { doc: FinanceDocument | null; open: boolean; origin: Element | null; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} origin={origin} label={t("Payslip")}>
      {doc && <PayslipDetail key={doc.id} doc={doc} onClose={onClose} />}
    </Sheet>
  );
}

function PayslipDetail({ doc, onClose }: { doc: FinanceDocument; onClose: () => void }) {
  const { data, updateTransaction, addTransaction, removeDocument } = useFinance();
  const currency = data.profile.currency_code;
  const month = doc.month ? new Date(Number(doc.month.slice(0, 4)), Number(doc.month.slice(5, 7)) - 1, 1) : null;
  const salary = month ? salaryOf(data.transactions, month) : undefined;
  const ex = doc.extracted;
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cur = { net: salary ? num(salary.amount) : null, gross: salary?.gross_amount != null ? num(salary.gross_amount) : null };
  const differs = !!ex && ((ex.net != null && Math.abs((cur.net ?? 0) - ex.net) >= 0.01) || (ex.gross != null && Math.abs((cur.gross ?? 0) - ex.gross) >= 0.01));

  async function apply() {
    if (!ex || !month) return;
    setErr(null);
    try {
      if (salary) {
        const { id: _id, updated_at: _u, deleted_at: _d, ...rest } = salary;
        void _id; void _u; void _d;
        await updateTransaction(salary.id, { ...rest, amount: (ex.net ?? num(salary.amount)).toFixed(2), gross_amount: ex.gross != null ? ex.gross.toFixed(2) : (salary.gross_amount ?? null) });
      } else if (ex.net != null) {
        const day = Math.min(data.profile.payday_day ?? 25, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
        const cat = live(data.categories).find((c) => c.is_income_category && !c.parent_id);
        await addTransaction({
          amount: ex.net.toFixed(2), type: "income", date: new Date(month.getFullYear(), month.getMonth(), day, 12).toISOString(), note: t("Salary"),
          is_auto_income: false, is_fixed_expense: false, recurrence_id: null, category_id: cat?.id ?? null, account_id: null, gross_amount: ex.gross != null ? ex.gross.toFixed(2) : null,
        });
      }
      setDone(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const row = (label: string, read: number | null | undefined, now: number | null) => (
    <div className="pf-slip-row">
      <span>{label}</span>
      <b className="pf-rounded">{read != null ? money(read, currency) : "—"}</b>
      <span className="pf-rounded" data-same={read != null && now != null && Math.abs(read - now) < 0.01}>
        {now != null ? money(now, currency) : "—"}
      </span>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 16, position: "relative" }}>
      <button type="button" className="pf-icon-button" aria-label={t("Close")} onClick={onClose} style={{ position: "absolute", top: -4, right: -4 }}>
        <X size={16} />
      </button>
      <div style={{ display: "flex", gap: 12, alignItems: "center", paddingRight: 36 }}>
        <span className="pf-slip-icon"><FileText size={20} /></span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 650 }}>{t("Payslip")} {month ? monthYear(month) : ""}</h2>
          <div style={{ fontSize: "0.78rem", color: "var(--pf-ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {doc.name} · {Math.max(1, Math.round(doc.size / 1024))} kB
          </div>
        </div>
      </div>
      <a className="pf-chip pf-slip-open" href={`${DOCS}?id=${doc.id}`} target="_blank" rel="noreferrer">
        <ExternalLink size={14} /> {t("Open payslip")}
      </a>

      {ex ? (
        <div className="pf-slip-table">
          <div className="pf-slip-row pf-slip-head">
            <span />
            <span>{t("On the payslip")}</span>
            <span>{t("Entered")}</span>
          </div>
          {row(t("Gross"), ex.gross, cur.gross)}
          {row(t("Net"), ex.net, cur.net)}
          {row(t("Wage tax"), ex.tax, null)}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--pf-ink-2)" }}>
          {doc.mime === "application/pdf" ? t("No figures could be read from this PDF (a scan?). It's kept for reference.") : t("Kept for reference. Figures are read from PDF payslips.")}
        </p>
      )}

      {ex && (ex.net != null || ex.gross != null) && (
        done ? (
          <p className="pf-slip-done"><Check size={15} /> {t("Taken over for {month}", { month: month ? monthName(month) : "" })}</p>
        ) : differs || !salary ? (
          <button type="button" className="pf-button" onClick={apply}>
            {salary ? t("Use these figures") : t("Add as this month's salary")}
          </button>
        ) : (
          <p className="pf-slip-done"><Check size={15} /> {t("Matches what's entered")}</p>
        )
      )}
      {err && <p style={{ margin: 0, color: "var(--pf-red)", fontSize: "0.82rem" }}>{err}</p>}

      <button
        type="button"
        className="pf-link"
        style={{ justifySelf: "start", display: "inline-flex", gap: 6, alignItems: "center", color: "var(--pf-ink-3)" }}
        onClick={async () => {
          if (!confirm(t("Remove this payslip?"))) return;
          await removeDocument(doc.id);
          onClose();
        }}
      >
        <Trash2 size={14} /> {t("Remove payslip")}
      </button>
    </div>
  );
}

/** Every payslip, by year — to find one back later. */
export function PayslipArchive({ onOpen }: { onOpen: (doc: FinanceDocument, from: Element) => void }) {
  const { data, source } = useFinance();
  const currency = data.profile.currency_code;
  const docs = usePayslips().sort((a, b) => (b.month ?? "").localeCompare(a.month ?? ""));
  const byYear = new Map<string, FinanceDocument[]>();
  for (const d of docs) {
    const y = d.month?.slice(0, 4) ?? "—";
    byYear.set(y, [...(byYear.get(y) ?? []), d]);
  }
  return (
    <section>
      <h2 className="pf-section-title">{t("Payslips")}</h2>
      <div className="pf-card" style={{ padding: docs.length ? 0 : 16 }}>
        {!docs.length && (
          <span style={{ fontSize: "0.85rem", color: "var(--pf-ink-2)" }}>
            {source === "local"
              ? t("No payslips yet. Use the upload button next to a month (Year view) to add one; its figures are read and kept here by year.")
              : t("Payslips can be kept with local data for now; an encrypted place in your account comes next.")}
          </span>
        )}
        {[...byYear].map(([year, list]) => (
          <div key={year}>
            <div className="pf-day-head"><span>{year}</span><span>{list.length === 1 ? t("1 payslip") : t("{n} payslips", { n: list.length })}</span></div>
            {list.map((d) => (
              <button key={d.id} type="button" className="pf-row pf-slip-arch" onClick={(e) => onOpen(d, e.currentTarget)}>
                <span className="pf-slip-icon pf-slip-icon-sm"><FileText size={15} /></span>
                <span style={{ flex: 1, minWidth: 0, display: "grid" }}>
                  <span>{d.month ? monthName(new Date(Number(d.month.slice(0, 4)), Number(d.month.slice(5, 7)) - 1, 1)) : d.name}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--pf-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.name} · {new Date(d.added_at).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
                {d.extracted?.net != null && <span className="pf-rounded" style={{ color: "var(--pf-green)", fontWeight: 600 }}>{money(d.extracted.net, currency)}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
