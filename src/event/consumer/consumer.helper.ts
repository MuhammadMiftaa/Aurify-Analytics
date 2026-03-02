import {
  userBalanceModel,
  userFinancialSummariesModel,
  userInvestmentModel,
  userNetWorthCompositionModel,
  userTransactionModel,
  userWalletModel,
} from "../../utils/model";

//= Recalculate and upsert UserNetWorthComposition for a user
async function recalcNetWorth(userId: string) {
  // Wallet portion
  const wallets = await userWalletModel
    .find({ UserID: userId, IsActive: true })
    .lean();
  const walletTotal = wallets.reduce(
    (sum: number, w: any) => sum + (w.Balance ?? 0),
    0,
  );

  // Investment portion
  const investments = await userInvestmentModel
    .find({ UserID: userId, IsActive: true })
    .lean();
console.log("Investments:", investments);
  let investmentTotal = 0;
  let unrealizedGain = 0;
  const investmentsByAsset = new Map<string, { total: number; gain: number }>();

  investments.forEach((inv: any) => {
    const currentValue = inv.Quantity * inv.ToIDR;
    investmentTotal += currentValue;
    const gain = currentValue - inv.Amount;
    unrealizedGain += gain;

    const label = inv.AssetName || inv.Code;
    if (!investmentsByAsset.has(label)) {
      investmentsByAsset.set(label, { total: 0, gain: 0 });
    }
    const d = investmentsByAsset.get(label)!;
    d.total += currentValue;
    d.gain += gain;
  });

  const total = walletTotal + investmentTotal;
  const slices: any[] = [];

  if (walletTotal > 0) {
    const walletsByType: Record<string, number> = {};
    wallets.forEach((w: any) => {
      const t = w.WalletTypeName || w.WalletType || "Other";
      walletsByType[t] = (walletsByType[t] || 0) + (w.Balance ?? 0);
    });

    slices.push({
      Label: "Cash & Bank Accounts",
      Amount: walletTotal,
      Percentage: total > 0 ? (walletTotal / total) * 100 : 0,
      Details: {
        ItemCount: wallets.length,
        Description: `${wallets.length} wallet(s)`,
        ...walletsByType,
      },
    });
  }
  console.log("Investment Total:", investmentTotal);
  if (investmentTotal > 0) {
    const investmentDetails: Record<string, number> = {};
    investmentsByAsset.forEach((d, label) => {
      investmentDetails[label] = d.total;
    });

    slices.push({
      Label: "Investments",
      Amount: investmentTotal,
      Percentage: total > 0 ? (investmentTotal / total) * 100 : 0,
      Details: {
        ItemCount: investments.length,
        Description: `${investments.length} investment(s)`,
        UnrealizedGain: unrealizedGain,
        ...investmentDetails,
      },
    });
  }

  await userNetWorthCompositionModel.updateOne(
    { UserID: userId },
    {
      $set: { Total: total, Slices: slices, UpdatedAt: new Date() },
      $setOnInsert: { CreatedAt: new Date() },
    },
    { upsert: true },
  );
}

//= Recalculate UserFinancialSummary for a user+month after a transaction event
async function recalcFinancialSummary(userId: string, txDate: Date) {
  const year = txDate.getFullYear();
  const month = txDate.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  // Gather all UserTransaction docs for this user + month
  const txDocs = await userTransactionModel
    .find({ UserID: userId, Year: year, Month: month })
    .lean();

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

  txDocs.forEach((doc: any) => {
    if (doc.CategoryType === "income") {
      incomeNow += doc.TotalAmount;
      incomeTransactionCount += doc.TransactionCount;
      if (doc.TotalAmount > largestIncome) largestIncome = doc.TotalAmount;

      if (!categoryIncome.has(doc.CategoryID)) {
        categoryIncome.set(doc.CategoryID, {
          name: doc.CategoryName,
          amount: 0,
          count: 0,
        });
      }
      const c = categoryIncome.get(doc.CategoryID)!;
      c.amount += doc.TotalAmount;
      c.count += doc.TransactionCount;
    } else {
      expenseNow += doc.TotalAmount;
      expenseTransactionCount += doc.TransactionCount;
      if (doc.TotalAmount > largestExpense) largestExpense = doc.TotalAmount;

      if (!categoryExpense.has(doc.CategoryID)) {
        categoryExpense.set(doc.CategoryID, {
          name: doc.CategoryName,
          amount: 0,
          count: 0,
        });
      }
      const c = categoryExpense.get(doc.CategoryID)!;
      c.amount += doc.TotalAmount;
      c.count += doc.TransactionCount;
    }
  });

  const profitNow = incomeNow - expenseNow;
  const totalTransactions = incomeTransactionCount + expenseTransactionCount;

  // Get wallet balances for this user
  const wallets = await userWalletModel
    .find({ UserID: userId, IsActive: true })
    .lean();
  const balanceNow = wallets.reduce(
    (sum: number, w: any) => sum + (w.Balance ?? 0),
    0,
  );

  // Previous month comparison
  const prevMonthDate = new Date(year, month - 2, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth() + 1;
  const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  const prevSummary = (await userFinancialSummariesModel
    .findOne({
      UserID: userId,
      PeriodType: "monthly",
      PeriodKey: prevMonthKey,
    })
    .lean()) as any;

  const incomePrev = prevSummary?.IncomeNow ?? 0;
  const expensePrev = prevSummary?.ExpenseNow ?? 0;
  const profitPrev = prevSummary?.ProfitNow ?? 0;
  const balancePrev = prevSummary?.BalanceNow ?? balanceNow - profitNow;

  // Growth
  const incomeGrowthPct =
    incomePrev > 0 ? ((incomeNow - incomePrev) / incomePrev) * 100 : 0;
  const expenseGrowthPct =
    expensePrev > 0 ? ((expenseNow - expensePrev) / expensePrev) * 100 : 0;
  const profitGrowthPct =
    profitPrev > 0 ? ((profitNow - profitPrev) / profitPrev) * 100 : 0;
  const balanceGrowthPct =
    balancePrev > 0 ? ((balanceNow - balancePrev) / balancePrev) * 100 : 0;

  // Health indicators
  const savingsRate = incomeNow > 0 ? (profitNow / incomeNow) * 100 : 0;
  const expenseToIncomeRatio =
    incomeNow > 0 ? (expenseNow / incomeNow) * 100 : 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  const burnRateDaily = expenseNow / daysInMonth;
  const avgIncomeDaily = incomeNow / daysInMonth;
  const avgExpenseDaily = expenseNow / daysInMonth;
  const runwayDays =
    burnRateDaily > 0 ? Math.floor(balanceNow / burnRateDaily) : 0;

  // Investment summary from helper collection
  const investments = await userInvestmentModel.find({ UserID: userId }).lean();

  let totalInvested = 0;
  let totalCurrentValuation = 0;
  let totalSoldAmount = 0;
  let totalDeficit = 0;
  let realizedGain = 0;
  let buyCount = 0;
  let sellCount = 0;
  let activePositions = 0;

  investments.forEach((inv: any) => {
    totalInvested += inv.Amount;
    totalCurrentValuation += inv.Quantity * inv.ToIDR;
    totalSoldAmount += inv.TotalSoldAmount;
    totalDeficit += inv.TotalDeficit;
    realizedGain += inv.RealizedGain;
    if (inv.IsActive) activePositions++;
    buyCount++;
    sellCount += inv.TotalSoldQuantity > 0 ? 1 : 0;
  });

  const unrealizedGainInv = totalCurrentValuation - totalInvested;
  const investmentGrowthPct =
    totalInvested > 0 ? (unrealizedGainInv / totalInvested) * 100 : 0;

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
  const walletSummaries = await Promise.all(
    wallets.map(async (w: any) => {
      const balanceDocs = await userBalanceModel
        .find({ WalletID: w.WalletID, Year: year, Month: month })
        .sort({ Date: 1 })
        .lean();

      let walletIncome = 0;
      let walletExpense = 0;
      let openingBalance = w.Balance;
      let closingBalance = w.Balance;

      if (balanceDocs.length > 0) {
        openingBalance = (balanceDocs[0] as any).OpeningBalance;
        closingBalance = (balanceDocs[balanceDocs.length - 1] as any)
          .ClosingBalance;
        balanceDocs.forEach((b: any) => {
          walletIncome += b.TotalIncome;
          walletExpense += b.TotalExpense;
        });
      }

      return {
        WalletID: w.WalletID,
        WalletName: w.WalletName,
        WalletType: w.WalletType,
        OpeningBalance: openingBalance,
        ClosingBalance: closingBalance,
        Income: walletIncome,
        Expense: walletExpense,
        NetChange: walletIncome - walletExpense,
        ShareOfBalancePct: balanceNow > 0 ? (w.Balance / balanceNow) * 100 : 0,
      };
    }),
  );

  const netWorthTotal = balanceNow + totalCurrentValuation;
  const netWorthPrev = balancePrev + totalInvested;

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);

  await userFinancialSummariesModel.updateOne(
    { UserID: userId, PeriodType: "monthly", PeriodKey: monthKey },
    {
      $set: {
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
        TotalTransactions: totalTransactions,
        IncomeTransactionCount: incomeTransactionCount,
        ExpenseTransactionCount: expenseTransactionCount,
        AvgTransactionAmount:
          totalTransactions > 0
            ? (incomeNow + expenseNow) / totalTransactions
            : 0,
        LargestIncome: largestIncome,
        LargestExpense: largestExpense,
        InvestmentSummary: {
          TotalInvested: totalInvested,
          TotalCurrentValuation: totalCurrentValuation,
          TotalSoldAmount: totalSoldAmount,
          TotalDeficit: totalDeficit,
          UnrealizedGain: unrealizedGainInv,
          RealizedGain: realizedGain,
          InvestmentGrowthPct: investmentGrowthPct,
          BuyCount: buyCount,
          SellCount: sellCount,
          ActivePositions: activePositions,
        },
        NetWorth: {
          Total: netWorthTotal,
          WalletPortion: balanceNow,
          InvestmentPortion: totalCurrentValuation,
          NetWorthPrev: netWorthPrev,
          NetWorthGrowthPct:
            netWorthPrev > 0
              ? ((netWorthTotal - netWorthPrev) / netWorthPrev) * 100
              : 0,
        },
        TopExpenseCategories: topExpenseCategories,
        TopIncomeCategories: topIncomeCategories,
        WalletSummaries: walletSummaries,
        UpdatedAt: new Date(),
      },
      $setOnInsert: {
        UserID: userId,
        PeriodType: "monthly",
        PeriodKey: monthKey,
        CreatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export default {
  recalcNetWorth,
  recalcFinancialSummary,
};
