import { NextFunction, Request, Response } from "express";
import {
  getUserBalanceType,
  getUserFinancialSummaryType,
  getUserNetWorthCompositionType,
  getUserTransactionType,
  investmentType,
  transactionType,
  walletType,
} from "./utils/dto";
import service from "./service";
import env from "./utils/env";
import { ForbiddenError } from "./utils/errors";
import logger from "./utils/logger";
import {
  AnalyticsService,
  LogGetUserTransactionFailed,
  LogGetUserBalanceFailed,
  LogGetUserFinancialSummaryFailed,
  LogGetUserNetWorthCompositionFailed,
  LogInitialSyncCompleted,
  LogInitialSyncFailed,
  LogInitialSyncForbidden,
  REQUEST_ID_LOCAL_KEY,
} from "./utils/log";

const getUserTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestID = req.requestID;

  try {
    const data: getUserTransactionType = req.body;
    const userTransaction = await service.getUserTransaction(data);
    // Read-only — no success log needed; middleware access log is sufficient
    res.json(userTransaction);
  } catch (error: any) {
    logger.error(LogGetUserTransactionFailed, {
      service: AnalyticsService,
      request_id: requestID,
      user_id: req.user?.id,
      error: error.message,
    });
    next(error);
  }
};

const getUserBalance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestID = req.requestID;

  try {
    const data: getUserBalanceType = req.body;
    const userBalance = await service.getUserBalance(data);
    // Read-only — no success log needed; middleware access log is sufficient
    res.json(userBalance);
  } catch (error: any) {
    logger.error(LogGetUserBalanceFailed, {
      service: AnalyticsService,
      request_id: requestID,
      user_id: req.user?.id,
      error: error.message,
    });
    next(error);
  }
};

const getUserFinancialSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestID = req.requestID;

  try {
    const data: getUserFinancialSummaryType = req.body;
    const userFinancialSummary = await service.getUserFinancialSummary(data);
    // Read-only — no success log needed; middleware access log is sufficient
    res.json(userFinancialSummary);
  } catch (error: any) {
    logger.error(LogGetUserFinancialSummaryFailed, {
      service: AnalyticsService,
      request_id: requestID,
      user_id: req.user?.id,
      error: error.message,
    });
    next(error);
  }
};

const getUserNetWorthComposition = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestID = req.requestID;

  try {
    const data: getUserNetWorthCompositionType = req.body;
    const userNetWorthComposition =
      await service.getUserNetWorthComposition(data);
    // Read-only — no success log needed; middleware access log is sufficient
    res.json(userNetWorthComposition);
  } catch (error: any) {
    logger.error(LogGetUserNetWorthCompositionFailed, {
      service: AnalyticsService,
      request_id: requestID,
      user_id: req.user?.id,
      error: error.message,
    });
    next(error);
  }
};

const initialSyncHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestID = req.requestID;

  try {
    const secretKey = req.body.secretKey;
    if (secretKey !== env.INITIAL_SYNC_KEY) {
      logger.warn(LogInitialSyncForbidden, {
        service: AnalyticsService,
        request_id: requestID,
      });
      throw new ForbiddenError("Invalid secret key");
    }

    const wallets =
      (await req.app.locals.walletGRPCClient.getWallets()) as Promise<
        walletType[]
      >;
    const transactions =
      (await req.app.locals.transactionGRPCClient.getTransactions()) as Promise<
        transactionType[]
      >;
    const investments =
      (await req.app.locals.investmentGRPCClient.getInvestments()) as Promise<
        investmentType[]
      >;

    logger.info(LogInitialSyncCompleted, {
      service: AnalyticsService,
      request_id: requestID,
    });

    res.json({ wallets, transactions, investments });
  } catch (error: any) {
    if (!error.isOperational) {
      logger.error(LogInitialSyncFailed, {
        service: AnalyticsService,
        request_id: requestID,
        error: error.message,
      });
    }
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
