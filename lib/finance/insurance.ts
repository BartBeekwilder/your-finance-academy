// Insurance — what your policies cost, what you'd pay yourself, when they
// renew or can be cancelled, and what might be missing for your situation.
// Pure functions only, so iOS and Android can port them 1:1.

export type InsuranceKind = "health" | "home" | "contents" | "liability" | "car" | "travel" | "life" | "disability" | "legal" | "pet" | "other";
export type PremiumPeriod = "month" | "quarter" | "year";

export type PolicyInput = {
  kind: InsuranceKind;
  premium: number;
  period: PremiumPeriod;
  deductible: number;
  /** Date (YYYY-MM-DD) of the next or a past renewal; rolls forward yearly. */
  renewalDate: string | null;
  noticeMonths: number;
};

export const KINDS: InsuranceKind[] = ["health", "liability", "contents", "home", "car", "travel", "life", "disability", "legal", "pet", "other"];

/** Premium per month, whatever the period. */
export function perMonth(premium: number, period: PremiumPeriod) {
  return period === "year" ? premium / 12 : period === "quarter" ? premium / 3 : premium;
}

export function totals(policies: PolicyInput[]) {
  const month = policies.reduce((s, p) => s + perMonth(p.premium, p.period), 0);
  const byKind = new Map<InsuranceKind, number>();
  for (const p of policies) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + perMonth(p.premium, p.period));
  return {
    perMonth: month,
    perYear: month * 12,
    deductibles: policies.reduce((s, p) => s + p.deductible, 0),
    byKind: [...byKind.entries()].sort((a, b) => b[1] - a[1]).map(([kind, monthly]) => ({ kind, monthly, share: month > 0 ? monthly / month : 0 })),
  };
}

const parse = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addMonths = (d: Date, n: number) => {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  r.setDate(Math.min(d.getDate(), new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  return r;
};

/** The next renewal on or after today (the date rolls forward a year at a
 *  time), the last day to cancel (renewal − notice), and days until each. */
export function renewal(p: Pick<PolicyInput, "renewalDate" | "noticeMonths">, now: Date) {
  if (!p.renewalDate) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = parse(p.renewalDate);
  while (next < today) next = addMonths(next, 12);
  const cancelBy = addMonths(next, -p.noticeMonths);
  const days = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86_400_000);
  return { next, cancelBy, daysToRenewal: days(next), daysToCancel: days(cancelBy), canStillCancel: cancelBy >= today };
}

export type Situation = {
  ownsHome: boolean;
  hasMortgage: boolean;
  hasCar: boolean;
  country: "NL" | "INTL";
};

export type CoverageItem = { kind: InsuranceKind; importance: "required" | "recommended" | "optional"; have: boolean; reason: string };

/** What's sensible for your situation, and whether you have it. Reasons are
 *  English text = translation keys. */
export function coverageCheck(policies: PolicyInput[], s: Situation): CoverageItem[] {
  const have = (k: InsuranceKind) => policies.some((p) => p.kind === k);
  const items: Omit<CoverageItem, "have">[] = [
    { kind: "health", importance: s.country === "NL" ? "required" : "recommended", reason: s.country === "NL" ? "Required by law in the Netherlands" : "Medical costs can be very high" },
    { kind: "liability", importance: "recommended", reason: "Covers damage you cause to others — cheap and important" },
    { kind: "contents", importance: "recommended", reason: "Your belongings, in case of fire, theft or water damage" },
  ];
  if (s.ownsHome) items.push({ kind: "home", importance: "recommended", reason: "Your house itself; often required by the mortgage lender" });
  if (s.hasCar) items.push({ kind: "car", importance: "required", reason: "Third-party car insurance is required by law" });
  if (s.hasMortgage) items.push({ kind: "life", importance: "recommended", reason: "Term life cover so the mortgage can be paid if you die" });
  items.push({ kind: "disability", importance: "optional", reason: "Income if you can't work — especially if self-employed" });
  items.push({ kind: "travel", importance: "optional", reason: "Medical costs, cancellations and luggage while travelling" });
  items.push({ kind: "legal", importance: "optional", reason: "Legal help in disputes with employers, sellers or neighbours" });
  return items.map((i) => ({ ...i, have: have(i.kind) }));
}
