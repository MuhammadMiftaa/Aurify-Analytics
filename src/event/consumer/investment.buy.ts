import {
  EventHandler,
  investmentBuySchema,
  investmentBuyType,
} from "../../utils/dto";
import helper from "../../utils/helper";
import consumerHelper from "./consumer.helper";
import logger from "../../utils/logger";
import { userInvestmentModel } from "../../utils/model";
import {
  LogInvestmentBuyFailed,
  LogInvestmentBuyProcessed,
  RabbitmqConsumerService,
} from "../../utils/log";

export const handleInvestmentBuy: EventHandler = async (
  _routingKey: string,
  payload: unknown,
) => {
  try {
    const investment = helper.validate<investmentBuyType>(
      investmentBuySchema,
      payload,
    );

    // ─── 1. Upsert into UserInvestment helper ───
    await userInvestmentModel.updateOne(
      { InvestmentID: investment.id },
      {
        $set: {
          UserID: investment.userId,
          Code: investment.code,
          AssetName: investment.assetCode.name,
          AssetUnit: investment.assetCode.unit,
          Quantity: investment.quantity,
          InitialQuantity: investment.quantity,
          Amount: investment.amount,
          InitialValuation: investment.initialValuation,
          AvgBuyPrice:
            investment.quantity > 0
              ? investment.amount / investment.quantity
              : 0,
          ToIDR: investment.assetCode.toIDR,
          ToUSD: investment.assetCode.toUSD,
          ToEUR: investment.assetCode.toEUR,
          TotalSoldQuantity: 0,
          TotalSoldAmount: 0,
          TotalDeficit: 0,
          RealizedGain: 0,
          Date: investment.date,
          Description: investment.description,
          IsActive: true,
          UpdatedAt: new Date(),
        },
        $setOnInsert: { CreatedAt: new Date() },
      },
      { upsert: true },
    );

    // ─── 2. Recalculate net worth ───
    await consumerHelper.recalcNetWorth(investment.userId);

    // ─── 3. Recalculate financial summary ───
    await consumerHelper.recalcFinancialSummary(
      investment.userId,
      new Date(investment.date),
    );

    logger.info(LogInvestmentBuyProcessed, {
      service: RabbitmqConsumerService,
      investment_id: investment.id,
      user_id: investment.userId,
    });
  } catch (error) {
    logger.error(LogInvestmentBuyFailed, {
      service: RabbitmqConsumerService,
      error: (error as Error).message,
    });
    throw error;
  }
};
