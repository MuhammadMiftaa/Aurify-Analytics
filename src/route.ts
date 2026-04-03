import { Router } from "express";
import handler from "./handler";
import middleware from "./middleware";
import {
  getUserBalanceSchema,
  getUserTransactionSchema,
  getUserFinancialSummarySchema,
  getUserNetWorthCompositionSchema,
  getCategoryTransactionsSchema,
} from "./utils/dto";

const router = Router();

router.post(
  "/user-transactions",
  middleware.validate(getUserTransactionSchema),
  handler.getUserTransaction,
);
router.post(
  "/user-balance",
  middleware.validate(getUserBalanceSchema),
  handler.getUserBalance,
);
router.post(
  "/user-financial-summary",
  middleware.validate(getUserFinancialSummarySchema),
  handler.getUserFinancialSummary,
);
router.post(
  "/user-net-worth-composition",
  middleware.validate(getUserNetWorthCompositionSchema),
  handler.getUserNetWorthComposition,
);
router.post(
  "/category-transactions",
  middleware.validate(getCategoryTransactionsSchema),
  handler.getCategoryTransactions,
);

export default router;
