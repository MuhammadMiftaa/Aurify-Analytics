import { EventHandler, walletSchema, walletType } from "../../utils/dto";
import helper from "../../utils/helper";
import consumerHelper from "./consumer.helper";
import { userWalletModel } from "../../utils/model";
import logger from "../../utils/logger";

export const handleWalletUpdated: EventHandler = async (
  _routingKey: string,
  payload: unknown,
) => {
  try {
    const wallet = helper.validate<walletType>(walletSchema, payload);

    await userWalletModel.updateOne(
      { WalletID: wallet.id },
      {
        $set: {
          UserID: wallet.user_id,
          WalletName: wallet.name,
          WalletType: wallet.wallet_type,
          WalletTypeName: wallet.wallet_type_name,
          Balance: wallet.balance,
          IsActive: true,
          UpdatedAt: new Date(),
        },
        $setOnInsert: { CreatedAt: new Date() },
      },
      { upsert: true },
    );

    await consumerHelper.recalcNetWorth(wallet.user_id);
    logger.info("Wallet updated processed", { walletId: wallet.id });
  } catch (error) {
    logger.error("Failed to handle wallet.updated", { error });
    throw error;
  }
};
