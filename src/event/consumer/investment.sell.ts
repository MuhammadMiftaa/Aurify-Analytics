import {
  EventHandler,
  investmentSellSchema,
  investmentSellType,
} from "../../utils/dto";
import helper from "../../utils/helper";
import consumerHelper from "./consumer.helper";
import logger from "../../utils/logger";
import { userInvestmentModel } from "../../utils/model";
import {
  LogInvestmentSellBuyPositionNotFound,
  LogInvestmentSellFailed,
  LogInvestmentSellItemProcessed,
  LogInvestmentSellPayloadEmpty,
  LogInvestmentSellProcessed,
  RabbitmqConsumerService,
} from "../../utils/log";

export const handleInvestmentSell: EventHandler = async (
  _routingKey: string,
  payload: unknown,
) => {
  try {
    // Validate as array of sell items (batch FIFO sell)
    const sellItems = helper.validate<investmentSellType>(
      investmentSellSchema,
      payload,
    );

    logger.info(LogInvestmentSellProcessed, {
      service: RabbitmqConsumerService,
      item_count: sellItems.length,
    });

    if (sellItems.length === 0) {
      logger.warn(LogInvestmentSellPayloadEmpty, {
        service: RabbitmqConsumerService,
      });
      return;
    }

    // All items in a batch belong to the same user
    const userId = sellItems[0].userId;
    let latestDate = new Date(sellItems[0].date);

    // ─── Process each sell item (one per buy position, FIFO order) ───
    for (const sell of sellItems) {
      const buyPosition = (await userInvestmentModel
        .findOne({ InvestmentID: sell.investmentId })
        .lean()) as any;

      if (!buyPosition) {
        logger.warn(LogInvestmentSellBuyPositionNotFound, {
          service: RabbitmqConsumerService,
          sell_id: sell.id,
          investment_id: sell.investmentId,
        });
        continue;
      }

      const remainingQuantity = buyPosition.Quantity - sell.quantity;
      const isFullySold = remainingQuantity <= 0;

      // Realized gain: sellAmount - (avgBuyPrice * soldQuantity)
      const costBasis = buyPosition.AvgBuyPrice * sell.quantity;
      const realizedGain = sell.amount - costBasis;

      // Update exchange rates if provided (non-null)
      const rateUpdate: Record<string, number> = {};
      if (sell.assetCode.toIDR != null)
        rateUpdate.ToIDR = sell.assetCode.toIDR;
      if (sell.assetCode.toUSD != null)
        rateUpdate.ToUSD = sell.assetCode.toUSD;
      if (sell.assetCode.toEUR != null)
        rateUpdate.ToEUR = sell.assetCode.toEUR;

      await userInvestmentModel.updateOne(
        { InvestmentID: sell.investmentId },
        {
          $set: {
            Quantity: Math.max(remainingQuantity, 0),
            IsActive: !isFullySold,
            UpdatedAt: new Date(),
            ...rateUpdate,
          },
          $inc: {
            TotalSoldQuantity: sell.quantity,
            TotalSoldAmount: sell.amount,
            TotalDeficit: sell.deficit,
            RealizedGain: realizedGain,
          },
        },
      );

      // Track the latest sell date for financial summary recalc
      const sellDate = new Date(sell.date);
      if (sellDate > latestDate) latestDate = sellDate;

      logger.info(LogInvestmentSellItemProcessed, {
        service: RabbitmqConsumerService,
        sell_id: sell.id,
        investment_id: sell.investmentId,
        sold_quantity: sell.quantity,
        remaining_quantity: Math.max(remainingQuantity, 0),
        is_fully_sold: isFullySold,
      });
    }

    // ─── Recalculate once after all items are processed ───
    await consumerHelper.recalcNetWorth(userId);
    await consumerHelper.recalcFinancialSummary(userId, latestDate);

    logger.info(LogInvestmentSellProcessed, {
      service: RabbitmqConsumerService,
      user_id: userId,
      item_count: sellItems.length,
    });
  } catch (error) {
    logger.error(LogInvestmentSellFailed, {
      service: RabbitmqConsumerService,
      error: (error as Error).message,
    });
    throw error;
  }
};
