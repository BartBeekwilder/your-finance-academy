// Reading a payslip: the text lines of a (Dutch or English) payslip in, the
// key figures out — gross, net paid, wage tax and the period — so the Income
// page can show them next to what's entered and take them over on a click.
// Pure (no imports), so it's tested with plain node and ported to the apps.
//
// Payslips are tables: a label, then one or more amounts on the same line
// (period / cumulative). The first amount after the label is this period's.

export type PayslipFigures = {
  gross: number | null;
  net: number | null;
  tax: number | null;
  /** First day of the period's month, if a month and year were found. */
  period: { year: number; month: number } | null;
};

const AMOUNT = /-?(?:€\s*)?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|-?\d+(?:,\d{2})|-?\d{1,3}(?:,\d{3})*\.\d{2}/g;

/** "1.234,56" / "1234,56" / "1,234.56" → 1234.56 */
export function parseAmount(s: string): number | null {
  let t = s.replace(/[€\s]/g, "");
  if (/,\d{2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const amountsIn = (line: string) => (line.match(AMOUNT) ?? []).map(parseAmount).filter((n): n is number => n != null);

// Labels, most specific first. Each is matched case-insensitively at the
// start of a word.
const NET = [/netto\s*(?:uit\s*)?betaling/, /uit\s*te\s*betalen/, /te\s*betalen\s*(?:bedrag)?/, /netto\s*(?:loon|salaris|te\s*ontvangen)/, /net\s*pay/, /^netto\b/];
const GROSS = [/totaal\s*bruto/, /bruto\s*(?:loon|salaris|maandloon)/, /brutoloon/, /gross\s*(?:pay|salary)/, /^salaris\b/, /^maandloon\b/];
const TAX = [/loonheffing/, /loonbelasting/, /wage\s*tax/, /income\s*tax/];

const MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5, juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11,
  january: 0, february: 1, march: 2, may: 4, june: 5, july: 6, august: 7, october: 9,
};

function find(lines: string[], labels: RegExp[], pick: "first" | "last" = "first") {
  for (const re of labels) {
    const hits = lines.filter((l) => re.test(l.toLowerCase()));
    for (const l of pick === "last" ? [...hits].reverse() : hits) {
      const after = l.toLowerCase().replace(re, "§").split("§")[1] ?? l;
      const n = amountsIn(after)[0] ?? amountsIn(l)[0];
      if (n != null && n !== 0) return Math.abs(n);
    }
  }
  return null;
}

export function readPayslip(lines: string[]): PayslipFigures {
  const clean = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  // The net paid is usually near the bottom: take the last match.
  const net = find(clean, NET, "last");
  const gross = find(clean, GROSS);
  const tax = find(clean, TAX);
  let period: PayslipFigures["period"] = null;
  for (const l of clean) {
    const m = l.toLowerCase().match(/\b(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|january|february|march|may|june|july|august|october)\s+(20\d{2})\b/);
    if (m) {
      period = { year: Number(m[2]), month: MONTHS[m[1]] };
      break;
    }
    const p = l.match(/\bperiode\s*:?\s*(\d{1,2})\s*[-/]\s*(20\d{2})\b/i);
    if (p && Number(p[1]) >= 1 && Number(p[1]) <= 12) {
      period = { year: Number(p[2]), month: Number(p[1]) - 1 };
      break;
    }
  }
  // Sanity: net can't exceed gross.
  return { gross, net: gross != null && net != null && net > gross ? null : net, tax, period };
}
