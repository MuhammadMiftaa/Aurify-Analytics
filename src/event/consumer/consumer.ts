import type { ConsumeMessage, Channel } from "amqplib";
import type { ChannelWrapper } from "amqp-connection-manager";
import logger from "../../utils/logger";
import { getConnection } from "../config";
import { EventHandler } from "../../utils/dto";
import { EXCHANGE_NAME, QUEUE_NAME, ROUTING_KEYS } from "../../utils/constant";
import { handleWalletCreated } from "./wallet.created";
import { handleWalletUpdated } from "./wallet.updated";
import { handleWalletDeleted } from "./wallet.deleted";
import { handleTransactionCreated } from "./transaction.created";
import { handleTransactionUpdated } from "./transaction.updated";
import { handleTransactionDeleted } from "./transaction.deleted";
import { handleInvestmentBuy } from "./investment.buy";
import { handleInvestmentSell } from "./investment.sell";

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
const processMessage = async (
  channel: ChannelWrapper,
  msg: ConsumeMessage,
): Promise<void> => {
  const routingKey = msg.fields.routingKey;

  // Parse payload
  let payload: unknown;
  try {
    payload = JSON.parse(msg.content.toString());
  } catch {
    logger.warn("Unparseable message, discarding", { routingKey });
    channel.nack(msg, false, false);
    return;
  }

  // Dispatch to handler
  const handler = handlers[routingKey];
  if (!handler) {
    logger.warn("No handler for routing key, discarding", { routingKey });
    channel.ack(msg);
    return;
  }

  try {
    await handler(routingKey, payload);
    channel.ack(msg);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("Handler threw error, requeueing", { routingKey, error });
    channel.nack(msg, false, true);
  }
};

//$ Start Consumer
export const startConsumer = (): ChannelWrapper => {
  const connection = getConnection();

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
