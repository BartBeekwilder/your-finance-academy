// End-to-end encryption for the vault (supabase/migrations/0009): the data
// is encrypted in the browser with a key derived from a passphrase only the
// user knows, so the server only ever stores ciphertext. Web Crypto only —
// no imports — so it runs in browsers and in node's tests alike.
//
//   key  = PBKDF2-SHA256(passphrase, random 16-byte salt, 600 000 rounds)
//   data = AES-256-GCM(key, random 12-byte IV, JSON) — GCM also detects any
//          tampering or a wrong passphrase (decrypt throws).

export const KDF = { name: "PBKDF2", hash: "SHA-256", iterations: 600_000 } as const;
export const MIN_PASSPHRASE = 12;

export type Sealed = {
  ciphertext: string;
  iv: string;
  salt: string;
  kdf: { name: string; hash: string; iterations: number };
  version: number;
  bytes: number;
};

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts any JSON-able value with the passphrase. */
export async function seal(value: unknown, passphrase: string, iterations: number = KDF.iterations): Promise<Sealed> {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE} characters.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plain as BufferSource));
  return { ciphertext: b64(cipher), iv: b64(iv), salt: b64(salt), kdf: { ...KDF, iterations }, version: 1, bytes: plain.length };
}

/** Decrypts a sealed vault; throws on a wrong passphrase or altered data. */
export async function open<T = unknown>(sealed: Pick<Sealed, "ciphertext" | "iv" | "salt" | "kdf">, passphrase: string): Promise<T> {
  const key = await deriveKey(passphrase, unb64(sealed.salt), sealed.kdf.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) as BufferSource }, key, unb64(sealed.ciphertext) as BufferSource);
  } catch {
    throw new Error("Wrong passphrase, or the vault was changed.");
  }
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
