// Matching rows read from a bank screenshot. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { isBooked, isTransfer, learnCategories, merchantKey, suggestCategory } from "../importMatch.ts";

const cats = [
  { id: "groc", name: "Boodschappen", is_income_category: false },
  { id: "fun", name: "Uit eten", is_income_category: false },
  { id: "sal", name: "Salaris", is_income_category: true },
  { id: "gone", name: "Oud", is_income_category: false, deleted_at: "2026-01-01" },
];
const tx = (note, category_id, amount = 10, date = "2026-11-05T12:00:00.000Z", type = "expense") => ({ note, category_id, amount: String(amount), date, type });
const row = (description, amount = 12.5, direction = "out", category = null, date = "2026-11-08") => ({ description, amount, direction, category, date });

test("merchantKey drops bank noise, digits and accents", () => {
  assert.equal(merchantKey("BEA, Apple Pay ALBERT HEIJN 1234 AMSTERDAM"), "albert heijn amsterdam");
  assert.equal(merchantKey("Albert Heijn 1234 Amsterdam"), "albert heijn amsterdam");
  assert.equal(merchantKey("Café Señor 12"), "cafe senor");
  assert.equal(merchantKey(null), "");
});

test("history wins over the AI's guess", () => {
  const learned = learnCategories([tx("Albert Heijn 1234 Amsterdam", "groc"), tx("Albert Heijn 1234 Amsterdam", "groc"), tx("Albert Heijn 1234 Amsterdam", "fun")]);
  assert.deepEqual(suggestCategory(row("BEA ALBERT HEIJN 1234 AMSTERDAM", 12.5, "out", "Uit eten"), learned, cats), { id: "groc", from: "history" });
});

test("the AI's guess counts only as an existing category of the right kind", () => {
  const learned = new Map();
  assert.deepEqual(suggestCategory(row("Nieuw restaurant", 30, "out", "uit eten"), learned, cats), { id: "fun", from: "ai" });
  assert.deepEqual(suggestCategory(row("Werkgever", 3000, "in", "Uit eten"), learned, cats), { id: null, from: null });
  assert.deepEqual(suggestCategory(row("Iets", 5, "out", "Oud"), learned, cats), { id: null, from: null });
  assert.deepEqual(suggestCategory(row("Iets", 5, "out", "Bestaat niet"), learned, cats), { id: null, from: null });
});

test("a learned category that was deleted is not suggested", () => {
  const learned = learnCategories([tx("Shop X", "gone")]);
  assert.deepEqual(suggestCategory(row("Shop X", 5, "out", null), learned, cats), { id: null, from: null });
});

test("isBooked: same amount and direction within a day", () => {
  const books = [tx("AH", "groc", 12.5, "2026-11-07T18:00:00.000Z")];
  assert.equal(isBooked(row("AH", 12.5), books), true);
  assert.equal(isBooked(row("AH", 12.5, "out", null, "2026-11-10"), books), false);
  assert.equal(isBooked(row("AH", 12.51), books), false);
  assert.equal(isBooked(row("AH", 12.5, "in"), books), false);
  assert.equal(isBooked({ ...row("AH", 12.5), date: null }, books), false);
  assert.equal(isBooked(row("AH", 12.5), [{ ...books[0], deleted_at: "2026-11-08" }]), false);
});

test("isTransfer: own savings and credit card, by flag or wording", () => {
  assert.equal(isTransfer(row("To Oranje spaarrekening A56300553", 100)), true);
  assert.equal(isTransfer(row("Incasso ING creditcard", 1911.05)), true);
  assert.equal(isTransfer({ ...row("Naar Bart", 50), transfer: true }), true);
  assert.equal(isTransfer(row("Jumbo Veghel", 10.85)), false);
});

test("a fixed cost booked ahead matches within 10 days", () => {
  const books = [{ ...tx("Zorgverzekering", "zorg", 155.12, "2026-10-29T11:00:00.000Z"), is_fixed_expense: true }];
  assert.equal(isBooked(row("Menzis Zorgverzekeraar", 155.12, "out", null, "2026-11-03"), books), true);
  assert.equal(isBooked(row("Menzis Zorgverzekeraar", 155.12, "out", null, "2026-11-12"), books), false);
  assert.equal(isBooked(row("Menzis Zorgverzekeraar", 79, "out", null, "2026-11-03"), books), false);
});
