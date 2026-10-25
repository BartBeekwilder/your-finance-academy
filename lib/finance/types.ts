// Mirrors supabase/migrations/0001_init.sql and the iOS SwiftData models.
// Money is Postgres `numeric`. Supabase returns it as a JSON number, demo data
// uses strings; either way it's converted with Number() only at the point of
// display or summing.

export type UUID = string;
export type Money = string | number;

export type AccountType = "checking" | "savings" | "credit" | "cash" | "investment";
export type TransactionType = "expense" | "income";
export type AssetType = "crypto" | "stock" | "metal";
export type AppearanceMode = "system" | "light" | "dark";

type Synced = {
  id: UUID;
  updated_at: string;
  deleted_at: string | null;
};

export type Profile = {
  currency_code: string;
  appearance_mode: AppearanceMode;
  expected_gross_monthly: Money | null;
  expected_net_monthly: Money | null;
  payday_day: number | null;
  income_reminders: boolean;
};

export type Account = Synced & {
  name: string;
  type: AccountType;
  balance: Money;
  institution: string | null;
  is_default: boolean;
};

export type Category = Synced & {
  name: string;
  icon: string; // SF Symbol name — mapped to a web icon in components/finance/CategoryIcon
  color_hex: string;
  is_default: boolean;
  is_income_category: boolean;
  is_fixed_expense: boolean;
  sort_order: number;
  parent_id: UUID | null;
};

export type Budget = Synced & {
  category_id: UUID | null;
  amount: Money;
  month: string; // YYYY-MM-01
};

export type Transaction = Synced & {
  amount: Money; // always positive; sign comes from `type`
  type: TransactionType;
  date: string;
  note: string | null;
  is_auto_income: boolean;
  is_fixed_expense: boolean;
  recurrence_id: UUID | null;
  category_id: UUID | null;
  account_id: UUID | null;
  /** Income only: the amount before tax and deductions (migration 0007);
   *  null / missing = gross equals net. */
  gross_amount?: Money | null;
  /** Expense spread over this many months (migration 0008); null = one-off. */
  spread_months?: number | null;
  /** Runtime only (never stored): a monthly part of a spread expense — the
   *  original purchase, and which part of how many this is. */
  spread_of?: Transaction;
  spread_index?: number;
  spread_total?: number;
};

export type IncomeRecord = Synced & {
  month: string;
  gross_amount: Money;
  net_amount: Money;
  is_actual: boolean;
  confirmed_date: string | null;
  transaction_id: UUID | null;
};

export type Holding = Synced & {
  symbol: string;
  name: string;
  asset_type: AssetType;
  quantity: Money;
  cost_basis: Money | null;
  cost_basis_currency: string | null;
  date_added: string;
};

/** A balance sheet post the user keeps (home, mortgage, loan…). */
export type BalanceItem = Synced & {
  name: string;
  side: "asset" | "liability";
  current_value: Money;
  sort_order: number;
};

/** A post's value at the end of a month (month = YYYY-MM-01). */
export type BalanceValue = Synced & {
  item_id: UUID;
  month: string;
  value: Money;
};

/** A home or other property (real-estate module). */
export type Property = Synced & {
  name: string;
  value: Money;
  value_date: string | null;
  purchase_price: Money | null;
  purchase_date: string | null;
  /** Which country's rules apply ('INTL' = none). */
  country: "INTL" | "NL";
  sort_order: number;
};

/** One loan part ("leningdeel") of a mortgage on a property. */
export type MortgagePartRow = Synced & {
  property_id: UUID;
  name: string;
  kind: "annuity" | "linear" | "interest_only";
  principal: Money;
  /** Annual rate in %. */
  rate: Money;
  fixed_until: string | null;
  start_date: string;
  term_months: number;
  nhg: boolean;
  extra_monthly: Money;
  sort_order: number;
};

/** A closed month with a snapshot of how it went. */
export type MonthClose = Synced & {
  month: string; // YYYY-MM-01
  closed_at: string;
  summary: { income: number; spent: number; saved: number; savingsRate: number; equity: number; allBudgetsKept: boolean; rings: number };
  points: number;
};

export type Goal = Synced & {
  kind: "save" | "debt" | "equity" | "category_limit";
  name: string;
  target: Money;
  /** Where it stood when the goal was made. */
  start_value: Money;
  target_date: string | null;
  category_id: UUID | null;
  achieved_at: string | null;
  sort_order: number;
  created_at?: string;
};

export type Achievement = Synced & { code: string; earned_at: string; points: number };

export type ActivityDay = Synced & { day: string };

/** An insurance policy (insurance module). */
export type InsurancePolicy = Synced & {
  kind: "health" | "home" | "contents" | "liability" | "car" | "travel" | "life" | "disability" | "legal" | "pet" | "other";
  name: string;
  insurer: string;
  premium: Money;
  period: "month" | "quarter" | "year";
  deductible: Money;
  coverage: Money | null;
  start_date: string | null;
  renewal_date: string | null;
  notice_months: number;
  notes: string;
  sort_order: number;
};

export type FinanceData = {
  profile: Profile;
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  incomeRecords: IncomeRecord[];
  holdings: Holding[];
  balanceItems: BalanceItem[];
  balanceValues: BalanceValue[];
  properties: Property[];
  mortgageParts: MortgagePartRow[];
  monthCloses: MonthClose[];
  goals: Goal[];
  achievements: Achievement[];
  activityDays: ActivityDay[];
  insurancePolicies: InsurancePolicy[];
  /** Year-end stands from before the app (imported history): assets and
   *  liabilities per year — the dashboard draws equity over the years from
   *  them. Local data only for now (no Supabase table yet). */
  yearSnapshots?: { year: number; assets: Money; liabilities: Money }[];
  /** Runtime only (never stored): each holding's market value over time in
   *  the profile currency, [unix ms, value] by holding id, from live quotes
   *  (FinanceProvider). Missing = value holdings at cost. */
  market?: Record<string, [number, number][]>;
};
