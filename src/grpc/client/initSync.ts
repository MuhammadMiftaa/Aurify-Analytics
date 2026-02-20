import { investmentType, transactionType, walletType } from "../../utils/dto";
import {
  userBalanceModel,
  userFinancialSummariesModel,
  userInvestmentModel,
  userNetWorthCompositionModel,
  userTransactionModel,
  userWalletModel,
} from "../../utils/model";
import logger from "../../utils/logger";
import { groupTransactionsByUserWalletCategoryDate } from "./initSync.userTransactions";
import { calculateDailyBalances } from "./initSync.userBalances";
import { calculateFinancialSummaries } from "./initSync.UserFinancialSummaries";
import { calculateNetWorthCompositions } from "./initSync.UserNetWorthComposition";

export const initialSync = async (
  wallets: walletType[],
  transactions: transactionType[],
  investments: investmentType[],
) => {
  logger.info("Starting initial sync process...");

  try {
    // Process UserWallet data (helper collection)
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

    // Process UserInvestment helper data
    logger.info("Processing user investments helper...");
    if (investments.length > 0) {
      await userInvestmentModel.bulkWrite(
        investments.map((inv) => ({
          updateOne: {
            filter: { InvestmentID: inv.id },
            update: {
              $set: {
                InvestmentID: inv.id,
                UserID: inv.userId,
                Code: inv.code,
                AssetName: inv.assetCode.name,
                AssetUnit: inv.assetCode.unit,
                Quantity: inv.quantity,
                InitialQuantity: inv.quantity,
                Amount: inv.amount,
                InitialValuation: inv.initialValuation,
                AvgBuyPrice: inv.quantity > 0 ? inv.amount / inv.quantity : 0,
                ToIDR: inv.assetCode.toIDR,
                ToUSD: inv.assetCode.toUSD,
                ToEUR: inv.assetCode.toEUR,
                TotalSoldQuantity: 0,
                TotalSoldAmount: 0,
                TotalDeficit: 0,
                RealizedGain: 0,
                Date: inv.date,
                Description: inv.description,
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
      logger.info(`✓ Processed ${investments.length} investment records`);
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
