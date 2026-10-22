"use client";

import { useSyncExternalStore, type KeyboardEvent, type MouseEvent } from "react";
import type { Transaction } from "./types";

// Any transaction row in the app opens the same editor (the Quick Add sheet
// in edit mode, mounted once in the app layout). Rows call `editProps(t)`;
// the sheet listens with `useTransactionEditor()`.

// Kept after closing (open: false), so the sheet can animate out with its content.
type Target = { transaction: Transaction; origin: Element | null; n: number; open: boolean } | null;
let target: Target = null;
let n = 0;
const listeners = new Set<() => void>();

export function openTransactionEditor(transaction: Transaction, origin: Element | null) {
  target = { transaction, origin, n: ++n, open: true };
  listeners.forEach((l) => l());
}

export function closeTransactionEditor() {
  if (!target?.open) return;
  target = { ...target, open: false };
  listeners.forEach((l) => l());
}

export function useTransactionEditor() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => target,
    () => null,
  );
}

/** Props that make a row open the editor: click, or Enter / Space when focused. */
export function editProps(t: Transaction) {
  return {
    role: "button",
    tabIndex: 0,
    "data-tap": true,
    "aria-label": `Edit ${t.note || "transaction"}`,
    onClick: (e: MouseEvent<HTMLElement>) => openTransactionEditor(t, e.currentTarget),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openTransactionEditor(t, e.currentTarget);
      }
    },
  };
}
