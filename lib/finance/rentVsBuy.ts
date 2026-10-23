// Rent or buy — what each choice leaves you with over the years.
//
// Both sides spend the same money each month; whoever's housing is cheaper
// that month invests the difference (at the same return). The renter starts
// by investing what the buyer puts into the home up front (own money +
// buying costs). So the comparison is fair: same income, same discipline.
//
//   Buyer's wealth  = home value − selling costs − mortgage left + portfolio
//   Renter's wealth = portfolio
//
// Monthly simulation; pure functions only, so iOS and Android can port it
// 1:1. Investment returns are taken before tax (wealth tax differs per
// country) — shown as an estimate.

import { annuityPayment, NL } from "./mortgage.ts";

export type RentBuyInput = {
  /** Purchase price of the home. */
  price: number;
  /** Own money put into the home (down payment). */
  ownMoney: number;
  /** Buying costs as a share of the price (transfer tax, notary, advice…). */
  buyCostsRate: number;
  /** Mortgage interest, per year (0.04 = 4%). */
  rate: number;
  /** Mortgage term in years. */
  termYears: number;
  kind: "annuity" | "linear";
  /** Home value growth per year. */
  appreciation: number;
  /** Maintenance per year as a share of the home value. */
  maintenanceRate: number;
  /** Other owner costs per year as a share of the value (property tax,
   *  insurance, HOA/VvE). */
  ownerCostsRate: number;
  /** Selling costs as a share of the value, when you'd sell. */
  sellCostsRate: number;
  /** Rent per month now. */
  rent: number;
  /** Rent increase per year. */
  rentGrowth: number;
  /** Return on invested money per year. */
  investReturn: number;
  /** Dutch mortgage interest deduction minus eigenwoningforfait. */
  nlTax: boolean;
  /** Years to compare. */
  years: number;
};

export const RENT_BUY_DEFAULTS: RentBuyInput = {
  price: 450_000,
  ownMoney: 45_000,
  buyCostsRate: 0.04,
  rate: 0.038,
  termYears: 30,
  kind: "annuity",
  appreciation: 0.03,
  maintenanceRate: 0.01,
  ownerCostsRate: 0.004,
  sellCostsRate: 0.015,
  rent: 1_600,
  rentGrowth: 0.03,
  investReturn: 0.05,
  nlTax: false,
  years: 30,
};

export type RentBuyYear = {
  year: number;
  buyer: number;
  renter: number;
  homeValue: number;
  debt: number;
  buyerPortfolio: number;
  renterPortfolio: number;
  /** This year's monthly averages: what owning and renting cost. */
  ownMonthly: number;
  rentMonthly: number;
};

export type RentBuyResult = {
  /** Year 0 (start) … years. */
  timeline: RentBuyYear[];
  /** First year in which buying is ahead (and stays ahead), or null. */
  breakEven: number | null;
  loan: number;
  upfront: number;
  /** First month: what owning costs, split up. */
  firstMonth: { interest: number; repayment: number; maintenance: number; ownerCosts: number; tax: number; total: number; rent: number };
  totals: CostTotals;
  /** The same totals per year (index 0 = the first year). */
  byYear: CostTotals[];
};

export type CostTotals = { rent: number; interest: number; repayment: number; maintenance: number; ownerCosts: number; tax: number };
const zero = (): CostTotals => ({ rent: 0, interest: 0, repayment: 0, maintenance: 0, ownerCosts: 0, tax: 0 });

const monthly = (yearly: number) => Math.pow(1 + yearly, 1 / 12) - 1;

export function rentVsBuy(x: RentBuyInput): RentBuyResult {
  const loan = Math.max(x.price - x.ownMoney, 0);
  const upfront = x.ownMoney + x.price * x.buyCostsRate;
  const n = Math.round(x.termYears * 12);
  const r = x.rate / 12;
  const annuity = annuityPayment(loan, r, n);
  const grow = monthly(x.appreciation);
  const inv = monthly(x.investReturn);

  let value = x.price;
  let debt = loan;
  let rent = x.rent;
  let buyerPf = 0;
  let renterPf = upfront;
  const totals = zero();
  const byYear: CostTotals[] = [];
  let year = zero();
  let firstMonth: RentBuyResult["firstMonth"] | null = null;

  const wealth = (): Pick<RentBuyYear, "buyer" | "renter"> => ({ buyer: value * (1 - x.sellCostsRate) - debt + buyerPf, renter: renterPf });
  const timeline: RentBuyYear[] = [{ year: 0, ...wealth(), homeValue: value, debt, buyerPortfolio: buyerPf, renterPortfolio: renterPf, ownMonthly: 0, rentMonthly: rent }];

  let ownSum = 0, rentSum = 0;
  for (let m = 1; m <= x.years * 12; m++) {
    // Owning this month.
    const interest = debt * r;
    const repayment = debt <= 0.005 ? 0 : Math.min(debt, x.kind === "annuity" ? annuity - interest : loan / n);
    const maintenance = (value * x.maintenanceRate) / 12;
    const ownerCosts = (value * x.ownerCostsRate) / 12;
    const tax = x.nlTax ? Math.max(interest - (Math.min(value, NL.forfaitCap) * NL.forfaitRate) / 12, 0) * NL.maxDeductionRate : 0;
    const own = interest + repayment + maintenance + ownerCosts - tax;
    if (!firstMonth) firstMonth = { interest, repayment, maintenance, ownerCosts, tax, total: own, rent };

    // Whoever spends less this month invests the difference.
    buyerPf *= 1 + inv;
    renterPf *= 1 + inv;
    if (own > rent) renterPf += own - rent;
    else buyerPf += rent - own;

    debt = Math.max(debt - repayment, 0);
    value *= 1 + grow;
    for (const tt of [totals, year]) {
      tt.rent += rent;
      tt.interest += interest;
      tt.repayment += repayment;
      tt.maintenance += maintenance;
      tt.ownerCosts += ownerCosts;
      tt.tax += tax;
    }
    ownSum += own;
    rentSum += rent;

    if (m % 12 === 0) {
      timeline.push({ year: m / 12, ...wealth(), homeValue: value, debt, buyerPortfolio: buyerPf, renterPortfolio: renterPf, ownMonthly: ownSum / 12, rentMonthly: rentSum / 12 });
      ownSum = rentSum = 0;
      byYear.push(year);
      year = zero();
      rent *= 1 + x.rentGrowth;
    }
  }

  // Break-even: from this year on, buying stays ahead.
  let breakEven: number | null = null;
  for (let i = timeline.length - 1; i >= 1; i--) {
    if (timeline[i].buyer >= timeline[i].renter) breakEven = timeline[i].year;
    else break;
  }

  return { timeline, breakEven, loan, upfront, firstMonth: firstMonth ?? { interest: 0, repayment: 0, maintenance: 0, ownerCosts: 0, tax: 0, total: 0, rent: x.rent }, totals, byYear };
}
