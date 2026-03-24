import { investmentType, transactionType, walletType } from "../../utils/dto";

// ─── Helper types ────────────────────────────────────────────

interface CategoryAccumulator {
  name: string;
  amount: number;
  count: number;
}

interface MonthMetrics {
  incomeNow: number;
  expenseNow: number;
  incomeTransactionCount: number;
  expenseTransactionCount: number;
  largestIncome: number;
  largestExpense: number;
  categoryExpense: Map<string, CategoryAccumulator>;
  categoryIncome: Map<string, CategoryAccumulator>;
}

// ─── Helper: accumulate transaction metrics for one month ────

function accumulateMonthMetrics(txList: transactionType[]): MonthMetrics {
  let incomeNow = 0;
  let expenseNow = 0;
  let incomeTransactionCount = 0;
  let expenseTransactionCount = 0;
  let largestIncome = 0;
  let largestExpense = 0;

  const categoryExpense = new Map<string, CategoryAccumulator>();
  const categoryIncome = new Map<string, CategoryAccumulator>();

  for (const tx of txList) {
    if (tx.category_type === "income") {
      incomeNow += tx.amount;
      incomeTransactionCount++;
      if (tx.amount > largestIncome) largestIncome = tx.amount;
      accumCategory(categoryIncome, tx.category_id, tx.category_name, tx.amount);
    } else {
      expenseNow += tx.amount;
      expenseTransactionCount++;
      if (tx.amount > largestExpense) largestExpense = tx.amount;
      accumCategory(categoryExpense, tx.category_id, tx.category_name, tx.amount);
    }
  }

  return {
    incomeNow,
    expenseNow,
    incomeTransactionCount,
    expenseTransactionCount,
    largestIncome,
    largestExpense,
    categoryExpense,
    categoryIncome,
  };
}

function accumCategory(
  map: Map<string, CategoryAccumulator>,
  id: string,
  name: string,
  amount: number,
): void {
  if (!map.has(id)) {
    map.set(id, { name, amount: 0, count: 0 });
  }
  const cat = map.get(id)!;
  cat.amount += amount;
  cat.count++;
}

// ─── Helper: build top-5 category list ──────────────────────

function buildTopCategories(
  map: Map<string, CategoryAccumulator>,
  total: number,
): object[] {
  return Array.from(map.entries())
    .map(([id, data]) => ({
      CategoryID: id,
      CategoryName: data.name,
      Amount: data.amount,
      Percentage: total > 0 ? (data.amount / total) * 100 : 0,
      TransactionCount: data.count,
    }))
    .sort((a, b) => b.Amount - a.Amount)
    .slice(0, 5);
}

// ─── Helper: build wallet summaries for one month ───────────

function buildWalletSummaries(
  userWallets: walletType[],
  txList: transactionType[],
  balanceNow: number,
): object[] {
  // S2004 fix: extracted from deep nesting — this is now at nesting level 1
  return userWallets.map((wallet) => {
    const walletTxs = txList.filter((tx) => tx.wallet_id === wallet.id);
    let walletIncome = 0;
    let walletExpense = 0;

    for (const tx of walletTxs) {
      if (tx.category_type === "income") {
        walletIncome += tx.amount;
      } else {
        walletExpense += tx.amount;
      }
    }

    return {
      WalletID: wallet.id,
      WalletName: wallet.name,
      WalletType: wallet.wallet_type,
      OpeningBalance: wallet.balance - (walletIncome - walletExpense),
      ClosingBalance: wallet.balance,
      Income: walletIncome,
      Expense: walletExpense,
      NetChange: walletIncome - walletExpense,
      ShareOfBalancePct: balanceNow > 0 ? (wallet.balance / balanceNow) * 100 : 0,
    };
  });
}

// ─── Helper: compute investment summary for one user ────────

function computeInvestmentSummary(
  userInvestments: investmentType[],
): {
  totalInvested: number;
  totalCurrentValuation: number;
  unrealizedGain: number;
  investmentGrowthPct: number;
  buyCount: number;
  sellCount: number;
} {
  let totalInvested = 0;
  let totalCurrentValuation = 0;
  let buyCount = 0;
  let sellCount = 0;

  for (const inv of userInvestments) {
    totalInvested += inv.amount;
    totalCurrentValuation += inv.quantity * (inv.assetCode.toIDR ?? 0);
    if (inv.amount > 0) {
      buyCount++;
    } else {
      sellCount++;
    }
  }

  const unrealizedGain = totalCurrentValuation - totalInvested;
  const investmentGrowthPct =
    totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalCurrentValuation,
    unrealizedGain,
    investmentGrowthPct,
    buyCount,
    sellCount,
  };
}

// ─── Main export ─────────────────────────────────────────────

export function calculateFinancialSummaries(
  transactions: transactionType[],
  wallets: walletType[],
  investments: investmentType[],
): Map<string, any> {
  const summaries = new Map<string, any>();

  // Build lookup maps
  const walletMap = new Map<string, walletType>();
  wallets.forEach((w) => walletMap.set(w.id, w));

  // Group by user → month
  const userMonthData = new Map<
    string,
    Map<string, { transactions: transactionType[]; wallets: Set<string> }>
  >();

  for (const tx of transactions) {
    const wallet = walletMap.get(tx.wallet_id);
    if (!wallet) continue;

    const txDate = new Date(tx.transaction_date);
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;

    if (!userMonthData.has(wallet.user_id)) {
      userMonthData.set(wallet.user_id, new Map());
    }
    const userMonths = userMonthData.get(wallet.user_id)!;

    if (!userMonths.has(monthKey)) {
      userMonths.set(monthKey, { transactions: [], wallets: new Set() });
    }
    const monthData = userMonths.get(monthKey)!;
    monthData.transactions.push(tx);
    monthData.wallets.add(tx.wallet_id);
  }

  // Calculate summaries for each user-month
  userMonthData.forEach((monthsMap, userId) => {
    // S2871 fix: localeCompare-based sort for reliable alphabetical ordering
    const sortedMonths = Array.from(monthsMap.keys()).sort((a, b) =>
      a.localeCompare(b),
    );

    sortedMonths.forEach((monthKey, index) => {
      const monthData = monthsMap.get(monthKey)!;
      const [year, month] = monthKey.split("-").map(Number);

      // ── Current period metrics ───────────────────────────
      const metrics = accumulateMonthMetrics(monthData.transactions);
      const {
        incomeNow,
        expenseNow,
        incomeTransactionCount,
        expenseTransactionCount,
        largestIncome,
        largestExpense,
        categoryExpense,
        categoryIncome,
      } = metrics;

      const profitNow = incomeNow - expenseNow;

      // Balance from wallets used this month
      const userWallets = wallets.filter((w) => monthData.wallets.has(w.id));
      const balanceNow = userWallets.reduce((sum, w) => sum + w.balance, 0);

      // ── Previous month comparison ────────────────────────
      let incomePrev = 0;
      let expensePrev = 0;
      let profitPrev = 0;
      let balancePrev = 0;

      if (index > 0) {
        const prevMonthKey = sortedMonths[index - 1];
        const prevMonthData = monthsMap.get(prevMonthKey);
        if (prevMonthData) {
          const prevMetrics = accumulateMonthMetrics(prevMonthData.transactions);
          incomePrev = prevMetrics.incomeNow;
          expensePrev = prevMetrics.expenseNow;
          profitPrev = incomePrev - expensePrev;
          balancePrev = balanceNow - profitNow + profitPrev;
        }
      }

      // ── Growth percentages ───────────────────────────────
      const incomeGrowthPct =
        incomePrev > 0 ? ((incomeNow - incomePrev) / incomePrev) * 100 : 0;
      const expenseGrowthPct =
        expensePrev > 0 ? ((expenseNow - expensePrev) / expensePrev) * 100 : 0;
      const profitGrowthPct =
        profitPrev > 0 ? ((profitNow - profitPrev) / profitPrev) * 100 : 0;
      const balanceGrowthPct =
        balancePrev > 0 ? ((balanceNow - balancePrev) / balancePrev) * 100 : 0;

      // ── Health indicators ────────────────────────────────
      const savingsRate = incomeNow > 0 ? (profitNow / incomeNow) * 100 : 0;
      const expenseToIncomeRatio =
        incomeNow > 0 ? (expenseNow / incomeNow) * 100 : 0;
      const daysInMonth = new Date(year, month, 0).getDate();
      const burnRateDaily = expenseNow / daysInMonth;
      const avgIncomeDaily = incomeNow / daysInMonth;
      const avgExpenseDaily = expenseNow / daysInMonth;
      const runwayDays =
        burnRateDaily > 0 ? Math.floor(balanceNow / burnRateDaily) : 0;

      // ── Investment summary ───────────────────────────────
      const userInvestments = investments.filter((inv) => inv.userId === userId);
      const invSummary = computeInvestmentSummary(userInvestments);

      // ── Top categories ───────────────────────────────────
      const topExpenseCategories = buildTopCategories(categoryExpense, expenseNow);
      const topIncomeCategories = buildTopCategories(categoryIncome, incomeNow);

      // ── Wallet summaries ─────────────────────────────────
      // S2004 fix: extracted to standalone helper (no longer nested >4 deep)
      const walletSummaries = buildWalletSummaries(
        userWallets,
        monthData.transactions,
        balanceNow,
      );

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
          TotalInvested: invSummary.totalInvested,
          TotalCurrentValuation: invSummary.totalCurrentValuation,
          TotalSoldAmount: 0,
          TotalDeficit: 0,
          UnrealizedGain: invSummary.unrealizedGain,
          RealizedGain: 0,
          InvestmentGrowthPct: invSummary.investmentGrowthPct,
          BuyCount: invSummary.buyCount,
          SellCount: invSummary.sellCount,
          ActivePositions: userInvestments.length,
        },
        NetWorth: {
          Total: balanceNow + invSummary.totalCurrentValuation,
          WalletPortion: balanceNow,
          InvestmentPortion: invSummary.totalCurrentValuation,
          NetWorthPrev: balancePrev + invSummary.totalInvested,
          NetWorthGrowthPct:
            balancePrev + invSummary.totalInvested > 0
              ? ((balanceNow +
                  invSummary.totalCurrentValuation -
                  (balancePrev + invSummary.totalInvested)) /
                  (balancePrev + invSummary.totalInvested)) *
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