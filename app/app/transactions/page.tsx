"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import CategoryIcon from "@/components/finance/CategoryIcon";
import { useFinance } from "@/components/finance/FinanceProvider";
import { live, num } from "@/lib/finance/calc";
import { dayLabel, money } from "@/lib/finance/format";

export default function TransactionsPage() {
  const { data, deleteTransaction } = useFinance();
  const currency = data.profile.currency_code;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "expense" | "income">("all");

  const categories = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = live(data.transactions)
      .filter((t) => filter === "all" || t.type === filter)
      .filter((t) => {
        if (!q) return true;
        const c = t.category_id ? categories.get(t.category_id) : undefined;
        return (t.note ?? "").toLowerCase().includes(q) || (c?.name ?? "").toLowerCase().includes(q);
      });
    const map = new Map<string, typeof rows>();
    for (const t of rows) {
      const key = new Date(t.date).toDateString();
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return [...map.entries()];
  }, [data.transactions, categories, query, filter]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Transactions</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pf-card"
          style={{ flex: "1 1 240px", padding: "9px 14px", color: "inherit", font: "inherit", outline: "none" }}
        />
        <div className="pf-card" role="tablist" style={{ display: "flex", padding: 2, borderRadius: 9 }}>
          {(["all", "expense", "income"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              style={{
                border: 0, borderRadius: 7, padding: "6px 14px", font: "inherit", fontSize: "0.85rem", cursor: "pointer",
                color: "inherit", background: filter === f ? "var(--pf-card-2)" : "transparent",
              }}
            >
              {f === "all" ? "All" : f === "expense" ? "Expenses" : "Income"}
            </button>
          ))}
        </div>
      </div>

      {groups.map(([day, rows]) => (
        <section key={day}>
          <h2 className="pf-section-title">{dayLabel(rows[0].date)}</h2>
          <div className="pf-card">
            {rows.map((t) => {
              const c = t.category_id ? categories.get(t.category_id) : undefined;
              return (
                <div key={t.id} className="pf-row">
                  <CategoryIcon icon={c?.icon ?? "questionmark.circle.fill"} colorHex={c?.color_hex ?? "808080"} size={32} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.95rem" }}>{t.note || c?.name || "Transaction"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
                      {c?.name ?? "Uncategorized"}
                      {t.is_fixed_expense && " · Fixed"}
                    </div>
                  </div>
                  <span className="pf-rounded" style={{ fontWeight: 600, color: t.type === "income" ? "var(--pf-green)" : "var(--pf-ink)" }}>
                    {money(t.type === "income" ? num(t.amount) : -num(t.amount), currency, { signed: t.type === "income" })}
                  </span>
                  <button
                    className="pf-icon-button pf-row-delete"
                    aria-label={`Delete ${t.note || c?.name || "transaction"}`}
                    onClick={() => {
                      if (confirm(`Delete ${t.note || c?.name || "this transaction"}?`)) deleteTransaction(t.id).catch((e) => alert(e.message));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {groups.length === 0 && <p style={{ color: "var(--pf-ink-2)" }}>No transactions match.</p>}
    </div>
  );
}
