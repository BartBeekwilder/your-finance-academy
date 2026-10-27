// Syncing the encrypted vault between devices (web, iPhone/Mac, Android):
// every device keeps the same FinanceData, the vault holds one encrypted
// copy, and before uploading a device merges its data with what's there —
// so nothing one device changed is lost by another's upload. The same rule
// on every platform (ported 1:1 to Kotlin and Swift):
//
//   rows      every array of objects with an id is a collection; per id the
//             row with the newest updated_at wins (no updated_at = oldest);
//   deletions a device that removes a row records {collection, id,
//             deleted_at}; a row with deleted_at set counts the same. A row
//             stays deleted unless it was changed after the deletion;
//   profile   the newest profile.updated_at wins;
//   the rest  (other keys) from the local side, else the remote one.
//
// The web keeps only live rows in memory, so after merging it drops the
// deleted ones (liveOnly) but keeps the deletions list for the next merge.

import type { FinanceData } from "./types";

export type Deletion = { collection: string; id: string; deleted_at: string };
type Row = { id: string; updated_at?: string | null; deleted_at?: string | null; [k: string]: unknown };
type Doc = Record<string, unknown> & { profile?: Record<string, unknown>; deletions?: Deletion[] };

const time = (s: unknown) => (typeof s === "string" ? Date.parse(s) || 0 : 0);
const isCollection = (v: unknown): v is Row[] => Array.isArray(v) && v.every((x) => x && typeof x === "object" && typeof (x as Row).id === "string");

/** Collections in a document (arrays of rows with ids), except the deletions list. */
export function collections(d: Doc): string[] {
  return Object.keys(d).filter((k) => k !== "deletions" && isCollection(d[k]));
}

/** Merges two copies of the data; [local] wins ties. Deleted rows stay in, marked with deleted_at. */
export function mergeData<T extends Doc>(local: T, remote: Doc): T {
  const dels = new Map<string, string>();
  const del = (collection: string, id: string, at: string | null | undefined) => {
    if (!at) return;
    const key = `${collection}/${id}`;
    if (time(at) > time(dels.get(key))) dels.set(key, at);
  };
  for (const d of [local, remote]) {
    for (const x of d.deletions ?? []) del(x.collection, x.id, x.deleted_at);
    for (const c of collections(d)) for (const r of d[c] as Row[]) del(c, r.id, r.deleted_at);
  }
  const out: Doc = { ...remote, ...local };
  for (const c of new Set([...collections(local), ...collections(remote)])) {
    const byId = new Map<string, Row>();
    for (const r of (remote[c] as Row[] | undefined) ?? []) byId.set(r.id, r);
    for (const r of (local[c] as Row[] | undefined) ?? []) {
      const other = byId.get(r.id);
      if (!other || time(r.updated_at) >= time(other.updated_at)) byId.set(r.id, r);
    }
    out[c] = [...byId.values()].map((r) => {
      const at = dels.get(`${c}/${r.id}`);
      return at && time(at) >= time(r.updated_at) ? { ...r, deleted_at: at } : r;
    });
  }
  const lp = local.profile, rp = remote.profile;
  if (lp || rp) out.profile = !rp ? lp : !lp ? rp : time(rp.updated_at) > time(lp.updated_at) ? rp : lp;
  out.deletions = [...dels].map(([k, at]) => ({ collection: k.slice(0, k.indexOf("/")), id: k.slice(k.indexOf("/") + 1), deleted_at: at }));
  return out as T;
}

/** Without the deleted rows (what the web keeps in memory). */
export function liveOnly<T extends Doc>(d: T): T {
  const out: Doc = { ...d };
  for (const c of collections(d)) out[c] = (d[c] as Row[]).filter((r) => !r.deleted_at);
  return out as T;
}

/** After a change on this device: rows that disappeared become deletions,
 *  and a changed profile is stamped — so the next merge knows. */
export function trackChanges(before: FinanceData, after: FinanceData, now: Date = new Date()): FinanceData {
  const b = before as unknown as Doc, a = after as unknown as Doc;
  const at = now.toISOString();
  const deletions: Deletion[] = [...((a.deletions as Deletion[] | undefined) ?? (b.deletions as Deletion[] | undefined) ?? [])];
  for (const c of collections(b)) {
    const kept = new Set(((a[c] as Row[] | undefined) ?? []).map((r) => r.id));
    for (const r of b[c] as Row[]) if (!kept.has(r.id)) deletions.push({ collection: c, id: r.id, deleted_at: at });
  }
  const strip = (p: unknown) => JSON.stringify({ ...(p as object), updated_at: undefined });
  const profile = a.profile && strip(a.profile) !== strip(b.profile) ? { ...a.profile, updated_at: at } : a.profile;
  return { ...after, profile, deletions } as unknown as FinanceData;
}
