import transactionPbModule from "@muhammadmiftaa/refina-protobuf/transaction/transaction_pb.js";
import logger from "../../logger";
import { transactionType } from "../../dto";
import { GRPCClient } from "./client";
import {
  GRPCClientService,
  LogGetTransactionsStreamCompleted,
  LogGetTransactionsStreamFailed,
  LogGetUserTransactionsStreamCompleted,
  LogGetUserTransactionsStreamFailed,
} from "../../log";

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
          });
        }
      });

      call.on("end", () => {
        logger.info(LogGetTransactionsStreamCompleted, {
          service: GRPCClientService,
          count: transactions.length,
        });
        resolve(transactions);
      });

      call.on("error", (error) => {
        logger.error(LogGetTransactionsStreamFailed, {
          service: GRPCClientService,
          error: error.message,
        });
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
          });
        }
      });

      call.on("end", () => {
        logger.info(LogGetUserTransactionsStreamCompleted, {
          service: GRPCClientService,
          wallet_ids: walletIDs,
          count: transactions.length,
        });
        resolve(transactions);
      });

      call.on("error", (error) => {
        logger.error(LogGetUserTransactionsStreamFailed, {
          service: GRPCClientService,
          wallet_ids: walletIDs,
          error: error.message,
        });
        reject(error);
      });
    });
  }
}
