import { investmentType, transactionType, walletType } from "./dto";
import {
  userBalanceModel,
  userFinancialSummariesModel,
  userNetWorthCompositionModel,
  userTransactionModel,
  userWalletModel,
} from "./model";
import logger from "./logger";

//= Get week number from date (ISO 8601)
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return weekNo;
}

//= Check if date is start of month
function isMonthStart(date: Date): boolean {
  return date.getDate() === 1;
}

//= Check if date is start of week (Monday)
function isWeekStart(date: Date): boolean {
  return date.getDay() === 1;
}

//= Get month name from month number
function getMonthName(month: number): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1] || "";
}

//= Group transactions by user, wallet, category, and date
function groupTransactionsByUserWalletCategoryDate(
  transactions: transactionType[],
  wallets: walletType[],
): Map<string, any> {
  const grouped = new Map<string, any>();

  // Create wallet lookup map
  const walletMap = new Map<string, walletType>();
  wallets.forEach((w) => walletMap.set(w.id, w));

  transactions.forEach((tx) => {
    const wallet = walletMap.get(tx.wallet_id);
    if (!wallet) return;

    const txDate = new Date(tx.transaction_date);
    const dateKey = txDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const key = `${wallet.user_id}|${tx.wallet_id}|${tx.category_id}|${dateKey}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        UserID: wallet.user_id,
        WalletID: tx.wallet_id,
        WalletName: wallet.name,
        WalletType: wallet.wallet_type,
        CategoryID: tx.category_id,
        CategoryName: tx.category_name,
        CategoryType: tx.category_type,
        Date: new Date(dateKey),
        Year: txDate.getFullYear(),
        Month: txDate.getMonth() + 1,
        Week: getWeekNumber(txDate),
        Day: txDate.getDate(),
        TotalAmount: 0,
        TransactionCount: 0,
        Transactions: [],
      });
    }

    const group = grouped.get(key);
    group.TotalAmount += tx.amount;
    group.TransactionCount += 1;
    group.Transactions.push({
      ID: tx.id,
      Description: tx.description,
      Date: tx.transaction_date,
    });
  });

  return grouped;
}

//= Calculate daily balance snapshots for each wallet
function calculateDailyBalances(
  transactions: transactionType[],
  wallets: walletType[],
): Map<string, any> {
  const dailyBalances = new Map<string, any>();

  // Create wallet lookup map
  const walletMap = new Map<string, walletType>();
  wallets.forEach((w) => walletMap.set(w.id, w));

  // Group transactions by wallet and date
  const walletTransactions = new Map<string, Map<string, transactionType[]>>();

  transactions.forEach((tx) => {
    const wallet = walletMap.get(tx.wallet_id);
    if (!wallet) return;

    const txDate = new Date(tx.transaction_date);
    const dateKey = txDate.toISOString().split("T")[0];

    if (!walletTransactions.has(tx.wallet_id)) {
      walletTransactions.set(tx.wallet_id, new Map());
    }

    const walletDates = walletTransactions.get(tx.wallet_id)!;
    if (!walletDates.has(dateKey)) {
      walletDates.set(dateKey, []);
    }

    walletDates.get(dateKey)!.push(tx);
  });

  // Calculate daily balances for each wallet
  walletTransactions.forEach((dateMap, walletId) => {
    const wallet = walletMap.get(walletId)!;
    const sortedDates = Array.from(dateMap.keys()).sort();

    let runningBalance = wallet.balance;
    let cumulativeIncome = 0;
    let cumulativeExpense = 0;

    // Process in reverse to calculate opening balances correctly
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const dateKey = sortedDates[i];
      const txs = dateMap.get(dateKey)!;
      const date = new Date(dateKey);

      let dailyIncome = 0;
      let dailyExpense = 0;

      txs.forEach((tx) => {
        if (tx.category_type === "income") {
          dailyIncome += tx.amount;
          runningBalance -= tx.amount; // Subtract to get opening balance
        } else {
          dailyExpense += tx.amount;
          runningBalance += tx.amount; // Add back to get opening balance
        }
      });

      const openingBalance = runningBalance;
      const closingBalance = openingBalance + dailyIncome - dailyExpense;

      const key = `${wallet.user_id}|${walletId}|${dateKey}`;

      dailyBalances.set(key, {
        UserID: wallet.user_id,
        WalletID: walletId,
        WalletName: wallet.name,
        Date: date,
        Year: date.getFullYear(),
        Month: date.getMonth() + 1,
        Week: getWeekNumber(date),
        Day: date.getDate(),
        IsMonthStart: isMonthStart(date),
        IsWeekStart: isWeekStart(date),
        OpeningBalance: openingBalance,
        ClosingBalance: closingBalance,
        TotalIncome: dailyIncome,
        TotalExpense: dailyExpense,
        NetChange: dailyIncome - dailyExpense,
        TransactionCount: txs.length,
        CumulativeIncome: cumulativeIncome + dailyIncome,
        CumulativeExpense: cumulativeExpense + dailyExpense,
      });

      cumulativeIncome += dailyIncome;
      cumulativeExpense += dailyExpense;
      runningBalance = closingBalance;
    }
  });

  return dailyBalances;
}

//= Calculate financial summaries per user per month
function calculateFinancialSummaries(
  transactions: transactionType[],
  wallets: walletType[],
  investments: investmentType[],
): Map<string, any> {
  const summaries = new Map<string, any>();

  // Group by user and month
  const userMonthData = new Map<
    string,
    Map<
      string,
      {
        transactions: transactionType[];
        wallets: Set<string>;
      }
    >
  >();

  const walletMap = new Map<string, walletType>();
  wallets.forEach((w) => walletMap.set(w.id, w));

  // Group transactions by user and month
  transactions.forEach((tx) => {
    const wallet = walletMap.get(tx.wallet_id);
    if (!wallet) return;

    const txDate = new Date(tx.transaction_date);
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;

    if (!userMonthData.has(wallet.user_id)) {
      userMonthData.set(wallet.user_id, new Map());
    }

    const userMonths = userMonthData.get(wallet.user_id)!;
    if (!userMonths.has(monthKey)) {
      userMonths.set(monthKey, {
        transactions: [],
        wallets: new Set(),
      });
    }

    const monthData = userMonths.get(monthKey)!;
    monthData.transactions.push(tx);
    monthData.wallets.add(tx.wallet_id);
  });

  // Calculate summaries for each user-month
  userMonthData.forEach((monthsMap, userId) => {
    const sortedMonths = Array.from(monthsMap.keys()).sort();

    sortedMonths.forEach((monthKey, index) => {
      const monthData = monthsMap.get(monthKey)!;
      const [year, month] = monthKey.split("-").map(Number);

      // Calculate current period metrics
      let incomeNow = 0;
      let expenseNow = 0;
      let incomeTransactionCount = 0;
      let expenseTransactionCount = 0;
      let largestIncome = 0;
      let largestExpense = 0;

      const categoryExpense = new Map<
        string,
        { name: string; amount: number; count: number }
      >();
      const categoryIncome = new Map<
        string,
        { name: string; amount: number; count: number }
      >();

      monthData.transactions.forEach((tx) => {
        if (tx.category_type === "income") {
          incomeNow += tx.amount;
          incomeTransactionCount++;
          if (tx.amount > largestIncome) largestIncome = tx.amount;

          if (!categoryIncome.has(tx.category_id)) {
            categoryIncome.set(tx.category_id, {
              name: tx.category_name,
              amount: 0,
              count: 0,
            });
          }
          const cat = categoryIncome.get(tx.category_id)!;
          cat.amount += tx.amount;
          cat.count++;
        } else {
          expenseNow += tx.amount;
          expenseTransactionCount++;
          if (tx.amount > largestExpense) largestExpense = tx.amount;

          if (!categoryExpense.has(tx.category_id)) {
            categoryExpense.set(tx.category_id, {
              name: tx.category_name,
              amount: 0,
              count: 0,
            });
          }
          const cat = categoryExpense.get(tx.category_id)!;
          cat.amount += tx.amount;
          cat.count++;
        }
      });

      const profitNow = incomeNow - expenseNow;

      // Calculate balance from wallets
      const userWallets = wallets.filter((w) => monthData.wallets.has(w.id));
      const balanceNow = userWallets.reduce((sum, w) => sum + w.balance, 0);

      // Get previous month data for comparison
      let incomePrev = 0;
      let expensePrev = 0;
      let profitPrev = 0;
      let balancePrev = 0;

      if (index > 0) {
        const prevMonthKey = sortedMonths[index - 1];
        const prevMonthData = monthsMap.get(prevMonthKey);
        if (prevMonthData) {
          prevMonthData.transactions.forEach((tx) => {
            if (tx.category_type === "income") {
              incomePrev += tx.amount;
            } else {
              expensePrev += tx.amount;
            }
          });
          profitPrev = incomePrev - expensePrev;
          // For balance prev, we'd need historical balance data
          // For now, use a simplified calculation
          balancePrev = balanceNow - profitNow + profitPrev;
        }
      }

      // Calculate growth percentages
      const incomeGrowthPct =
        incomePrev > 0 ? ((incomeNow - incomePrev) / incomePrev) * 100 : 0;
      const expenseGrowthPct =
        expensePrev > 0 ? ((expenseNow - expensePrev) / expensePrev) * 100 : 0;
      const profitGrowthPct =
        profitPrev > 0 ? ((profitNow - profitPrev) / profitPrev) * 100 : 0;
      const balanceGrowthPct =
        balancePrev > 0 ? ((balanceNow - balancePrev) / balancePrev) * 100 : 0;

      // Calculate health indicators
      const savingsRate = incomeNow > 0 ? (profitNow / incomeNow) * 100 : 0;
      const expenseToIncomeRatio =
        incomeNow > 0 ? (expenseNow / incomeNow) * 100 : 0;

      const daysInMonth = new Date(year, month, 0).getDate();
      const burnRateDaily = expenseNow / daysInMonth;
      const avgIncomeDaily = incomeNow / daysInMonth;
      const avgExpenseDaily = expenseNow / daysInMonth;
      const runwayDays =
        burnRateDaily > 0 ? Math.floor(balanceNow / burnRateDaily) : 0;

      // Calculate investment summary
      const userInvestments = investments.filter(
        (inv) => inv.userId === userId,
      );
      let totalInvested = 0;
      let totalCurrentValuation = 0;
      let buyCount = 0;
      let sellCount = 0;

      userInvestments.forEach((inv) => {
        totalInvested += inv.amount;
        totalCurrentValuation += inv.quantity * inv.assetCode.toIDR;
        if (inv.amount > 0) buyCount++;
        else sellCount++;
      });

      const unrealizedGain = totalCurrentValuation - totalInvested;
      const investmentGrowthPct =
        totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;

      // Top categories
      const topExpenseCategories = Array.from(categoryExpense.entries())
        .map(([id, data]) => ({
          CategoryID: id,
          CategoryName: data.name,
          Amount: data.amount,
          Percentage: expenseNow > 0 ? (data.amount / expenseNow) * 100 : 0,
          TransactionCount: data.count,
        }))
        .sort((a, b) => b.Amount - a.Amount)
        .slice(0, 5);

      const topIncomeCategories = Array.from(categoryIncome.entries())
        .map(([id, data]) => ({
          CategoryID: id,
          CategoryName: data.name,
          Amount: data.amount,
          Percentage: incomeNow > 0 ? (data.amount / incomeNow) * 100 : 0,
          TransactionCount: data.count,
        }))
        .sort((a, b) => b.Amount - a.Amount)
        .slice(0, 5);

      // Wallet summaries
      const walletSummaries = userWallets.map((wallet) => {
        const walletTxs = monthData.transactions.filter(
          (tx) => tx.wallet_id === wallet.id,
        );
        let walletIncome = 0;
        let walletExpense = 0;

        walletTxs.forEach((tx) => {
          if (tx.category_type === "income") {
            walletIncome += tx.amount;
          } else {
            walletExpense += tx.amount;
          }
        });

        return {
          WalletID: wallet.id,
          WalletName: wallet.name,
          WalletType: wallet.wallet_type,
          OpeningBalance: wallet.balance - (walletIncome - walletExpense),
          ClosingBalance: wallet.balance,
          Income: walletIncome,
          Expense: walletExpense,
          NetChange: walletIncome - walletExpense,
          ShareOfBalancePct:
            balanceNow > 0 ? (wallet.balance / balanceNow) * 100 : 0,
        };
      });

      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0);

      const key = `${userId}|monthly|${monthKey}`;

      summaries.set(key, {
        UserID: userId,
        PeriodType: "monthly",
        PeriodKey: monthKey,
        PeriodStart: periodStart,
        PeriodEnd: periodEnd,
        IncomeNow: incomeNow,
        ExpenseNow: expenseNow,
        ProfitNow: profitNow,
        BalanceNow: balanceNow,
        IncomePrev: incomePrev,
        ExpensePrev: expensePrev,
        ProfitPrev: profitPrev,
        BalancePrev: balancePrev,
        IncomeGrowthPct: incomeGrowthPct,
        ExpenseGrowthPct: expenseGrowthPct,
        ProfitGrowthPct: profitGrowthPct,
        BalanceGrowthPct: balanceGrowthPct,
        SavingsRate: savingsRate,
        ExpenseToIncomeRatio: expenseToIncomeRatio,
        BurnRateDaily: burnRateDaily,
        AvgIncomeDaily: avgIncomeDaily,
        AvgExpenseDaily: avgExpenseDaily,
        RunwayDays: runwayDays,
        TotalTransactions: monthData.transactions.length,
        IncomeTransactionCount: incomeTransactionCount,
        ExpenseTransactionCount: expenseTransactionCount,
        AvgTransactionAmount:
          monthData.transactions.length > 0
            ? (incomeNow + expenseNow) / monthData.transactions.length
            : 0,
        LargestIncome: largestIncome,
        LargestExpense: largestExpense,
        InvestmentSummary: {
          TotalInvested: totalInvested,
          TotalCurrentValuation: totalCurrentValuation,
          TotalSoldAmount: 0, // Would need sell transaction data
          TotalDeficit: 0,
          UnrealizedGain: unrealizedGain,
          RealizedGain: 0, // Would need sell transaction data
          InvestmentGrowthPct: investmentGrowthPct,
          BuyCount: buyCount,
          SellCount: sellCount,
          ActivePositions: userInvestments.length,
        },
        NetWorth: {
          Total: balanceNow + totalCurrentValuation,
          WalletPortion: balanceNow,
          InvestmentPortion: totalCurrentValuation,
          NetWorthPrev: balancePrev + totalInvested,
          NetWorthGrowthPct:
            balancePrev + totalInvested > 0
              ? ((balanceNow +
                  totalCurrentValuation -
                  (balancePrev + totalInvested)) /
                  (balancePrev + totalInvested)) *
                100
              : 0,
        },
        TopExpenseCategories: topExpenseCategories,
        TopIncomeCategories: topIncomeCategories,
        WalletSummaries: walletSummaries,
      });
    });
  });

  return summaries;
}

//= Calculate net worth composition per user
function calculateNetWorthCompositions(
  wallets: walletType[],
  investments: investmentType[],
): Map<string, any> {
  const compositions = new Map<string, any>();

  // Group by user
  const userWallets = new Map<string, walletType[]>();
  const userInvestments = new Map<string, investmentType[]>();

  wallets.forEach((w) => {
    if (!userWallets.has(w.user_id)) {
      userWallets.set(w.user_id, []);
    }
    userWallets.get(w.user_id)!.push(w);
  });

  investments.forEach((inv) => {
    if (!userInvestments.has(inv.userId)) {
      userInvestments.set(inv.userId, []);
    }
    userInvestments.get(inv.userId)!.push(inv);
  });

  // Get all unique users
  const allUsers = new Set([...userWallets.keys(), ...userInvestments.keys()]);

  allUsers.forEach((userId) => {
    const walletsList = userWallets.get(userId) || [];
    const investmentsList = userInvestments.get(userId) || [];

    // Calculate wallet totals
    const walletTotal = walletsList.reduce((sum, w) => sum + w.balance, 0);

    // Group wallets by type
    const walletsByType = new Map<string, number>();
    walletsList.forEach((w) => {
      const type = w.wallet_type_name || w.wallet_type || "Other";
      walletsByType.set(type, (walletsByType.get(type) || 0) + w.balance);
    });

    // Calculate investment totals
    let investmentTotal = 0;
    let unrealizedGain = 0;

    const investmentsByType = new Map<
      string,
      { total: number; gain: number }
    >();
    investmentsList.forEach((inv) => {
      const currentValue = inv.quantity * inv.assetCode.toIDR;
      investmentTotal += currentValue;
      const gain = currentValue - inv.amount;
      unrealizedGain += gain;

      const type = inv.assetCode.name || inv.code;
      if (!investmentsByType.has(type)) {
        investmentsByType.set(type, { total: 0, gain: 0 });
      }
      const typeData = investmentsByType.get(type)!;
      typeData.total += currentValue;
      typeData.gain += gain;
    });

    const total = walletTotal + investmentTotal;

    // Build slices
    const slices: any[] = [];

    // Wallet slices
    if (walletTotal > 0) {
      const walletDetails: Record<string, number> = {};
      walletsByType.forEach((amount, type) => {
        walletDetails[type] = amount;
      });

      slices.push({
        Label: "Cash & Bank Accounts",
        Amount: walletTotal,
        Percentage: total > 0 ? (walletTotal / total) * 100 : 0,
        Details: {
          ItemCount: walletsList.length,
          Description: `${walletsList.length} wallet(s)`,
          ...walletDetails,
        },
      });
    }

    // Investment slices
    if (investmentTotal > 0) {
      const investmentDetails: Record<string, number> = {};
      investmentsByType.forEach((data, type) => {
        investmentDetails[type] = data.total;
      });

      slices.push({
        Label: "Investments",
        Amount: investmentTotal,
        Percentage: total > 0 ? (investmentTotal / total) * 100 : 0,
        Details: {
          ItemCount: investmentsList.length,
          Description: `${investmentsList.length} investment(s)`,
          UnrealizedGain: unrealizedGain,
          ...investmentDetails,
        },
      });
    }

    compositions.set(userId, {
      UserID: userId,
      Total: total,
      Slices: slices,
    });
  });

  return compositions;
}

//$ MAIN INITIAL SYNC FUNCTION
export const initialSync = async (
  wallets: walletType[],
  transactions: transactionType[],
  investments: investmentType[],
) => {
  logger.info("Starting initial sync process...");

  try {
    // 0. Process UserWallet data (helper collection)
    logger.info("Processing user wallets...");
    if (wallets.length > 0) {
      await userWalletModel.bulkWrite(
        wallets.map((wallet) => ({
          updateOne: {
            filter: { WalletID: wallet.id },
            update: {
              $set: {
                WalletID: wallet.id,
                UserID: wallet.user_id,
                WalletName: wallet.name,
                WalletType: wallet.wallet_type,
                WalletTypeName: wallet.wallet_type_name,
                Balance: wallet.balance,
                Number: wallet.number,
                IsActive: true,
                UpdatedAt: new Date(),
              },
              $setOnInsert: {
                CreatedAt: new Date(),
              },
            },
            upsert: true,
          },
        })),
      );
      logger.info(`✓ Processed ${wallets.length} wallet records`);
    }

    // 1. Process UserTransaction data
    logger.info("Processing user transactions...");
    const transactionGroups = groupTransactionsByUserWalletCategoryDate(
      transactions,
      wallets,
    );
    const transactionDocs = Array.from(transactionGroups.values());

    if (transactionDocs.length > 0) {
      await userTransactionModel.bulkWrite(
        transactionDocs.map((doc) => ({
          updateOne: {
            filter: {
              UserID: doc.UserID,
              WalletID: doc.WalletID,
              CategoryID: doc.CategoryID,
              Date: doc.Date,
            },
            update: { $set: doc },
            upsert: true,
          },
        })),
      );
      logger.info(
        `✓ Processed ${transactionDocs.length} user transaction records`,
      );
    }

    // 2. Process UserBalance data
    logger.info("Processing user balances...");
    const dailyBalances = calculateDailyBalances(transactions, wallets);
    const balanceDocs = Array.from(dailyBalances.values());

    if (balanceDocs.length > 0) {
      await userBalanceModel.bulkWrite(
        balanceDocs.map((doc) => ({
          updateOne: {
            filter: {
              WalletID: doc.WalletID,
              Date: doc.Date,
            },
            update: { $set: doc },
            upsert: true,
          },
        })),
      );
      logger.info(`✓ Processed ${balanceDocs.length} user balance records`);
    }

    // 3. Process UserFinancialSummaries data
    logger.info("Processing financial summaries...");
    const financialSummaries = calculateFinancialSummaries(
      transactions,
      wallets,
      investments,
    );
    const summaryDocs = Array.from(financialSummaries.values());

    if (summaryDocs.length > 0) {
      await userFinancialSummariesModel.bulkWrite(
        summaryDocs.map((doc) => ({
          updateOne: {
            filter: {
              UserID: doc.UserID,
              PeriodType: doc.PeriodType,
              PeriodKey: doc.PeriodKey,
            },
            update: { $set: doc },
            upsert: true,
          },
        })),
      );
      logger.info(
        `✓ Processed ${summaryDocs.length} financial summary records`,
      );
    }

    // 4. Process UserNetWorthComposition data
    logger.info("Processing net worth compositions...");
    const netWorthCompositions = calculateNetWorthCompositions(
      wallets,
      investments,
    );
    const compositionDocs = Array.from(netWorthCompositions.values());

    if (compositionDocs.length > 0) {
      await userNetWorthCompositionModel.bulkWrite(
        compositionDocs.map((doc) => ({
          updateOne: {
            filter: { UserID: doc.UserID },
            update: { $set: doc },
            upsert: true,
          },
        })),
      );
      logger.info(
        `✓ Processed ${compositionDocs.length} net worth composition records`,
      );
    }

    logger.info("✅ Initial sync completed successfully!");
  } catch (error) {
    logger.error("❌ Initial sync failed:", error);
    throw error;
  }
};
