import {
  getCategoryTransactionsType,
  getUserBalanceType,
  getUserFinancialSummaryType,
  getUserNetWorthCompositionType,
  getUserTransactionType,
} from "./utils/dto";
import {
  userBalanceModel,
  userFinancialSummariesModel,
  userNetWorthCompositionModel,
  userTransactionModel,
} from "./utils/model";

const getUserTransaction = async (data: getUserTransactionType) => {
  const { userID, walletID, dateOption } = data;
  const { date, year, month, day, range } = dateOption;

  // Build match conditions
  const matchConditions: any = { UserID: userID };

  //= WALLET FILTERING
  if (walletID) {
    matchConditions.WalletID = walletID;
  }

  //= DATE FILTERING - Priority order
  // 1. EXACT DATE (highest priority)
  if (date) {
    matchConditions.Date = date;
  }
  // 2. DATE RANGE
  else if (range?.start && range?.end) {
    matchConditions.Date = {
      $gte: range.start,
      $lte: range.end,
    };
  }
  // 3. YEAR + MONTH + DAY
  else if (year && month && day) {
    matchConditions.Year = year;
    matchConditions.Month = month;
    matchConditions.Day = day;
  }
  // 4. YEAR + MONTH
  else if (year && month) {
    matchConditions.Year = year;
    matchConditions.Month = month;
  }
  // 5. YEAR ONLY
  else if (year) {
    matchConditions.Year = year;
  }
  // 6. NO DATE FILTER = ALL TIME
  // (no additional conditions needed)

  //= AGGREGATION PIPELINE
  const result = await userTransactionModel.aggregate([
    // Stage 1: Match documents
    {
      $match: matchConditions,
    },
    // Stage 2: Group by category
    {
      $group: {
        _id: {
          CategoryID: "$CategoryID",
          CategoryName: "$CategoryName",
          CategoryType: "$CategoryType",
          ParentCategoryName: "$ParentCategoryName",
        },
        TotalAmount: { $sum: "$TotalAmount" },
        TotalTransactions: { $sum: "$TransactionCount" },
      },
    },
    // Stage 3: Sort by total amount (descending)
    {
      $sort: { TotalAmount: -1 },
    },
    // Stage 4: Project to clean format
    {
      $project: {
        _id: 0,
        CategoryID: "$_id.CategoryID",
        CategoryName: "$_id.CategoryName",
        CategoryType: "$_id.CategoryType",
        ParentCategoryName: "$_id.ParentCategoryName",
        TotalAmount: 1,
        TotalTransactions: 1,
      },
    },
  ]);

  return result;
};

const getCategoryTransactions = async (data: getCategoryTransactionsType) => {
  const { userID, categoryID, walletID, dateOption } = data;
  const { date, year, month, day, range } = dateOption;

  // Build match conditions
  const matchConditions: any = { UserID: userID, CategoryID: categoryID };

  //= WALLET FILTERING
  if (walletID) {
    matchConditions.WalletID = walletID;
  }

  //= DATE FILTERING - Priority order
  // 1. EXACT DATE (highest priority)
  if (date) {
    matchConditions.Date = date;
  }
  // 2. DATE RANGE
  else if (range?.start && range?.end) {
    matchConditions.Date = {
      $gte: range.start,
      $lte: range.end,
    };
  }
  // 3. YEAR + MONTH + DAY
  else if (year && month && day) {
    matchConditions.Year = year;
    matchConditions.Month = month;
    matchConditions.Day = day;
  }
  // 4. YEAR + MONTH
  else if (year && month) {
    matchConditions.Year = year;
    matchConditions.Month = month;
  }
  // 5. YEAR ONLY
  else if (year) {
    matchConditions.Year = year;
  }
  // 6. NO DATE FILTER = ALL TIME

  // Get category info and all transactions
  const result = await userTransactionModel.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: {
          CategoryID: "$CategoryID",
          CategoryName: "$CategoryName",
          CategoryType: "$CategoryType",
          ParentCategoryName: "$ParentCategoryName",
        },
        Transactions: {
          $push: {
            $map: {
              input: "$Transactions",
              as: "tx",
              in: {
                TransactionID: "$$tx.ID",
                Description: "$$tx.Description",
                TransactionDate: "$$tx.Date",
                Amount: "$$tx.Amount",
                WalletName: "$WalletName",
              },
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        CategoryID: "$_id.CategoryID",
        CategoryName: "$_id.CategoryName",
        CategoryType: "$_id.CategoryType",
        ParentCategoryName: "$_id.ParentCategoryName",
        Transactions: {
          $reduce: {
            input: "$Transactions",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this"] },
          },
        },
      },
    },
  ]);

  if (result.length === 0) {
    return null;
  }

  // Sort transactions by date descending
  const categoryData = result[0];
  categoryData.Transactions.sort(
    (a: any, b: any) =>
      new Date(b.TransactionDate).getTime() -
      new Date(a.TransactionDate).getTime(),
  );

  return categoryData;
};

const getUserBalance = async (data: getUserBalanceType) => {
  const { userID, walletID, aggregation, range } = data;

  // Build match conditions
  const matchConditions: any = { UserID: userID };

  //= WALLET FILTERING
  if (walletID) {
    matchConditions.WalletID = walletID;
  }

  //= DATE RANGE FILTERING
  if (range?.start && range?.end) {
    matchConditions.Date = {
      $gte: range.start,
      $lte: range.end,
    };
  }
  // If no range = ALL TIME (no date filter)

  //= AGGREGATION BASED ON TYPE
  let result: any;

  if (aggregation === "daily") {
    // ═══════════════════════════════════════════════
    // DAILY: Return raw documents sorted by date
    // ═══════════════════════════════════════════════
    result = await userBalanceModel
      .find(matchConditions, {
        _id: 0,
        WalletID: 1,
        WalletName: 1,
        Date: 1,
        Year: 1,
        Month: 1,
        Day: 1,
        OpeningBalance: 1,
        ClosingBalance: 1,
        TotalIncome: 1,
        TotalExpense: 1,
        NetChange: 1,
        TransactionCount: 1,
      })
      .sort({ Date: 1 })
      .lean();
  } else if (aggregation === "weekly") {
    // ═══════════════════════════════════════════════
    // WEEKLY: Aggregate by Year + Week
    // ═══════════════════════════════════════════════
    result = await userBalanceModel.aggregate([
      // Stage 1: Match documents
      {
        $match: matchConditions,
      },
      // Stage 2: Sort by date (untuk $first dan $last)
      {
        $sort: { Date: 1 },
      },
      // Stage 3: Group by Year + Week
      {
        $group: {
          _id: {
            Year: "$Year",
            Week: "$Week",
            ...(walletID
              ? {}
              : { WalletID: "$WalletID", WalletName: "$WalletName" }),
          },
          OpeningBalance: { $first: "$OpeningBalance" }, // Saldo awal minggu
          ClosingBalance: { $last: "$ClosingBalance" }, // Saldo akhir minggu
          TotalIncome: { $sum: "$TotalIncome" },
          TotalExpense: { $sum: "$TotalExpense" },
          NetChange: { $sum: "$NetChange" },
          TotalTransactions: { $sum: "$TransactionCount" },
        },
      },
      // Stage 4: Sort by Year + Week
      {
        $sort: { "_id.Year": 1, "_id.Week": 1 },
      },
      // Stage 5: Project to clean format
      {
        $project: {
          _id: 0,
          Year: "$_id.Year",
          Week: "$_id.Week",
          ...(walletID
            ? {}
            : { WalletID: "$_id.WalletID", WalletName: "$_id.WalletName" }),
          OpeningBalance: 1,
          ClosingBalance: 1,
          TotalIncome: 1,
          TotalExpense: 1,
          NetChange: 1,
          TotalTransactions: 1,
        },
      },
    ]);
  } else if (aggregation === "monthly") {
    // ═══════════════════════════════════════════════
    // MONTHLY: Aggregate by Year + Month
    // ═══════════════════════════════════════════════
    result = await userBalanceModel.aggregate([
      // Stage 1: Match documents
      {
        $match: matchConditions,
      },
      // Stage 2: Sort by date (untuk $first dan $last)
      {
        $sort: { Date: 1 },
      },
      // Stage 3: Group by Year + Month
      {
        $group: {
          _id: {
            Year: "$Year",
            Month: "$Month",
            ...(walletID
              ? {}
              : { WalletID: "$WalletID", WalletName: "$WalletName" }),
          },
          OpeningBalance: { $first: "$OpeningBalance" }, // Saldo awal bulan
          ClosingBalance: { $last: "$ClosingBalance" }, // Saldo akhir bulan
          TotalIncome: { $sum: "$TotalIncome" },
          TotalExpense: { $sum: "$TotalExpense" },
          NetChange: { $sum: "$NetChange" },
          TotalTransactions: { $sum: "$TransactionCount" },
        },
      },
      // Stage 4: Sort by Year + Month
      {
        $sort: { "_id.Year": 1, "_id.Month": 1 },
      },
      // Stage 5: Project to clean format
      {
        $project: {
          _id: 0,
          Year: "$_id.Year",
          Month: "$_id.Month",
          ...(walletID
            ? {}
            : { WalletID: "$_id.WalletID", WalletName: "$_id.WalletName" }),
          OpeningBalance: 1,
          ClosingBalance: 1,
          TotalIncome: 1,
          TotalExpense: 1,
          NetChange: 1,
          TotalTransactions: 1,
        },
      },
    ]);
  }

  return result;
};

const getUserFinancialSummary = async (params: getUserFinancialSummaryType) => {
  const { userID, walletID, range } = params;

  // Build match conditions
  const matchConditions: any = { UserID: userID };

  //= WALLET FILTERING
  if (walletID) {
    matchConditions["WalletSummaries.WalletID"] = walletID;
  }

  //= DATE RANGE FILTERING
  if (range?.start && range?.end) {
    matchConditions.PeriodStart = { $gte: range.start };
    matchConditions.PeriodEnd = { $lte: range.end };
  }

  //= BASE PROJECTION (shared fields)
  const baseProjection: Record<string, number | object> = {
    _id: 0,
    UserID: 1,
    PeriodType: 1,
    PeriodKey: 1,
    PeriodStart: 1,
    PeriodEnd: 1,
    IncomeNow: 1,
    ExpenseNow: 1,
    ProfitNow: 1,
    BalanceNow: 1,
    IncomePrev: 1,
    ExpensePrev: 1,
    ProfitPrev: 1,
    BalancePrev: 1,
    IncomeGrowthPct: 1,
    ExpenseGrowthPct: 1,
    ProfitGrowthPct: 1,
    BalanceGrowthPct: 1,
    SavingsRate: 1,
    ExpenseToIncomeRatio: 1,
    BurnRateDaily: 1,
    AvgIncomeDaily: 1,
    AvgExpenseDaily: 1,
    RunwayDays: 1,
    TotalTransactions: 1,
    IncomeTransactionCount: 1,
    ExpenseTransactionCount: 1,
    AvgTransactionAmount: 1,
    LargestIncome: 1,
    LargestExpense: 1,
    InvestmentSummary: 1,
    NetWorth: 1,
    TopExpenseCategories: 1,
    TopIncomeCategories: 1,
  };

  // WalletSummaries: filter by specific wallet or return all
  const projection = {
    ...baseProjection,
    WalletSummaries: walletID ? { $elemMatch: { WalletID: walletID } } : 1,
  };

  const result = await userFinancialSummariesModel
    .find(matchConditions, projection)
    .sort({ PeriodStart: 1 })
    .lean();

  return result;
};

const getUserNetWorthComposition = async (
  params: getUserNetWorthCompositionType,
) => {
  const { userID } = params;

  // Simple query: just get the latest document for this user
  // This collection always represents ALL TIME, ALL WALLETS
  const result = await userNetWorthCompositionModel
    .findOne(
      { UserID: userID },
      {
        _id: 0,
        UserID: 1,
        Total: 1,
        Slices: 1,
        CreatedAt: 1,
        UpdatedAt: 1,
      },
    )
    .sort({ UpdatedAt: -1 })
    .lean();

  return result;
};

export default {
  getUserTransaction,
  getCategoryTransactions,
  getUserBalance,
  getUserFinancialSummary,
  getUserNetWorthComposition,
};
