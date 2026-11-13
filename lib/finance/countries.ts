// Where the user lives — for rules that differ per country (health
// insurance, Dutch mortgage tax). Not the language: someone can read the
// app in English and live in the Netherlands. The profile keeps the choice
// (profile.country, ISO 3166 code, set in Settings); until then it's guessed
// from the device's time zone, else the region in the browser's language.
// Pure functions only, so iOS and Android can port them 1:1.

/** Basic health insurance is compulsory by law. */
const HEALTH_REQUIRED = new Set(["NL", "DE", "CH", "BE", "AT", "LU", "FR", "JP", "KR", "TR", "ID", "IL", "TW", "CO", "SG"]);
/** A public system covers everyone; private cover only adds to it. */
const HEALTH_PUBLIC = new Set(["GB", "IE", "IT", "ES", "PT", "SE", "DK", "NO", "FI", "IS", "CA", "AU", "NZ", "PL", "CZ", "GR", "HR", "SI", "SK", "HU", "RO", "BG", "EE", "LV", "LT", "MT", "CY", "BR", "RU", "CN", "VN", "TH"]);

export type HealthRule = "required" | "public" | "private";

export function healthRule(country: string | null): HealthRule {
  if (country && HEALTH_REQUIRED.has(country)) return "required";
  if (country && HEALTH_PUBLIC.has(country)) return "public";
  return "private";
}

/** Common time zones → country. Enough to place most people; anything else
 *  falls back to the language's region. */
const ZONES: Record<string, string> = {
  "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Luxembourg": "LU", "Europe/Berlin": "DE", "Europe/Vienna": "AT", "Europe/Zurich": "CH",
  "Europe/Paris": "FR", "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Europe/Lisbon": "PT", "Europe/Rome": "IT", "Europe/London": "GB", "Europe/Dublin": "IE",
  "Europe/Stockholm": "SE", "Europe/Copenhagen": "DK", "Europe/Oslo": "NO", "Europe/Helsinki": "FI", "Europe/Warsaw": "PL", "Europe/Prague": "CZ",
  "Europe/Athens": "GR", "Europe/Budapest": "HU", "Europe/Bucharest": "RO", "Europe/Istanbul": "TR", "Europe/Moscow": "RU", "Europe/Kiev": "UA", "Europe/Kyiv": "UA",
  "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW", "Asia/Singapore": "SG", "Asia/Jakarta": "ID",
  "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN", "Asia/Bangkok": "TH", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Jerusalem": "IL",
  "Africa/Cairo": "EG", "Africa/Johannesburg": "ZA", "Africa/Lagos": "NG",
  "America/Sao_Paulo": "BR", "America/Mexico_City": "MX", "America/Bogota": "CO", "America/Argentina/Buenos_Aires": "AR",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU", "Australia/Perth": "AU", "Pacific/Auckland": "NZ",
};

/** The country this device seems to be in, or null. */
export function guessCountry(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (ZONES[zone]) return ZONES[zone];
  } catch {}
  if (typeof navigator === "undefined") return null;
  for (const l of navigator.languages ?? [navigator.language]) {
    try {
      const region = new Intl.Locale(l).maximize().region;
      if (region && /^[A-Z]{2}$/.test(region)) return region;
    } catch {}
  }
  return null;
}

/** The user's country: the one chosen in Settings, else the guess. */
export const countryOf = (profile: { country?: string | null }) => profile.country || guessCountry();

/** The country's name in the app's language ("Netherlands", "Niederlande"). */
export function countryName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every country code Intl knows, for the picker (two letters, A–Z). */
export function countryCodes(): string[] {
  const out: string[] = [];
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  for (let a = 65; a <= 90; a++)
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      try {
        const name = names.of(code);
        if (name && name !== code) out.push(code);
      } catch {}
    }
  return out.filter((c) => !["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ", "AA"].includes(c) && !/^(Q[M-Z]|X[A-Z])$/.test(c));
}
