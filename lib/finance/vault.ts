// The account's copy of the data (supabase/migrations/0009): plain JSON by
// default, or — with the optional passphrase — encrypted in the browser with
// a key derived from a passphrase only the user knows, so the server only
// ever stores ciphertext. Web Crypto only —
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
  // A copy kept without a passphrase (the default) opens as it is.
  if (isPlain(sealed)) return openPlain<T>(sealed);
  const key = await deriveKey(passphrase, unb64(sealed.salt), sealed.kdf.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) as BufferSource }, key, unb64(sealed.ciphertext) as BufferSource);
  } catch {
    throw new Error("Wrong passphrase, or the vault was changed.");
  }
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

// ---- An unlocked vault --------------------------------------------------
// The web keeps the vault unlocked while the app is open: the passphrase
// stays in memory only (never stored), and the key for each salt is derived
// once — PBKDF2 at 600 000 rounds takes a moment, too slow for every save.
// Each save gets a fresh IV under the same salt; a copy another device
// sealed with its own salt is opened with a key derived for that salt.

export type Unlocked = {
  /** Sealed with a passphrase (end-to-end), or kept as plain JSON. */
  protected: boolean;
  /** Opens a sealed copy (any salt) — throws on a wrong passphrase. */
  open<T = unknown>(sealed: Pick<Sealed, "ciphertext" | "iv" | "salt" | "kdf">): Promise<T>;
  /** Seals a value under the salt of the copy last opened (or a new one). */
  seal(value: unknown): Promise<Sealed>;
  /** The keys that opened or sealed a copy — to remember on this device
   *  (non-extractable CryptoKeys: the browser can use them, never read them). */
  keys(): Promise<KeyEntry[]>;
};

/** A derived key for one salt. */
export type KeyEntry = { salt: string; rounds: number; key: CryptoKey };

async function decryptWith<T>(key: CryptoKey, sealed: Pick<Sealed, "ciphertext" | "iv">): Promise<T> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) as BufferSource }, key, unb64(sealed.ciphertext) as BufferSource);
  } catch {
    throw new Error("Wrong passphrase, or the vault was changed.");
  }
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

async function encryptWith(key: CryptoKey, salt: string, rounds: number, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plain as BufferSource));
  return { ciphertext: b64(cipher), iv: b64(iv), salt, kdf: { ...KDF, iterations: rounds }, version: 1, bytes: plain.length };
}

// ---- Without a passphrase ---------------------------------------------------
// The default since 5 Nov: the account's copy is plain JSON in the same row
// (kdf "none"), readable only by the account (row-level security). A
// passphrase is an optional extra; either kind of copy opens with either
// kind of Unlocked, except a protected copy without its passphrase.

export const PLAIN_KDF = { name: "none", hash: "", iterations: 0 };

/** A copy kept without a passphrase. */
export const isPlain = (sealed: Pick<Sealed, "kdf">) => sealed.kdf?.name === PLAIN_KDF.name;

/** Thrown when a passphrase-protected copy is met without its passphrase. */
export class NeedsPassphrase extends Error {
  constructor() {
    super("This copy is protected with a passphrase.");
  }
}

function openPlain<T>(sealed: Pick<Sealed, "ciphertext">): T {
  return JSON.parse(sealed.ciphertext) as T;
}

export function plain(): Unlocked {
  return {
    protected: false,
    async open<T>(sealed: Pick<Sealed, "ciphertext" | "iv" | "salt" | "kdf">) {
      if (!isPlain(sealed)) throw new NeedsPassphrase();
      return openPlain<T>(sealed);
    },
    async seal(value: unknown) {
      const json = JSON.stringify(value);
      return { ciphertext: json, iv: "", salt: "", kdf: { ...PLAIN_KDF }, version: 1, bytes: new TextEncoder().encode(json).length };
    },
    async keys() {
      return [];
    },
  };
}

// Each copy is sealed under the salt of the copy it was opened from (a fresh
// IV every save), so every web device ends up on one salt and a key
// remembered on one device keeps opening what the others save.

export async function unlock(passphrase: string, iterations: number = KDF.iterations): Promise<Unlocked> {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE} characters.`);
  const keys = new Map<string, Promise<CryptoKey>>();
  const good = new Set<string>();
  const keyFor = (salt: string, rounds: number) => {
    const k = `${salt}/${rounds}`;
    if (!keys.has(k)) keys.set(k, deriveKey(passphrase, unb64(salt), rounds));
    return keys.get(k)!;
  };
  let salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  let rounds: number = iterations;
  return {
    protected: true,
    async open<T>(sealed: Pick<Sealed, "ciphertext" | "iv" | "salt" | "kdf">) {
      // Another device took the passphrase off: the copy opens as it is.
      if (isPlain(sealed)) return openPlain<T>(sealed);
      const value = await decryptWith<T>(await keyFor(sealed.salt, sealed.kdf.iterations), sealed);
      salt = sealed.salt;
      rounds = sealed.kdf.iterations;
      good.add(`${salt}/${rounds}`);
      return value;
    },
    async seal(value: unknown) {
      good.add(`${salt}/${rounds}`);
      return encryptWith(await keyFor(salt, rounds), salt, rounds, value);
    },
    async keys() {
      return Promise.all([...good].map(async (k) => {
        // The salt is base64 and may hold "/" itself: the rounds follow the last one.
        const cut = k.lastIndexOf("/");
        return { salt: k.slice(0, cut), rounds: Number(k.slice(cut + 1)), key: await keys.get(k)! };
      }));
    },
  };
}

/** A vault opened with keys remembered on this device (no passphrase typed).
 *  A copy sealed under a salt it doesn't know needs the passphrase again. */
export function fromKeys(entries: KeyEntry[]): Unlocked {
  if (!entries.length) throw new NeedsPassphrase();
  const known = [...entries];
  let current = known[known.length - 1];
  return {
    protected: true,
    async open<T>(sealed: Pick<Sealed, "ciphertext" | "iv" | "salt" | "kdf">) {
      if (isPlain(sealed)) return openPlain<T>(sealed);
      const e = known.find((k) => k.salt === sealed.salt && k.rounds === sealed.kdf.iterations);
      if (!e) throw new NeedsPassphrase();
      let value: T;
      try {
        value = await decryptWith<T>(e.key, sealed);
      } catch {
        throw new NeedsPassphrase();
      }
      current = e;
      return value;
    },
    async seal(value: unknown) {
      return encryptWith(current.key, current.salt, current.rounds, value);
    },
    async keys() {
      return [...known];
    },
  };
}
