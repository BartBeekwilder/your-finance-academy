// Currencies offered in Settings. Changing the currency changes how amounts
// are shown; it doesn't convert them (exchange rates arrive with sync).
export const CURRENCIES: { code: string; name: string }[] = [
  { code: "EUR", name: "Euro" },
  { code: "USD", name: "US dollar" },
  { code: "GBP", name: "British pound" },
  { code: "CHF", name: "Swiss franc" },
  { code: "JPY", name: "Japanese yen" },
  { code: "CAD", name: "Canadian dollar" },
  { code: "AUD", name: "Australian dollar" },
  { code: "SEK", name: "Swedish krona" },
  { code: "NOK", name: "Norwegian krone" },
  { code: "DKK", name: "Danish krone" },
  { code: "PLN", name: "Polish złoty" },
  { code: "CNY", name: "Chinese yuan" },
  { code: "INR", name: "Indian rupee" },
  { code: "BRL", name: "Brazilian real" },
  { code: "ZAR", name: "South African rand" },
  { code: "TRY", name: "Turkish lira" },
];

/** The short symbol for a currency, e.g. "€", "$", "£" ("kr" for SEK). */
export function currencySymbol(code: string) {
  try {
    const parts = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

/** A sensible currency before anyone has chosen one (e.g. on the sign-in
 *  screen): from the browser's region, else the euro. */
export function guessCurrency() {
  const region = (typeof navigator !== "undefined" ? navigator.language : "").split("-")[1]?.toUpperCase();
  const byRegion: Record<string, string> = { US: "USD", GB: "GBP", CH: "CHF", JP: "JPY", CA: "CAD", AU: "AUD", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CN: "CNY", IN: "INR", BR: "BRL", ZA: "ZAR", TR: "TRY" };
  return (region && byRegion[region]) || "EUR";
}
