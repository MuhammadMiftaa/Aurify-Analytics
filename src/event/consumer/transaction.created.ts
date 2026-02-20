import {
  EventHandler,
  transactionSchema,
  transactionType,
} from "../../utils/dto";
import helper from "../../utils/helper";
import consumerHelper from "./consumer.helper";
import logger from "../../utils/logger";
import {
  userBalanceModel,
  userTransactionModel,
  userWalletModel,
} from "../../utils/model";

export const handleTransactionCreated: EventHandler = async (
  _routingKey: string,
  payload: unknown,
) => {
  try {
    const transaction = helper.validate<transactionType>(
      transactionSchema,
      payload,
    );

    const wallet = (await userWalletModel
      .findOne({ WalletID: transaction.wallet_id })
      .lean()) as any;
    if (!wallet) {
      logger.warn("Wallet not found, skipping transaction", {
        walletId: transaction.wallet_id,
      });
      return;
    }

    const txDate = new Date(transaction.transaction_date);
    const dateOnly = new Date(txDate.toISOString().split("T")[0]);

    // ─── 1. UserTransaction ───
    await userTransactionModel.updateOne(
      {
        UserID: wallet.UserID,
        WalletID: transaction.wallet_id,
        CategoryID: transaction.category_id,
        Date: dateOnly,
      },
      {
        $inc: {
          TotalAmount: transaction.amount,
          TransactionCount: 1,
        },
        $push: {
          Transactions: {
            ID: transaction.id,
            Description: transaction.description,
            Date: txDate,
          },
        },
        $set: {
          WalletName: wallet.WalletName,
          WalletType: wallet.WalletType,
          CategoryName: transaction.category_name,
          CategoryType: transaction.category_type,
          Year: txDate.getFullYear(),
          Month: txDate.getMonth() + 1,
          Week: helper.getWeekNumber(txDate),
          Day: txDate.getDate(),
          UpdatedAt: new Date(),
        },
        $setOnInsert: {
          UserID: wallet.UserID,
          WalletID: transaction.wallet_id,
          CategoryID: transaction.category_id,
          Date: dateOnly,
          CreatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    // ─── 2. UserBalance ───
    const isIncome = transaction.category_type === "income";
    const incomeInc = isIncome ? transaction.amount : 0;
    const expenseInc = isIncome ? 0 : transaction.amount;
    const netChange = incomeInc - expenseInc;

    const existingBalance = (await userBalanceModel
      .findOne({ WalletID: transaction.wallet_id, Date: dateOnly })
      .lean()) as any;

    if (existingBalance) {
      await userBalanceModel.updateOne(
        { WalletID: transaction.wallet_id, Date: dateOnly },
        {
          $inc: {
            TotalIncome: incomeInc,
            TotalExpense: expenseInc,
            NetChange: netChange,
            ClosingBalance: netChange,
            TransactionCount: 1,
            CumulativeIncome: incomeInc,
            CumulativeExpense: expenseInc,
          },
          $set: { UpdatedAt: new Date() },
        },
      );
    } else {
      const prevBalance = (await userBalanceModel
        .findOne({
          WalletID: transaction.wallet_id,
          Date: { $lt: dateOnly },
        })
        .sort({ Date: -1 })
        .lean()) as any;

      const openingBalance = prevBalance
        ? prevBalance.ClosingBalance
        : wallet.Balance - netChange;

      await userBalanceModel.updateOne(
        { WalletID: transaction.wallet_id, Date: dateOnly },
        {
          $set: {
            UserID: wallet.UserID,
            WalletID: transaction.wallet_id,
            WalletName: wallet.WalletName,
            Date: dateOnly,
            Year: txDate.getFullYear(),
            Month: txDate.getMonth() + 1,
            Week: helper.getWeekNumber(txDate),
            Day: txDate.getDate(),
            IsMonthStart: txDate.getDate() === 1,
            IsWeekStart: txDate.getDay() === 1,
            OpeningBalance: openingBalance,
            ClosingBalance: openingBalance + netChange,
            TotalIncome: incomeInc,
            TotalExpense: expenseInc,
            NetChange: netChange,
            TransactionCount: 1,
            CumulativeIncome: (prevBalance?.CumulativeIncome ?? 0) + incomeInc,
            CumulativeExpense:
              (prevBalance?.CumulativeExpense ?? 0) + expenseInc,
            UpdatedAt: new Date(),
          },
          $setOnInsert: { CreatedAt: new Date() },
        },
        { upsert: true },
      );
    }

    // ─── 3. UserFinancialSummary ───
    await consumerHelper.recalcFinancialSummary(wallet.UserID, txDate);

    logger.info("Transaction created processed", {
      transactionId: transaction.id,
    });
  } catch (error) {
    logger.error("Failed to handle transaction.created", { error });
    throw error;
  }
};
