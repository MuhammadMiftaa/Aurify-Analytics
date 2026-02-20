import { EventHandler, walletSchema, walletType } from "../../utils/dto";
import helper from "../../utils/helper";
import consumerHelper from "./consumer.helper";
import { userWalletModel } from "../../utils/model";
import logger from "../../utils/logger";

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
    logger.info("Wallet deleted processed", { walletId: wallet.id });
  } catch (error) {
    logger.error("Failed to handle wallet.deleted", { error });
    throw error;
  }
};
