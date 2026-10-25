// Reading payslips. Run: npm run test:calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, readPayslip } from "../payslip.ts";

test("amounts in Dutch and English notation", () => {
  assert.equal(parseAmount("6.879,40"), 6879.4);
  assert.equal(parseAmount("€ 4.628,33"), 4628.33);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("238,21"), 238.21);
});

test("a Dutch payslip: gross, net, wage tax, period", () => {
  const lines = [
    "Acme B.V.        Salarisstrook",
    "Periode: september 2026",
    "Omschrijving   Periode   Cumulatief",
    "Salaris   6.879,40   61.914,60",
    "Totaal bruto   6.879,40   61.914,60",
    "Pensioenpremie   312,10",
    "Loonheffing   1.938,97   17.450,73",
    "Netto loon   4.628,33",
    "Netto uitbetaling   4.628,33",
  ];
  assert.deepEqual(readPayslip(lines), { gross: 6879.4, net: 4628.33, tax: 1938.97, period: { year: 2026, month: 8 } });
});

test("period as number, missing parts stay null, net above gross rejected", () => {
  const r = readPayslip(["Periode 03-2026", "Uit te betalen 2.100,00"]);
  assert.deepEqual(r, { gross: null, net: 2100, tax: null, period: { year: 2026, month: 2 } });
  assert.equal(readPayslip(["Bruto loon 1.000,00", "Netto 2.000,00"]).net, null);
});
