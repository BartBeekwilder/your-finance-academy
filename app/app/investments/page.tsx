"use client";

import { t } from "@/lib/i18n";
import { Bitcoin, ChartLine, Gem } from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import { investedIn, live, num } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import type { AssetType } from "@/lib/finance/types";

// Same asset types and colors as iOS AssetType. Live prices come later via a
// server route (the iOS InvestmentPriceService sources), so for now each
// holding shows quantity and cost basis.
const TYPE: Record<AssetType, { label: string; Icon: typeof ChartLine; color: string }> = {
  crypto: { label: "Crypto", Icon: Bitcoin, color: "#F7931A" },
  stock: { label: "Stock", Icon: ChartLine, color: "#0A84FF" },
  metal: { label: "Metal", Icon: Gem, color: "#D4AF37" },
};

export default function InvestmentsPage() {
  const { data } = useFinance();
  const currency = data.profile.currency_code;
  const holdings = live(data.holdings);
  const invested = investedIn(holdings, currency);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Investments")}</h1>

      <div className="pf-card" style={{ padding: 16 }}>
        <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>{t("Total invested")}</div>
        <div className="pf-rounded" style={{ fontSize: "1.8rem", fontWeight: 700 }}>{money(invested.total, currency)}</div>
        <div style={{ fontSize: "0.7rem", color: "var(--pf-ink-3)" }}>
          {invested.skipped > 0 && `Excludes ${invested.skipped} holding${invested.skipped > 1 ? "s" : ""} in another currency · `}
          {t("Live market prices arrive with account sync")}
        </div>
      </div>

      <section>
        <h2 className="pf-section-title">{t("Holdings")}</h2>
        <div className="pf-card">
          {holdings.map((h) => {
            const t = TYPE[h.asset_type];
            return (
              <div key={h.id} className="pf-row">
                <span className="pf-badge" style={{ width: 32, height: 32, borderRadius: 9, background: t.color }}>
                  <t.Icon size={18} color="white" strokeWidth={2.2} />
                </span>
                <div style={{ flex: 1 }}>
                  <div>{h.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--pf-ink-2)" }}>
                    {Number(h.quantity).toLocaleString("nl-NL", { maximumFractionDigits: 8 })} {h.symbol} · {t.label}
                  </div>
                </div>
                {h.cost_basis && (
                  <span className="pf-rounded" style={{ fontWeight: 600 }}>
                    {money(num(h.cost_basis), h.cost_basis_currency ?? currency)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
