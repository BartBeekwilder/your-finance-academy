"use client";

import { t } from "@/lib/i18n";
import { setBudgetCompare, setBudgetLargestFirst, useBudgetCompare, useBudgetLargestFirst } from "@/lib/prefs";
import Segmented from "./Segmented";

/** The budget lists' toolbar. Order: the user's own (as on Categories) or
 *  largest budget first. Monthly limits: "Compare" sizes every bar against the largest budget so
 *  the amounts read against each other (the default); "Own budget" sizes
 *  each bar against its own. Remembered per browser. */
export default function BudgetScaleSwitch() {
  const compare = useBudgetCompare();
  const largest = useBudgetLargestFirst();
  // A slim toolbar at the top of the budgets card: what the lengths mean,
  // and the switch.
  return (
    <div className="pf-card-toolbar">
      <span key={String(compare)} className="pf-readout">
        {compare ? t("Bar lengths compare the budgets with each other") : t("Each bar is measured against its own budget")}
      </span>
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
    <Segmented
      size="sm"
      label={t("Budget order")}
      value={largest ? "largest" : "yours"}
      onChange={(v) => setBudgetLargestFirst(v === "largest")}
      options={[{ value: "yours", label: t("Your order") }, { value: "largest", label: t("Largest first") }]}
    />
    <Segmented
      size="sm"
      label={t("Budget bars")}
      value={compare ? "compare" : "own"}
      onChange={(v) => setBudgetCompare(v === "compare")}
      options={[{ value: "compare", label: t("Compare") }, { value: "own", label: t("Own budget") }]}
    />
    </span>
    </div>
  );
}
