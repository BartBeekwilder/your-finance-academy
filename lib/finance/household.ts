// The household: two or more people keeping these books together. Incomes
// belong to someone; expenses are paid by someone or shared. Pure (types
// only), so it's tested with plain node and ported to the apps.

import type { HouseholdMember, Profile, Transaction } from "./types";

export const PERSON_COLORS = ["#30d158", "#0a84ff", "#ff9f0a", "#bf5af2"];
/** Key for "shared / not set" in splits. */
export const SHARED = "shared";

/** The members when the books are kept together (2+), else []. */
export const householdOf = (profile: Pick<Profile, "household">): HouseholdMember[] =>
  (profile.household ?? []).length >= 2 ? profile.household! : [];

/** Per month (Jan = 0) of `year`, the amount per person (and SHARED) for one
 *  kind of transaction. A person_id that's no longer in the household counts
 *  as shared. */
export function splitByPerson(transactions: Transaction[], type: Transaction["type"], year: number, members: HouseholdMember[]) {
  const ids = new Set(members.map((m) => m.id));
  const out = new Map<string, number[]>([[SHARED, new Array(12).fill(0)], ...members.map((m) => [m.id, new Array(12).fill(0)] as [string, number[]])]);
  for (const t of transactions) {
    if (t.deleted_at || t.type !== type) continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== year) continue;
    const key = t.person_id && ids.has(t.person_id) ? t.person_id : SHARED;
    out.get(key)![d.getMonth()] += Number(t.amount) || 0;
  }
  return out;
}

/** A new two-person household: "me" and a partner. */
export function newHousehold(me: string, partner: string, id: () => string): HouseholdMember[] {
  return [
    { id: id(), name: me, color: PERSON_COLORS[0] },
    { id: id(), name: partner, color: PERSON_COLORS[1] },
  ];
}
