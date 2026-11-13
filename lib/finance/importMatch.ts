// Rows read from a bank screenshot, matched against the books: which
// category each one most likely belongs to, and which are already booked.
// Pure (no imports), so it's tested with plain node and ported to the apps.
//
// Categories come from your own history first: the shop you booked as
// Groceries last time is Groceries again. Only for a shop the books have
// never seen does the AI's guess count, and only when it names a category
// that exists.

export type ReadRow = {
  date: string | null; // YYYY-MM-DD
  description: string;
  amount: number; // positive
  direction: "out" | "in";
  category: string | null; // the AI's guess: one of the category names it was given
  /** Money moved between the person's own accounts (savings, paying off the
   *  credit card): not spending, so not ticked by default. */
  transfer?: boolean;
};

type Tx = { amount: string | number; type: string; date: string; note: string | null; category_id: string | null; deleted_at?: string | null; is_fixed_expense?: boolean; recurrence_id?: string | null };
type Cat = { id: string; name: string; is_income_category: boolean; deleted_at?: string | null };

// Words banks put around the shop's name that say nothing about it.
const NOISE = new Set([
  "betaalautomaat", "betaling", "bea", "gea", "pas", "ideal", "sepa", "incasso", "overboeking", "machtiging", "apple", "pay", "google",
  "nr", "transactie", "paypal", "ccv", "sumup", "zettle", "mollie", "adyen", "nyx", "nld", "term", "via", "van", "naar", "bv", "b.v", "nv", "card", "payment", "purchase", "pos", "debit", "credit", "contactless", "online",
]);

/** "BEA, Apple Pay ALBERT HEIJN 1234 AMSTERDAM" → "albert heijn amsterdam" */
export function merchantKey(s: string | null | undefined): string {
  if (!s) return "";
  const words = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NOISE.has(w));
  return words.slice(0, 3).join(" ");
}

/** The category each shop was booked under most often. */
export function learnCategories(transactions: Tx[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const x of transactions) {
    if (x.deleted_at || !x.category_id) continue;
    const key = merchantKey(x.note);
    if (!key) continue;
    const per = counts.get(key) ?? new Map<string, number>();
    per.set(x.category_id, (per.get(x.category_id) ?? 0) + 1);
    counts.set(key, per);
  }
  const best = new Map<string, string>();
  for (const [key, per] of counts) best.set(key, [...per].sort((a, b) => b[1] - a[1])[0][0]);
  return best;
}

/** The category for a row: what this shop got before, else the AI's guess
 *  if that is a real category of the right kind, else none. Also says where
 *  it came from, so the screen can show "as last time". */
export function suggestCategory(row: ReadRow, learned: Map<string, string>, categories: Cat[]): { id: string | null; from: "history" | "ai" | null } {
  const alive = categories.filter((c) => !c.deleted_at && c.is_income_category === (row.direction === "in"));
  const key = merchantKey(row.description);
  const known = key ? learned.get(key) : undefined;
  if (known && alive.some((c) => c.id === known)) return { id: known, from: "history" };
  const guess = row.category?.trim().toLowerCase();
  const hit = guess ? alive.find((c) => c.name.trim().toLowerCase() === guess) : undefined;
  return hit ? { id: hit.id, from: "ai" } : { id: null, from: null };
}

const day = (iso: string) => Math.round(Date.parse(iso.slice(0, 10) + "T12:00:00Z") / 86_400_000);

/** The booking this row already is: same direction and amount, within a
 *  day (a card payment is booked by the bank a day later) — or, for a fixed
 *  cost or repeating booking, within 10 days (booked ahead on a set day,
 *  debited by the bank a few days earlier or later). */
export function bookedAs<T extends Tx>(row: ReadRow, transactions: T[]): T | undefined {
  if (!row.date) return undefined;
  const d = day(row.date), type = row.direction === "in" ? "income" : "expense";
  return transactions.find(
    (x) => !x.deleted_at && x.type === type && Math.abs(Number(x.amount) - row.amount) < 0.005 && Math.abs(day(x.date) - d) <= (x.is_fixed_expense || x.recurrence_id ? 10 : 1),
  );
}

const OWN = /spaarrekening|spaar ?rekening|savings account|creditcard|credit card|eigen rekening|own account/i;

/** A transfer between own accounts, by the AI's flag or the wording. */
export const isTransfer = (row: ReadRow) => !!row.transfer || OWN.test(row.description);

export const isBooked = (row: ReadRow, transactions: Tx[]) => !!bookedAs(row, transactions);
