"use client";

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
        {compare ? "Bar lengths compare the budgets with each other" : "Each bar is measured against its own budget"}
      </span>
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
    <Segmented
      size="sm"
      label="Budget order"
      value={largest ? "largest" : "yours"}
      onChange={(v) => setBudgetLargestFirst(v === "largest")}
      options={[{ value: "yours", label: "Your order" }, { value: "largest", label: "Largest first" }]}
    />
    <Segmented
      size="sm"
      label="Budget bars"
      value={compare ? "compare" : "own"}
      onChange={(v) => setBudgetCompare(v === "compare")}
      options={[{ value: "compare", label: "Compare" }, { value: "own", label: "Own budget" }]}
    />
    </span>
    </div>
  );
}
