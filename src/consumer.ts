import type { ConsumeMessage, Channel } from "amqplib";
import type { ChannelWrapper } from "amqp-connection-manager";
import logger from "./logger";
import { getConnection } from "./queue";
import {
  EventHandler,
  investmentType,
  transactionSchema,
  transactionType,
  walletType,
} from "./dto";
import { EXCHANGE_NAME, QUEUE_NAME, ROUTING_KEYS } from "./constant";
import { userTransactionModel, userWalletModel } from "./model";
import helper from "./helper";

//$ Wallet Handlers
const handleWalletCreated: EventHandler = (
  routingKey: string,
  payload: unknown,
) => {
  logger.info("Wallet created", { routingKey, payload });
  const wallet = payload as walletType;
};

const handleWalletUpdated: EventHandler = (
  routingKey: string,
  payload: unknown,
) => {
  logger.info("Wallet updated", { routingKey, payload });
  const wallet = payload as walletType;
};

const handleWalletDeleted: EventHandler = (
  routingKey: string,
  payload: unknown,
) => {
  logger.info("Wallet deleted", { routingKey, payload });
  const wallet = payload as walletType;
};

//$ Transaction Handlers
const handleTransactionCreated: EventHandler = async (
  routingKey: string,
  payload: unknown,
) => {
  try {
    const transaction = helper.validate<transactionType>(
      transactionSchema,
      payload,
    );

    const wallet = await userWalletModel.findOne({
      WalletID: transaction.wallet_id,
    });

    const userTransactionFilter = {
      UserID: wallet?.UserID,
      WalletID: transaction.wallet_id,
      CategoryID: transaction.category_id,
      Date: transaction.transaction_date,
    };
    const userTransactionUpdate = {
      $inc: {
        TotalAmount: transaction.amount,
        TransactionCount: 1,
      },
      $push: {
        Transactions: {
          ID: transaction.id,
          Description: transaction.description,
          Date: transaction.transaction_date,
        },
      },
      $set: {
        WalletName: wallet?.WalletName,
        WalletType: wallet?.WalletType,
        CategoryName: transaction.category_name,
        CategoryType: transaction.category_type,
        Date: transaction.transaction_date,
        Year: transaction.transaction_date.getFullYear(),
        Month: transaction.transaction_date.getMonth() + 1,
        Week: helper.getWeekNumber(transaction.transaction_date),
        Day: transaction.transaction_date.getDate(),
        UpdatedAt: new Date(),
      },
      $setOnInsert: {
        UserID: wallet?.UserID,
        WalletID: transaction.wallet_id,
        CategoryID: transaction.category_id,
        CreatedAt: new Date(),
      },
    };
    const userTransactionOption = { upsert: true };

    await userTransactionModel.updateOne(userTransactionFilter, userTransactionUpdate, userTransactionOption);

    const userBalanceFilter = {
      WalletID: transaction.wallet_id,
      Date: transaction.transaction_date,
    };

    logger.info("Transaction created/updated");
  } catch (error) {
    logger.error("Failed to handle transaction created", { error });
  }
};

const handleTransactionUpdated: EventHandler = (
  routingKey: string,
  payload: unknown,
) => {
  logger.info("Transaction updated", { routingKey, payload });
  const transaction = payload as transactionType;
};

const handleTransactionDeleted: EventHandler = (
  routingKey: string,
  payload: unknown,
) => {
  logger.info("Transaction deleted", { routingKey, payload });
  const transaction = payload as transactionType;
};

//$ Investment Handlers
const handleInvestmentBuy: EventHandler = (
  routingKey: string,
  payload: unknown,
) => {
  logger.info("Investment buy", { routingKey, payload });
  const investment = payload as investmentType;
};

const handleInvestmentSell: EventHandler = (
  routingKey: string,
  payload: unknown,
) => {
  logger.info("Investment sell", { routingKey, payload });
  const investment = payload as investmentType;
};

//$ Handler Registry
const handlers: Record<string, EventHandler> = {
  "wallet.created": handleWalletCreated,
  "wallet.updated": handleWalletUpdated,
  "wallet.deleted": handleWalletDeleted,
  "transaction.created": handleTransactionCreated,
  "transaction.updated": handleTransactionUpdated,
  "transaction.deleted": handleTransactionDeleted,
  "investment.buy": handleInvestmentBuy,
  "investment.sell": handleInvestmentSell,
};

//$ Message Processor
const processMessage = (channel: ChannelWrapper, msg: ConsumeMessage): void => {
  const routingKey = msg.fields.routingKey;

  // Parse payload
  let payload: unknown;
  try {
    const unk = payload as unknown;
    payload = JSON.parse(msg.content.toString());
  } catch {
    logger.warn("Unparseable message, discarding", { routingKey });
    channel.nack(msg, false, false); // discard — jangan requeue
    return;
  }

  // Dispatch ke handler
  const handler = handlers[routingKey];
  if (!handler) {
    logger.warn("No handler for routing key, discarding", { routingKey });
    channel.ack(msg); // ack agar tidak menumpuk
    return;
  }

  try {
    handler(routingKey, payload);
    channel.ack(msg);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("Handler threw error, requeueing", { routingKey, error });
    channel.nack(msg, false, true); // requeue = true
  }
};

//$ Start Consumer
export const startConsumer = (): ChannelWrapper => {
  const connection = getConnection();

  // createChannel otomatis re-setup saat reconnect
  const channel = connection.createChannel({
    json: false,

    setup: async (ch: Channel) => {
      await ch.assertQueue(QUEUE_NAME, { durable: true });

      for (const routingKey of ROUTING_KEYS) {
        await ch.bindQueue(QUEUE_NAME, EXCHANGE_NAME, routingKey);
        logger.info("Queue bound", {
          queue: QUEUE_NAME,
          exchange: EXCHANGE_NAME,
          routingKey,
        });
      }

      await ch.prefetch(1);

      await ch.consume(QUEUE_NAME, (msg) => {
        if (!msg) return;
        processMessage(channel, msg);
      });

      logger.info("Consumer setup complete", {
        queue: QUEUE_NAME,
        exchange: EXCHANGE_NAME,
        bindings: ROUTING_KEYS,
      });
    },
  });

  channel.on("error", (err) => {
    logger.error("Channel error", { error: err.message });
  });

  channel.on("close", () => {
    logger.warn("Channel closed, will be recreated on reconnect");
  });

  return channel;
};
