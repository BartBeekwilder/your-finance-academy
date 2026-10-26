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

test("a totals row: gross, wage tax and net in columns", () => {
  const lines = [
    "Mei 2024",
    "Looncomponent   Bruto   Loonheff.   Netto",
    "Salaris   5.000,00   -1.500,00   3.500,00",
    "Vakantietoeslag   1.600,00   -800,00   800,00",
    "Zorgverzekeringpremie   -140,00   -140,00",
    "Totaal periode   6.600,00   -2.300,00   4.160,00",
    "Loonheffing   2.300,00   7.500,00",
  ];
  assert.deepEqual(readPayslip(lines), { gross: 6600, net: 4160, tax: 2300, period: { year: 2024, month: 4 } });
});

test("a deduction line lists its basis first: wage tax is the negative amount", () => {
  const lines = [
    "Oktober 2026",
    "Salaris   176,00   6.000,00   6.000,00   60.000,00",
    "Brutoloon   7.000,00",
    "Loonheffing   7.000,00   -2.400,00   -22.000,00",
    "Nettoloon   4.600,00",
    "Uit te betalen loon   5.000,00",
  ];
  assert.deepEqual(readPayslip(lines), { gross: 7000, net: 5000, tax: 2400, period: { year: 2026, month: 9 } });
});
