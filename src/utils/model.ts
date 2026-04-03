import { model, Schema } from "mongoose";

//= USER TRANSACTION (transaction_category_summaries)
//? Granularity: Daily per Wallet + Category
const userTransaction: Schema = new Schema({
  UserID: { type: String, required: true },

  WalletID: { type: String, required: true },
  WalletName: String,
  WalletType: String,

  CategoryID: { type: String, required: true },
  CategoryName: String,
  CategoryType: { type: String, enum: ["income", "expense"] },
  ParentCategoryName: String, // Parent category name for grouping

  // Time dimensions — all Number for consistent sort/group
  Date: { type: Date, required: true },
  Year: Number,
  Month: Number,
  Week: Number,
  Day: Number,

  TotalAmount: { type: Number, default: 0 },
  TransactionCount: { type: Number, default: 0 },
  Transactions: [
    {
      ID: String,
      Description: String,
      Date: Date,
      Amount: Number,
    },
  ],

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

// Unique: one document per wallet + category + date
userTransaction.index(
  { UserID: 1, WalletID: 1, CategoryID: 1, Date: 1 },
  { unique: true },
);
// Query indexes
userTransaction.index({ UserID: 1, Date: 1 });
userTransaction.index({ UserID: 1, Year: 1, Month: 1 });
userTransaction.index({ UserID: 1, Year: 1, Week: 1 });

//= USER BALANCE (balance_snapshots)
//? Granularity: Daily per Wallet
const userBalance: Schema = new Schema({
  UserID: { type: String, required: true },

  WalletID: { type: String, required: true },
  WalletName: String,

  // Time dimensions — all Number for consistent sort/group
  Date: { type: Date, required: true },
  Year: Number,
  Month: Number,
  Week: Number,
  Day: Number,
  IsMonthStart: Boolean,
  IsWeekStart: Boolean,

  OpeningBalance: { type: Number, default: 0 },
  ClosingBalance: { type: Number, default: 0 },

  TotalIncome: { type: Number, default: 0 },
  TotalExpense: { type: Number, default: 0 },
  NetChange: { type: Number, default: 0 },
  TransactionCount: { type: Number, default: 0 },

  CumulativeIncome: { type: Number, default: 0 },
  CumulativeExpense: { type: Number, default: 0 },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

// Unique: one document per wallet + date
userBalance.index({ WalletID: 1, Date: 1 }, { unique: true });
// Query indexes
userBalance.index({ UserID: 1, Date: 1 });
userBalance.index({ UserID: 1, Year: 1, Month: 1 });

//= USER FINANCIAL SUMMARIES
//? Granularity: per Period (daily/weekly/monthly/yearly)
const userFinancialSummaries: Schema = new Schema({
  UserID: { type: String, required: true },

  PeriodType: {
    type: String,
    enum: ["daily", "weekly", "monthly", "yearly"],
    required: true,
  },
  PeriodKey: { type: String, required: true },
  PeriodStart: Date,
  PeriodEnd: Date,

  // Current period values
  IncomeNow: { type: Number, default: 0 },
  ExpenseNow: { type: Number, default: 0 },
  ProfitNow: { type: Number, default: 0 },
  BalanceNow: { type: Number, default: 0 },

  // Previous period values (for comparison)
  IncomePrev: { type: Number, default: 0 },
  ExpensePrev: { type: Number, default: 0 },
  ProfitPrev: { type: Number, default: 0 },
  BalancePrev: { type: Number, default: 0 },

  // Growth percentages
  IncomeGrowthPct: Number,
  ExpenseGrowthPct: Number,
  ProfitGrowthPct: Number,
  BalanceGrowthPct: Number,

  // Ratios & health indicators
  SavingsRate: Number,
  ExpenseToIncomeRatio: Number,
  BurnRateDaily: Number,
  AvgIncomeDaily: Number,
  AvgExpenseDaily: Number,
  RunwayDays: Number,

  // Transaction stats
  TotalTransactions: { type: Number, default: 0 },
  IncomeTransactionCount: { type: Number, default: 0 },
  ExpenseTransactionCount: { type: Number, default: 0 },
  AvgTransactionAmount: Number,
  LargestIncome: Number,
  LargestExpense: Number,

  // Investment summary
  InvestmentSummary: {
    TotalInvested: { type: Number, default: 0 },
    TotalCurrentValuation: { type: Number, default: 0 },
    TotalSoldAmount: { type: Number, default: 0 },
    TotalDeficit: { type: Number, default: 0 },
    UnrealizedGain: { type: Number, default: 0 },
    RealizedGain: { type: Number, default: 0 },
    InvestmentGrowthPct: Number,
    BuyCount: { type: Number, default: 0 },
    SellCount: { type: Number, default: 0 },
    ActivePositions: { type: Number, default: 0 },
  },

  // Net worth
  NetWorth: {
    Total: { type: Number, default: 0 },
    WalletPortion: { type: Number, default: 0 },
    InvestmentPortion: { type: Number, default: 0 },
    NetWorthPrev: { type: Number, default: 0 },
    NetWorthGrowthPct: Number,
  },

  // Top categories (denormalized top N)
  TopExpenseCategories: [
    {
      CategoryID: String,
      CategoryName: String,
      Amount: Number,
      Percentage: Number,
      TransactionCount: Number,
    },
  ],
  TopIncomeCategories: [
    {
      CategoryID: String,
      CategoryName: String,
      Amount: Number,
      Percentage: Number,
      TransactionCount: Number,
    },
  ],

  // Per wallet breakdown
  WalletSummaries: [
    {
      WalletID: String,
      WalletName: String,
      WalletType: String,
      OpeningBalance: Number,
      ClosingBalance: Number,
      Income: Number,
      Expense: Number,
      NetChange: Number,
      ShareOfBalancePct: Number,
    },
  ],

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

// Unique: one document per user + period type + period key
userFinancialSummaries.index(
  { UserID: 1, PeriodType: 1, PeriodKey: 1 },
  { unique: true },
);
userFinancialSummaries.index({ UserID: 1, PeriodType: 1, PeriodStart: 1 });

//= USER NET WORTH COMPOSITION (pie chart: wallet vs investment)
//? Granularity: Snapshot (latest state per user)
const userNetWorthComposition: Schema = new Schema({
  UserID: { type: String, required: true },
  Total: { type: Number, default: 0 },
  Slices: [
    {
      Label: { type: String, required: true },
      Amount: { type: Number, default: 0 },
      Percentage: { type: Number, default: 0 },
      Details: {
        ItemCount: Number,
        Description: String,
        UnrealizedGain: Number,
      },
    },
  ],

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

// Unique: one document per user (latest snapshot)
userNetWorthComposition.index({ UserID: 1 }, { unique: true });

//= USER WALLET (helper collection for wallet snapshots)
//? Granularity: One document per wallet
const userWallet: Schema = new Schema({
  WalletID: { type: String, required: true },
  UserID: { type: String, required: true },
  WalletName: { type: String, required: true },
  WalletType: String,
  WalletTypeName: String,
  Balance: { type: Number, default: 0 },
  Currency: String,
  Icon: String,
  IsActive: { type: Boolean, default: true },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

// Unique: one document per wallet
userWallet.index({ WalletID: 1 }, { unique: true });
// Query indexes
userWallet.index({ UserID: 1 });
userWallet.index({ UserID: 1, IsActive: 1 });

//= USER INVESTMENT (helper collection for active positions)
//? Granularity: One document per investment buy position
const userInvestment: Schema = new Schema({
  InvestmentID: { type: String, required: true },
  UserID: { type: String, required: true },
  Code: { type: String, required: true },
  AssetName: String,
  AssetUnit: String,

  // Position tracking
  Quantity: { type: Number, default: 0 },
  InitialQuantity: { type: Number, default: 0 },
  Amount: { type: Number, default: 0 },
  InitialValuation: { type: Number, default: 0 },
  AvgBuyPrice: { type: Number, default: 0 },

  // Current valuation rates
  ToIDR: { type: Number, default: 0 },
  ToUSD: { type: Number, default: 0 },
  ToEUR: { type: Number, default: 0 },

  // Sell tracking
  TotalSoldQuantity: { type: Number, default: 0 },
  TotalSoldAmount: { type: Number, default: 0 },
  TotalDeficit: { type: Number, default: 0 },
  RealizedGain: { type: Number, default: 0 },

  Date: Date,
  Description: String,
  IsActive: { type: Boolean, default: true },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

// Unique: one document per investment
userInvestment.index({ InvestmentID: 1 }, { unique: true });
// Query indexes
userInvestment.index({ UserID: 1 });
userInvestment.index({ UserID: 1, IsActive: 1 });
userInvestment.index({ UserID: 1, Code: 1 });

export const userTransactionModel = model("UserTransaction", userTransaction);
export const userBalanceModel = model("UserBalance", userBalance);
export const userFinancialSummariesModel = model(
  "UserFinancialSummaries",
  userFinancialSummaries,
);
export const userNetWorthCompositionModel = model(
  "UserNetWorthComposition",
  userNetWorthComposition,
);
export const userWalletModel = model("UserWallet", userWallet);
export const userInvestmentModel = model("UserInvestment", userInvestment);
