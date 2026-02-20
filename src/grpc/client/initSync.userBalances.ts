import { transactionType, walletType } from "../../utils/dto";
import initSyncHelper from "./initSync.helper";

export function calculateDailyBalances(
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
        Week: initSyncHelper.getWeekNumber(date),
        Day: date.getDate(),
        IsMonthStart: initSyncHelper.isMonthStart(date),
        IsWeekStart: initSyncHelper.isWeekStart(date),
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
