import { investmentType, transactionType, walletType } from "../../utils/dto";

export function calculateFinancialSummaries(
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
