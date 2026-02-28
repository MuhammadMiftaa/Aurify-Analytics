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
  LogTransactionDeletedFailed,
  LogTransactionDeletedProcessed,
  LogWalletNotFoundSkipped,
  RabbitmqConsumerService,
} from "../../utils/log";

export const handleTransactionDeleted: EventHandler = async (
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
      logger.warn(LogWalletNotFoundSkipped, {
        service: RabbitmqConsumerService,
        wallet_id: transaction.wallet_id,
      });
      return;
    }

    const txDate = new Date(transaction.transaction_date);
    const dateOnly = new Date(txDate.toISOString().split("T")[0]);

    // ─── 1. Remove from UserTransaction ───
    const updatedDoc = (await userTransactionModel
      .findOneAndUpdate(
        {
          UserID: wallet.UserID,
          WalletID: transaction.wallet_id,
          CategoryID: transaction.category_id,
          Date: dateOnly,
        },
        {
          $inc: {
            TotalAmount: -transaction.amount,
            TransactionCount: -1,
          },
          $pull: { Transactions: { ID: transaction.id } },
          $set: { UpdatedAt: new Date() },
        },
        { new: true },
      )
      .lean()) as any;

    if (updatedDoc && updatedDoc.TransactionCount <= 0) {
      await userTransactionModel.deleteOne({ _id: updatedDoc._id });
    }

    // ─── 2. Reverse UserBalance ───
    const isIncome = transaction.category_type === "income";
    const incomeRev = isIncome ? -transaction.amount : 0;
    const expenseRev = isIncome ? 0 : -transaction.amount;
    const netRev = incomeRev - expenseRev;

    const balanceDoc = (await userBalanceModel
      .findOneAndUpdate(
        { WalletID: transaction.wallet_id, Date: dateOnly },
        {
          $inc: {
            TotalIncome: incomeRev,
            TotalExpense: expenseRev,
            NetChange: netRev,
            ClosingBalance: netRev,
            TransactionCount: -1,
          },
          $set: { UpdatedAt: new Date() },
        },
        { new: true },
      )
      .lean()) as any;

    if (balanceDoc && balanceDoc.TransactionCount <= 0) {
      await userBalanceModel.deleteOne({ _id: balanceDoc._id });
    }

    // ─── 3. Recalculate financial summary ───
    await consumerHelper.recalcFinancialSummary(wallet.UserID, txDate);

    logger.info(LogTransactionDeletedProcessed, {
      service: RabbitmqConsumerService,
      transaction_id: transaction.id,
    });
  } catch (error) {
    logger.error(LogTransactionDeletedFailed, {
      service: RabbitmqConsumerService,
      error: (error as Error).message,
    });
    throw error;
  }
};
