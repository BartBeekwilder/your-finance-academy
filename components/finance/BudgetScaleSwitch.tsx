"use client";

import { setBudgetCompare, useBudgetCompare } from "@/lib/prefs";
import Segmented from "./Segmented";

/** Monthly limits: "Compare" sizes every bar against the largest budget so
 *  the amounts read against each other (the default); "Own budget" sizes
 *  each bar against its own. Remembered per browser. */
export default function BudgetScaleSwitch() {
  const compare = useBudgetCompare();
  // A slim toolbar at the top of the budgets card: what the lengths mean,
  // and the switch.
  return (
    <div className="pf-card-toolbar">
      <span key={String(compare)} className="pf-readout">
        {compare ? "Bar lengths compare the budgets with each other" : "Each bar is measured against its own budget"}
      </span>
    <Segmented
      size="sm"
      label="Budget bars"
      value={compare ? "compare" : "own"}
      onChange={(v) => setBudgetCompare(v === "compare")}
      options={[{ value: "compare", label: "Compare" }, { value: "own", label: "Own budget" }]}
    />
    </div>
  );
}
