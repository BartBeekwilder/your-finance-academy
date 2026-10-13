"use client";

import CategoryIcon from "@/components/finance/CategoryIcon";
import { useFinance } from "@/components/finance/FinanceProvider";
import { live } from "@/lib/finance/calc";

export default function CategoriesPage() {
  const { data } = useFinance();
  const all = live(data.categories).sort((a, b) => a.sort_order - b.sort_order);
  const top = all.filter((c) => c.parent_id === null);

  const groups = [
    { title: "Expenses", rows: top.filter((c) => !c.is_income_category) },
    { title: "Income", rows: top.filter((c) => c.is_income_category) },
  ];

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Categories</h1>
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="pf-section-title">{g.title}</h2>
          <div className="pf-card">
            {g.rows.map((c) => (
              <div key={c.id}>
                <div className="pf-row">
                  <CategoryIcon icon={c.icon} colorHex={c.color_hex} size={32} />
                  <span style={{ flex: 1 }}>{c.name}</span>
                  {!c.is_income_category && (
                    <span style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{c.is_fixed_expense ? "Fixed" : "Variable"}</span>
                  )}
                </div>
                {all
                  .filter((s) => s.parent_id === c.id)
                  .map((s) => (
                    <div key={s.id} className="pf-row" style={{ paddingLeft: 60 }}>
                      <CategoryIcon icon={s.icon} colorHex={s.color_hex} size={24} />
                      <span style={{ flex: 1, fontSize: "0.9rem" }}>{s.name}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
