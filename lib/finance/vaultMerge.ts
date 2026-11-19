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

// Ids are UUIDs, and a UUID's letters don't matter: the web writes them in
// lower case, the iPhone/iPad app (Swift's uuidString) in upper case. Read as
// different strings, one row synced through the app came back as a second
// row (18 Nov: every row doubled after a sync on the iPad). So every id, and
// every reference to one, is read in lower case, and rows that turn out to be
// the same are folded into one: the newest wins, with any field only the
// other one has kept.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const low = (v: unknown) => (typeof v === "string" && UUID.test(v) && v !== v.toLowerCase() ? v.toLowerCase() : v);
const isRef = (k: string) => k === "id" || k.endsWith("_id");

function foldRows(rows: Row[]): { rows: Row[]; changed: boolean; live: Map<string, Set<string>> } {
  let changed = false;
  const byId = new Map<string, Row>();
  // Per id (lower case): how it was written by the live rows that have it.
  const live = new Map<string, Set<string>>();
  for (const r0 of rows) if (!r0.deleted_at) {
    const k = String(low(r0.id));
    live.set(k, (live.get(k) ?? new Set()).add(r0.id));
  }
  for (const r0 of rows) {
    let r = r0;
    for (const k of Object.keys(r0)) {
      if (!isRef(k)) continue;
      const v = low(r0[k]);
      if (v !== r0[k]) {
        if (r === r0) r = { ...r0 };
        r[k] = v;
        changed = true;
      }
    }
    const other = byId.get(r.id);
    if (!other) {
      byId.set(r.id, r);
      continue;
    }
    changed = true;
    const [older, newer] = time(r.updated_at) >= time(other.updated_at) ? [other, r] : [r, other];
    const both: Row = { ...older };
    for (const [k, v] of Object.entries(newer)) if (v !== undefined) both[k] = v;
    // One of the two marked deleted while the other is alive: that mark came
    // from the case mix-up (the app saw its own row as gone), so it's alive.
    if (!older.deleted_at || !newer.deleted_at) both.deleted_at = null;
    byId.set(r.id, both);
  }
  return { rows: [...byId.values()], changed, live };
}

/** Every id (and reference) in lower case, and rows that are the same row folded into one. */
export function foldIds<T extends Doc>(d: T): { doc: T; changed: boolean } {
  let changed = false;
  const out: Doc = { ...d };
  const live = new Map<string, Map<string, Set<string>>>();
  for (const c of collections(d)) {
    const f = foldRows(d[c] as Row[]);
    out[c] = f.rows;
    live.set(c, f.live);
    changed ||= f.changed;
  }
  if (d.deletions?.length) {
    const seen = new Map<string, Deletion>();
    for (const x of d.deletions) {
      const id = low(x.id) as string;
      // A deletion of a row that's still alive here, written in another case:
      // the app took its own row (in upper case) for a missing one. Not a deletion.
      const alive = live.get(x.collection)?.get(id);
      if (alive && [...alive].some((a) => a !== x.id)) {
        changed = true;
        continue;
      }
      if (id !== x.id) changed = true;
      const key = `${x.collection}/${id}`;
      const prev = seen.get(key);
      if (prev) changed = true;
      if (!prev || time(x.deleted_at) > time(prev.deleted_at)) seen.set(key, { ...x, id });
    }
    out.deletions = [...seen.values()];
  }
  // The household's people (profile.household[].id) are referred to by person_id.
  const hh = (d.profile as { household?: unknown } | undefined)?.household;
  if (Array.isArray(hh)) {
    const fixed = hh.map((m) => (m && typeof m === "object" && low((m as Row).id) !== (m as Row).id ? { ...(m as Row), id: low((m as Row).id) } : m));
    if (fixed.some((m, i) => m !== hh[i])) {
      changed = true;
      out.profile = { ...(d.profile as object), household: fixed };
    }
  }
  return { doc: out as T, changed };
}

/** Merges two copies of the data; [local] wins ties. Deleted rows stay in, marked with deleted_at. */
export function mergeData<T extends Doc>(local0: T, remote0: Doc): T {
  const local = foldIds(local0).doc, remote = foldIds(remote0).doc;
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

const live = (d: Doc) => collections(d).reduce((n, c) => n + (d[c] as Row[]).filter((r) => !r.deleted_at).length, 0);

/** Whether a merge wipes a large share of one side's live rows: real
 *  deleting goes a row at a time. 19 Nov 2026: a browser tab still holding
 *  the 18 Nov wipe's deletion marks merged them into the restored copy. */
export function wipes(before: Doc, after: Doc): boolean {
  const had = live(before), has = live(after);
  return had - has >= 20 && had - has >= had * 0.25;
}

/** mergeData, unless that wipes either side: then nothing is deleted — every
 *  live row of both sides stays (newest wins per id), and deletion marks that
 *  would remove one of them are dropped. At worst a deleted row comes back. */
export function safeMerge<T extends Doc>(local0: T, remote0: Doc): { data: T; guarded: boolean } {
  // Ids folded first (foldIds): the same row in another case is one row, not a wipe plus a new row.
  const local = foldIds(local0).doc, remote = foldIds(remote0).doc;
  const merged = liveOnly(mergeData(local, remote));
  if (!wipes(liveOnly(local), merged) && !wipes(liveOnly(remote), merged)) return { data: merged, guarded: false };
  const keep = (d: Doc): Doc => ({ ...liveOnly(d), deletions: [] });
  const union = mergeData(keep(local), keep(remote));
  const alive = new Set(collections(union).flatMap((c) => (union[c] as Row[]).map((r) => `${c}/${r.id}`)));
  const deletions = [...(local.deletions ?? []), ...(remote.deletions ?? [])].filter((x) => !alive.has(`${x.collection}/${x.id}`));
  const seen = new Set<string>();
  union.deletions = deletions.filter((x) => !seen.has(`${x.collection}/${x.id}`) && seen.add(`${x.collection}/${x.id}`));
  return { data: union as T, guarded: true };
}

/** Without the deleted rows (what the web keeps in memory), ids folded (foldIds). */
export function liveOnly<T extends Doc>(d0: T): T {
  const d = foldIds(d0).doc;
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
