import type { ConsumeMessage, Channel } from "amqplib";
import type { ChannelWrapper } from "amqp-connection-manager";
import logger from "./logger";
import { getConnection } from "./queue";
import { EventHandler } from "./dto";
import {
  EXCHANGE_NAME,
  EXCHANGE_TYPE,
  QUEUE_NAME,
  ROUTING_KEYS,
} from "./constant";

//$ Wallet Handlers
const handleWalletCreated: EventHandler = (routingKey, payload) => {
  logger.info("Wallet created", { routingKey, payload });
};

const handleWalletUpdated: EventHandler = (routingKey, payload) => {
  logger.info("Wallet updated", { routingKey, payload });
};

const handleWalletDeleted: EventHandler = (routingKey, payload) => {
  logger.info("Wallet deleted", { routingKey, payload });
};

//$ Transaction Handlers
const handleTransactionCreated: EventHandler = (routingKey, payload) => {
  logger.info("Transaction created", { routingKey, payload });
};

const handleTransactionUpdated: EventHandler = (routingKey, payload) => {
  logger.info("Transaction updated", { routingKey, payload });
};

const handleTransactionDeleted: EventHandler = (routingKey, payload) => {
  logger.info("Transaction deleted", { routingKey, payload });
};

//$ Investment Handlers
const handleInvestmentBuy: EventHandler = (routingKey, payload) => {
  logger.info("Investment buy", { routingKey, payload });
};

const handleInvestmentSell: EventHandler = (routingKey, payload) => {
  logger.info("Investment sell", { routingKey, payload });
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
