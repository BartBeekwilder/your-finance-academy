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

const BALANCE_FULL = "pf-balance-full";
/** Dashboard balance sheet: the full two-column table (true) or the
 *  compact bars (false). */
export const useBalanceFull = () => usePref(BALANCE_FULL, false);
export const setBalanceFull = (on: boolean) => write(BALANCE_FULL, on);

// ---- Orders (a list of ids, saved as JSON) --------------------------------
// Cached per key so the snapshot is stable between renders.
const orderCache = new Map<string, { raw: string | null; ids: string[] }>();

function readOrder(key: string, fallback: string[]) {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {}
  const hit = orderCache.get(key);
  if (hit && hit.raw === raw) return hit.ids;
  let saved: string[] = [];
  try {
    saved = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {}
  // Known ids in the saved order, then any new ones in their default place.
  const ids = [...saved.filter((id) => fallback.includes(id)), ...fallback.filter((id) => !saved.includes(id))];
  orderCache.set(key, { raw, ids });
  return ids;
}

/** A per-browser order of tiles: `fallback` is the default (and the set of ids). */
export function useOrder(key: string, fallback: string[]) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => readOrder(key, fallback),
    () => fallback,
  );
}
export function setOrder(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {}
  listeners.forEach((l) => l());
}

const CATEGORY_AREAS = "pf-category-areas";
/** Spending/income per day or month by category as stacked areas (true)
 *  or stacked bars (false, the default). Settings › Charts. */
export const useCategoryAreas = () => usePref(CATEGORY_AREAS, false);
export const setCategoryAreas = (on: boolean) => write(CATEGORY_AREAS, on);
