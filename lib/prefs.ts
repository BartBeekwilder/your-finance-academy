"use client";

import { useSyncExternalStore } from "react";

// Display preferences kept per browser (localStorage) — small switches that
// don't need to follow the account. Each pref has a default and a hook;
// changing one re-renders every component that reads it.

const listeners = new Set<() => void>();

function read(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function write(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}

function usePref(key: string, fallback: boolean) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(key, fallback),
    () => fallback,
  );
}

const AXES = "pf-show-axes";
/** Value labels along the left of every chart (Settings › Charts). On by default. */
export const useShowAxes = () => usePref(AXES, true);
export const setShowAxes = (on: boolean) => write(AXES, on);

const BUDGET_COMPARE = "pf-budget-compare";
/** Monthly limits sized against each other (true, the default) or each
 *  against its own budget. */
export const useBudgetCompare = () => usePref(BUDGET_COMPARE, true);
export const setBudgetCompare = (on: boolean) => write(BUDGET_COMPARE, on);

const BUDGET_SORT = "pf-budget-largest";
/** Budget lists sorted largest budget first (true) or in the user's order. */
export const useBudgetLargestFirst = () => usePref(BUDGET_SORT, false);
export const setBudgetLargestFirst = (on: boolean) => write(BUDGET_SORT, on);
