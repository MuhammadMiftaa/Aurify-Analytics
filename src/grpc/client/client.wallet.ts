// wallet.ts
import walletPbModule from "@muhammadmiftaa/refina-protobuf/wallet/wallet_pb.js";
import { walletType } from "../../utils/dto.js";
import logger from "../../utils/logger.js";
import { GRPCClient } from "./client.js";
import {
  GRPCClientService,
  LogGetUserWalletsStreamCompleted,
  LogGetUserWalletsStreamFailed,
  LogGetWalletsStreamCompleted,
  LogGetWalletsStreamFailed,
} from "../../utils/log";

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
        logger.info(LogGetWalletsStreamCompleted, {
          service: GRPCClientService,
          count: wallets.length,
        });
        resolve(wallets);
      });

      call.on("error", (error) => {
        logger.error(LogGetWalletsStreamFailed, {
          service: GRPCClientService,
          error: error.message,
        });
        reject(error);
      });
    });
  }

  getUserWallets(userID: string): Promise<walletType[]> {
    return new Promise((resolve, reject) => {
      const request = new wpb.UserID();
      request.setId(userID);

      this.client
        .getWalletClient()
        .getUserWallets(request, (error, response) => {
          if (error) {
            logger.error(LogGetUserWalletsStreamFailed, {
              service: GRPCClientService,
              user_id: userID,
              error: error.message,
            });
            reject(error);
            return;
          }

          const wallets: walletType[] = (response?.getWalletsList() ?? []).map(
            (w: any) => ({
              id: w.getId(),
              user_id: w.getUserId(),
              name: w.getName(),
              number: w.getNumber(),
              balance: w.getBalance(),
              wallet_type_id: w.getWalletTypeId(),
              wallet_type: w.getWalletType(),
              wallet_type_name: w.getWalletTypeName(),
              created_at: w.getCreatedAt(),
              updated_at: w.getUpdatedAt(),
            }),
          );

          logger.info(LogGetUserWalletsStreamCompleted, {
            service: GRPCClientService,
            user_id: userID,
            count: wallets.length,
          });
          resolve(wallets);
        });
    });
  }
}
