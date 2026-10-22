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
};
