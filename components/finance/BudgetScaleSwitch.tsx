"use client";

import { setBudgetCompare, useBudgetCompare } from "@/lib/prefs";
import Segmented from "./Segmented";

/** Monthly limits: "Compare" sizes every bar against the largest budget so
 *  the amounts read against each other (the default); "Own budget" sizes
 *  each bar against its own. Remembered per browser. */
export default function BudgetScaleSwitch() {
  const compare = useBudgetCompare();
  return (
    <Segmented
      size="sm"
      label="Budget bars"
      value={compare ? "compare" : "own"}
      onChange={(v) => setBudgetCompare(v === "compare")}
      options={[{ value: "compare", label: "Compare" }, { value: "own", label: "Own budget" }]}
    />
  );
}
