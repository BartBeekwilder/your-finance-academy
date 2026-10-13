// Mirrors supabase/migrations/0001_init.sql and the iOS SwiftData models.
// Money arrives from Postgres `numeric` as a string to avoid float rounding;
// it's converted with Number() only at the point of display or summing.

export type UUID = string;

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
  expected_gross_monthly: string | null;
  expected_net_monthly: string | null;
  payday_day: number | null;
  income_reminders: boolean;
};

export type Account = Synced & {
  name: string;
  type: AccountType;
  balance: string;
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
  amount: string;
  month: string; // YYYY-MM-01
};

export type Transaction = Synced & {
  amount: string; // always positive; sign comes from `type`
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
  gross_amount: string;
  net_amount: string;
  is_actual: boolean;
  confirmed_date: string | null;
  transaction_id: UUID | null;
};

export type Holding = Synced & {
  symbol: string;
  name: string;
  asset_type: AssetType;
  quantity: string;
  cost_basis: string | null;
  cost_basis_currency: string | null;
  date_added: string;
};

export type FinanceData = {
  profile: Profile;
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  incomeRecords: IncomeRecord[];
  holdings: Holding[];
};
