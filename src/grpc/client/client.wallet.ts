// wallet.ts
import walletPbModule from "@muhammadmiftaa/refina-protobuf/wallet/wallet_pb.js";
import { walletType } from "../../utils/dto.js";
import logger from "../../utils/logger.js";
import { GRPCClient } from "./client.js";

const wpb = (walletPbModule as any).proto?.wallet || walletPbModule;

export class WalletGRPCClient {
  private client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  getWallets(): Promise<walletType[]> {
    return new Promise((resolve, reject) => {
      const request = new wpb.GetWalletOptions();
      request.setLimit(9999);

      const wallets: walletType[] = [];
      const call = this.client.getWalletClient().getWallets(request);

      call.on("data", (response) => {
        if (response) {
          wallets.push({
            id: response.getId(),
            user_id: response.getUserId(),
            name: response.getName(),
            number: response.getNumber(),
            balance: response.getBalance(),
            wallet_type_id: response.getWalletTypeId(),
            wallet_type: response.getWalletType(),
            wallet_type_name: response.getWalletTypeName(),
            created_at: response.getCreatedAt(),
            updated_at: response.getUpdatedAt(),
          });
        }
      });

      call.on("end", () => {
        logger.info("Fetch Wallet Stream Completed:", wallets);
        resolve(wallets);
      });

      call.on("error", (error) => {
        logger.error("Fetch Wallet Stream Error:", error);
        reject(error);
      });
    });
  }

  getUserWallets(userID: string): Promise<walletType[]> {
    return new Promise((resolve, reject) => {
      const request = new wpb.UserID();
      request.setId(userID);

      const wallets: walletType[] = [];
      const call = this.client.getWalletClient().getUserWallets(request);

      call.on("data", (response) => {
        if (response) {
          wallets.push({
            id: response.getId(),
            user_id: response.getUserId(),
            name: response.getName(),
            number: response.getNumber(),
            balance: response.getBalance(),
            wallet_type_id: response.getWalletTypeId(),
            wallet_type: response.getWalletType(),
            wallet_type_name: response.getWalletTypeName(),
            created_at: response.getCreatedAt(),
            updated_at: response.getUpdatedAt(),
          });
        }
      });

      call.on("end", () => {
        logger.info("Fetch Wallet Stream Completed:", wallets);
        resolve(wallets);
      });

      call.on("error", (error) => {
        logger.error("Fetch Wallet Stream Error:", error);
        reject(error);
      });
    });
  }
}
