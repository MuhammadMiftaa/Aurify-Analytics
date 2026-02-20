import { transactionType, walletType } from "../../utils/dto";
import initSyncHelper from "./initSync.helper";

export function groupTransactionsByUserWalletCategoryDate(
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
        Week: initSyncHelper.getWeekNumber(txDate),
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
