"use client";

import { LOCK_STORAGE_KEY } from "@/lib/lock";

export default function LockButton() {
  function lock() {
    sessionStorage.removeItem(LOCK_STORAGE_KEY);
    window.location.reload();
  }

  return (
    <button
      onClick={lock}
      className="eyebrow hidden sm:inline"
      style={{ color: "var(--ink-soft)" }}
    >
      Lock
    </button>
  );
}
