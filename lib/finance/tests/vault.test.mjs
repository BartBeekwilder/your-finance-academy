// End-to-end encrypted vault. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlain, NeedsPassphrase, open, plain, seal, unlock } from "../vault.ts";

const data = { profile: { currency_code: "EUR" }, transactions: [{ amount: "2000.00", note: "Laptop €" }] };
const pass = "correct horse battery staple";

test("round trip with the right passphrase", async () => {
  const s = await seal(data, pass, 1000);
  assert.deepEqual(await open(s, pass), data);
  assert.ok(!s.ciphertext.includes("Laptop"));
});

test("a wrong passphrase or altered data fails", async () => {
  const s = await seal(data, pass, 1000);
  await assert.rejects(open(s, "correct horse battery stapl3"), /Wrong passphrase/);
  const bad = { ...s, ciphertext: s.ciphertext.slice(0, -4) + (s.ciphertext.endsWith("AAAA") ? "BBBB" : "AAAA") };
  await assert.rejects(open(bad, pass), /Wrong passphrase/);
});

test("fresh salt and IV every time; short passphrases refused", async () => {
  const a = await seal(data, pass, 1000), b = await seal(data, pass, 1000);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  await assert.rejects(seal(data, "short", 1000), /at least 12/);
});

test("an unlocked vault reads any copy and seals copies the plain open() reads", async () => {
  const v = await unlock(pass, 1000);
  const other = await seal(data, pass, 1000); // another device, its own salt
  assert.deepEqual(await v.open(other), data);
  const a = await v.seal(data), b = await v.seal(data);
  assert.equal(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.deepEqual(await open(a, pass), data);
  const wrong = await unlock("not the right passphrase", 1000);
  await assert.rejects(() => wrong.open(a));
});

test("without a passphrase: a plain copy, readable by both kinds of unlocked vault", async () => {
  const p = plain();
  assert.equal(p.protected, false);
  const copy = await p.seal(data);
  assert.ok(isPlain(copy));
  assert.deepEqual(JSON.parse(copy.ciphertext), data);
  assert.deepEqual(await p.open(copy), data);
  // A device that still has the passphrase opens a plain copy as it is.
  const v = await unlock(pass, 1000);
  assert.equal(v.protected, true);
  assert.deepEqual(await v.open(copy), data);
});

test("a protected copy needs its passphrase: the plain vault refuses it", async () => {
  const sealed = await seal(data, pass, 1000);
  assert.ok(!isPlain(sealed));
  await assert.rejects(plain().open(sealed), NeedsPassphrase);
});

test("open() with a passphrase also reads a copy kept without one", async () => {
  assert.deepEqual(await open(await plain().seal(data), pass), data);
});
