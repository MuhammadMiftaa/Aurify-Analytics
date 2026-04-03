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
import {
  LogTransactionUpdatedFailed,
  LogTransactionUpdatedProcessed,
  LogWalletNotFoundSkipped,
  RabbitmqConsumerService,
} from "../../utils/log";

export const handleTransactionUpdated: EventHandler = async (
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
      logger.error(LogWalletNotFoundSkipped, {
        service: RabbitmqConsumerService,
        wallet_id: transaction.wallet_id,
      });

      throw new Error("Wallet not found");
    }

    const txDate = new Date(transaction.transaction_date);
    const dateOnly = new Date(txDate.toISOString().split("T")[0]);

    // ─── 1. Remove old transaction entry from wherever it is ───
    const oldDoc = (await userTransactionModel
      .findOneAndUpdate(
        {
          UserID: wallet.UserID,
          "Transactions.ID": transaction.id,
        },
        {
          $pull: { Transactions: { ID: transaction.id } },
          $inc: { TransactionCount: -1 },
          $set: { UpdatedAt: new Date() },
        },
        { new: false },
      )
      .lean()) as any;

    if (oldDoc) {
      // If old doc now has 0 transactions → remove it
      if (oldDoc.TransactionCount <= 1) {
        await userTransactionModel.deleteOne({ _id: oldDoc._id });
      }

      // Reverse old balance impact
      const oldDate = new Date(
        new Date(oldDoc.Date).toISOString().split("T")[0],
      );
      const wasIncome = oldDoc.CategoryType === "income";
      // We approximate amount reversal with current amount (same payload for update)
      const oldIncomeRev = wasIncome ? -transaction.amount : 0;
      const oldExpenseRev = wasIncome ? 0 : -transaction.amount;
      const oldNetRev = oldIncomeRev - oldExpenseRev;

      await userBalanceModel.updateOne(
        { WalletID: oldDoc.WalletID, Date: oldDate },
        {
          $inc: {
            TotalIncome: oldIncomeRev,
            TotalExpense: oldExpenseRev,
            NetChange: oldNetRev,
            ClosingBalance: oldNetRev,
            TransactionCount: -1,
          },
          $set: { UpdatedAt: new Date() },
        },
      );
    }

    // ─── 2. Insert updated transaction ───
    const isIncome = transaction.category_type === "income";
    const incomeInc = isIncome ? transaction.amount : 0;
    const expenseInc = isIncome ? 0 : transaction.amount;
    const netChange = incomeInc - expenseInc;

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
            Amount: transaction.amount,
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

    // ─── 3. Update UserBalance for new date ───
    const existing = await userBalanceModel.findOne({
      WalletID: transaction.wallet_id,
      Date: dateOnly,
    });

    if (existing) {
      await userBalanceModel.updateOne(
        { WalletID: transaction.wallet_id, Date: dateOnly },
        {
          $inc: {
            TotalIncome: incomeInc,
            TotalExpense: expenseInc,
            NetChange: netChange,
            ClosingBalance: netChange,
            TransactionCount: 1,
          },
          $set: { UpdatedAt: new Date() },
        },
      );
    } else {
      const openingBalance = wallet.Balance - netChange;
      await userBalanceModel.create({
        WalletID: transaction.wallet_id,
        Date: dateOnly,
        OpeningBalance: openingBalance,
        ClosingBalance: wallet.Balance,
        TotalIncome: incomeInc,
        TotalExpense: expenseInc,
        NetChange: netChange,
        TransactionCount: 1,
        UserID: wallet.UserID,
        // ... field lainnya
        CreatedAt: new Date(),
        UpdatedAt: new Date(),
      });
    }

    // ─── 4. Recalculate financial summary ───
    await consumerHelper.recalcFinancialSummary(wallet.UserID, txDate);

    logger.info(LogTransactionUpdatedProcessed, {
      service: RabbitmqConsumerService,
      transaction_id: transaction.id,
    });
  } catch (error) {
    logger.error(LogTransactionUpdatedFailed, {
      service: RabbitmqConsumerService,
      error: (error as Error).message,
    });
    throw error;
  }
};
