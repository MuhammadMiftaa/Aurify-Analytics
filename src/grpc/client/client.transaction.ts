import transactionPbModule from "@muhammadmiftaa/refina-protobuf/transaction/transaction_pb.js";
import logger from "../../utils/logger";
import { transactionType } from "../../utils/dto";
import { GRPCClient } from "./client";

const tpb =
  (transactionPbModule as any).proto?.transaction || transactionPbModule;

export class TransactionGRPCClient {
  private client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  getTransactions(): Promise<transactionType[]> {
    return new Promise((resolve, reject) => {
      const request = new tpb.GetTransactionOptions();
      request.setLimit(9999);

      const transactions: transactionType[] = [];

      const call = this.client.getTransactionClient().getTransactions(request);

      call.on("data", (response) => {
        if (response) {
          transactions.push({
            id: response.getId(),
            wallet_id: response.getWalletId(),
            amount: response.getAmount(),
            category_id: response.getCategoryId(),
            category_name: response.getCategoryName(),
            category_type: response.getCategoryType(),
            transaction_date: response.getTransactionDate(),
            description: response.getDescription(),
            created_at: response.getCreatedAt(),
            updated_at: response.getUpdatedAt(),
            attachments: null,
          });
        }
      });

      call.on("end", () => {
        logger.info("Fetch Transaction Stream Completed:", transactions);
        resolve(transactions);
      });

      call.on("error", (error) => {
        logger.error("Fetch Transaction Stream Error:", error);
        reject(error);
      });
    });
  }

  getUserTransactions(walletIDs: string[]): Promise<transactionType[]> {
    return new Promise((resolve, reject) => {
      const request = new tpb.Wallets();
      request.setWalletIdList(walletIDs);

      const transactions: transactionType[] = [];

      const call = this.client
        .getTransactionClient()
        .getUserTransactions(request);

      call.on("data", (response) => {
        if (response) {
          transactions.push({
            id: response.getId(),
            wallet_id: response.getWalletId(),
            amount: response.getAmount(),
            category_id: response.getCategoryId(),
            category_name: response.getCategoryName(),
            category_type: response.getCategoryType(),
            transaction_date: response.getTransactionDate(),
            description: response.getDescription(),
            created_at: response.getCreatedAt(),
            updated_at: response.getUpdatedAt(),
            attachments: null,
          });
        }
      });

      call.on("end", () => {
        logger.info("Fetch Transaction Stream Completed:", transactions);
        resolve(transactions);
      });

      call.on("error", (error) => {
        logger.error("Fetch Transaction Stream Error:", error);
        reject(error);
      });
    });
  }
}
