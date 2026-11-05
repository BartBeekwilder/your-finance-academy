// "Remember on this device" for a passphrase-protected copy: the keys the
// passphrase derived are kept in this browser's IndexedDB as non-extractable
// CryptoKeys — the browser can decrypt with them, but no script (ours
// included) can read the key bytes, and the passphrase itself is never kept.
// So a reload, or Safari on an iPad dropping a tab in the background, opens
// the data again without asking. Forgotten on "Lock now", on signing out,
// when the passphrase is taken off, and after 30 days.

import type { KeyEntry } from "./vault";

const DB = "pf-vault";
const STORE = "keys";
const MAX_AGE = 30 * 86_400_000;

type Row = { entries: KeyEntry[]; at: number };

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(d.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    d.close();
  }
}

/** Keeps the keys for this account on this device (from now on 30 days). */
export async function rememberKeys(userId: string, entries: KeyEntry[]): Promise<void> {
  if (!entries.length) return forgetKeys(userId);
  try {
    await run("readwrite", (s) => s.put({ entries, at: Date.now() } satisfies Row, userId));
  } catch {}
}

/** The keys kept for this account, or null (none, expired, or no storage). */
export async function recallKeys(userId: string): Promise<KeyEntry[] | null> {
  try {
    const row = (await run("readonly", (s) => s.get(userId))) as Row | undefined;
    if (!row?.entries?.length) return null;
    if (Date.now() - row.at > MAX_AGE) {
      await forgetKeys(userId);
      return null;
    }
    return row.entries;
  } catch {
    return null;
  }
}

/** Forgets this account's keys on this device (every account's without an id). */
export async function forgetKeys(userId?: string): Promise<void> {
  try {
    await run("readwrite", (s) => (userId ? s.delete(userId) : s.clear()));
  } catch {}
}
