import { EventHandler, walletSchema, walletType } from "../../utils/dto";
import helper from "../../utils/helper";
import consumerHelper from "./consumer.helper";
import { userWalletModel } from "../../utils/model";
import logger from "../../utils/logger";
import {
  LogWalletDeletedFailed,
  LogWalletDeletedProcessed,
  RabbitmqConsumerService,
} from "../../utils/log";

export const handleWalletDeleted: EventHandler = async (
  _routingKey: string,
  payload: unknown,
) => {
  try {
    const wallet = helper.validate<walletType>(walletSchema, payload);

    await userWalletModel.updateOne(
      { WalletID: wallet.id },
      { $set: { IsActive: false, Balance: 0, UpdatedAt: new Date() } },
    );

    await consumerHelper.recalcNetWorth(wallet.user_id);
    logger.info(LogWalletDeletedProcessed, {
      service: RabbitmqConsumerService,
      wallet_id: wallet.id,
      user_id: wallet.user_id,
    });
  } catch (error) {
    logger.error(LogWalletDeletedFailed, {
      service: RabbitmqConsumerService,
      error: (error as Error).message,
    });
    throw error;
  }
};
