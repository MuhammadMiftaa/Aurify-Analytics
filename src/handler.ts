import { NextFunction, Request, Response } from "express";
import {
  getUserBalanceType,
  getUserFinancialSummaryType,
  getUserNetWorthCompositionType,
  getUserTransactionType,
  investmentType,
  transactionType,
  walletType,
} from "./dto";
import service from "./service";
import { successResponse } from "./response";
import env from "./env";
import { ForbiddenError, NotFoundError } from "./errors";
import logger from "./logger";
import { initialSync } from "./initial-sync";

const getUserTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data: getUserTransactionType = req.body;
    const result = await service.getUserTransaction(data);

    res
      .status(200)
      .json(
        successResponse(
          200,
          "User transactions retrieved successfully",
          result,
        ),
      );
  } catch (error) {
    next(error);
  }
};

const getUserBalance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data: getUserBalanceType = req.body;
    const result = await service.getUserBalance(data);

    res
      .status(200)
      .json(
        successResponse(200, "User balance retrieved successfully", result),
      );
  } catch (error) {
    next(error);
  }
};

const getUserFinancialSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data: getUserFinancialSummaryType = req.body;
    const result = await service.getUserFinancialSummary(data);

    res
      .status(200)
      .json(
        successResponse(
          200,
          "User financial summary retrieved successfully",
          result,
        ),
      );
  } catch (error) {
    next(error);
  }
};

const getUserNetWorthComposition = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data: getUserNetWorthCompositionType = req.body;
    const result = await service.getUserNetWorthComposition(data);

    if (!result) {
      throw new NotFoundError("No net worth data found for user");
    }

    res
      .status(200)
      .json(
        successResponse(
          200,
          "User net worth composition retrieved successfully",
          result,
        ),
      );
  } catch (error) {
    next(error);
  }
};

const initialSyncHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const secretKey = req.body.secretKey;
    if (secretKey !== env.INITIAL_SYNC_KEY) {
      throw new ForbiddenError("Invalid secret key");
    }

    logger.info("Starting initial sync - fetching data from gRPC services...");

    // Fetch data from gRPC services
    const wallets =
      (await req.app.locals.walletGRPCClient.getWallets()) as walletType[];
    const transactions =
      (await req.app.locals.transactionGRPCClient.getTransactions()) as transactionType[];
    const investments =
      (await req.app.locals.investmentGRPCClient.getInvestments()) as investmentType[];

    logger.info(
      `Fetched data: ${wallets.length} wallets, ${transactions.length} transactions, ${investments.length} investments`,
    );

    // Process and sync data to MongoDB
    const result = await initialSync(wallets, transactions, investments);

    res
      .status(200)
      .json(successResponse(200, "Initial sync completed successfully"));
  } catch (error) {
    logger.error("Initial sync failed:", error);
    next(error);
  }
};

export default {
  getUserTransaction,
  getUserBalance,
  getUserFinancialSummary,
  getUserNetWorthComposition,
  initialSyncHandler,
};
