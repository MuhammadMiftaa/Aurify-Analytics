import transactionPbModule from "@muhammadmiftaa/refina-protobuf/transaction/transaction_pb.js";
import logger from "../../utils/logger";
import { transactionType } from "../../utils/dto";
import { GRPCClient } from "./client";
import {
  GRPCClientService,
  LogGetTransactionsStreamCompleted,
  LogGetTransactionsStreamFailed,
  LogGetUserTransactionsStreamCompleted,
  LogGetUserTransactionsStreamFailed,
} from "../../utils/log";

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
      const request = new tpb.GetUserTransactionsRequest();
      request.setWalletIdsList(walletIDs);

      this.client
        .getTransactionClient()
        .getUserTransactions(request, (error: any, response: any) => {
          if (error) {
            logger.error(LogGetUserTransactionsStreamFailed, {
              service: GRPCClientService,
              wallet_ids: walletIDs,
              error: error.message,
            });
            reject(error);
            return;
          }

          const transactions: transactionType[] = (
            response?.getTransactionsList() ?? []
          ).map((t: any) => ({
            id: t.getId(),
            wallet_id: t.getWalletId(),
            amount: t.getAmount(),
            category_id: t.getCategoryId(),
            category_name: t.getCategoryName(),
            category_type: t.getCategoryType(),
            transaction_date: t.getTransactionDate(),
            description: t.getDescription(),
            created_at: t.getCreatedAt(),
            updated_at: t.getUpdatedAt(),
            attachments: null,
          }));

          logger.info(LogGetUserTransactionsStreamCompleted, {
            service: GRPCClientService,
            wallet_ids: walletIDs,
            count: transactions.length,
          });
          resolve(transactions);
        });
    });
  }
}
