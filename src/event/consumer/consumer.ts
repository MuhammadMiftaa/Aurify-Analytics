import type { ConsumeMessage, Channel } from "amqplib";
import type { ChannelWrapper } from "amqp-connection-manager";
import logger from "../../utils/logger";
import { getConnection } from "../config";
import { EventHandler } from "../../utils/dto";
import {
  EXCHANGE_NAME,
  QUEUE_NAME,
  ROUTING_KEYS,
  RETRY_QUEUE_NAME,
  MAX_RETRY_COUNT,
  RETRY_DELAY_MS,
} from "../../utils/constant";
import { handleWalletCreated } from "./wallet.created";
import { handleWalletUpdated } from "./wallet.updated";
import { handleWalletDeleted } from "./wallet.deleted";
import { handleTransactionCreated } from "./transaction.created";
import { handleTransactionUpdated } from "./transaction.updated";
import { handleTransactionDeleted } from "./transaction.deleted";
import { handleInvestmentBuy } from "./investment.buy";
import { handleInvestmentSell } from "./investment.sell";
import {
  LogChannelClosed,
  LogChannelError,
  LogConsumerReady,
  LogHandlerFailed,
  LogHandlerNotFound,
  LogMessageDiscarded,
  LogMessageUnparseable,
  LogQueueBound,
  RabbitmqConsumerService,
} from "../../utils/log";

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
  const routingKey =
    (msg.properties.headers?.["x-original-routing-key"] as string) ||
    msg.fields.routingKey;

  // Parse payload
  let payload: unknown;
  try {
    payload = JSON.parse(msg.content.toString());
  } catch {
    logger.warn(LogMessageUnparseable, {
      service: RabbitmqConsumerService,
      routingKey,
    });
    channel.nack(msg, false, false);
    return;
  }

  // Dispatch to handler
  const handler = handlers[routingKey];
  if (!handler) {
    logger.warn(LogHandlerNotFound, {
      service: RabbitmqConsumerService,
      routingKey,
    });
    channel.ack(msg);
    return;
  }

  try {
    await handler(routingKey, payload);
    channel.ack(msg);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    const retryCount = (msg.properties.headers?.["x-retry-count"] ??
      0) as number;

    logger.error(LogHandlerFailed, {
      service: RabbitmqConsumerService,
      routingKey,
      error,
      retryCount,
      maxRetry: MAX_RETRY_COUNT,
    });

    if (retryCount >= MAX_RETRY_COUNT) {
      // Max retry reached — discard message
      logger.error(LogMessageDiscarded, {
        service: RabbitmqConsumerService,
        routingKey,
        error,
        retryCount,
        firstFailedAt: msg.properties.headers?.["x-first-failed-at"],
      });
      channel.nack(msg, false, false);
      return;
    }

    // Publish to retry queue with updated headers
    channel.publish("", RETRY_QUEUE_NAME, msg.content, {
      headers: {
        ...msg.properties.headers,
        "x-retry-count": retryCount + 1,
        "x-last-error": error,
        "x-last-failed-at": new Date().toISOString(),
        "x-first-failed-at":
          msg.properties.headers?.["x-first-failed-at"] ??
          new Date().toISOString(),
        "x-original-routing-key": routingKey,
      },
      persistent: true,
    });

    // Ack original message — sudah dipindah ke retry queue
    channel.ack(msg);
  }
};

//$ Start Consumer
export const startConsumer = (): ChannelWrapper => {
  const connection = getConnection();

  const channel = connection.createChannel({
    json: false,

    setup: async (ch: Channel) => {
      // Assert main queue dengan DLX → jika nack tanpa requeue, masuk retry queue
      await ch.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": RETRY_QUEUE_NAME,
        },
      });

      // Assert retry queue dengan TTL → setelah 15 detik, kembali ke main queue
      await ch.assertQueue(RETRY_QUEUE_NAME, {
        durable: true,
        arguments: {
          "x-message-ttl": RETRY_DELAY_MS,
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": QUEUE_NAME,
        },
      });

      for (const routingKey of ROUTING_KEYS) {
        await ch.bindQueue(QUEUE_NAME, EXCHANGE_NAME, routingKey);
        logger.info(LogQueueBound, {
          service: RabbitmqConsumerService,
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

      logger.info(LogConsumerReady, {
        service: RabbitmqConsumerService,
        queue: QUEUE_NAME,
        exchange: EXCHANGE_NAME,
        bindings: ROUTING_KEYS,
        retryQueue: RETRY_QUEUE_NAME,
        retryDelayMs: RETRY_DELAY_MS,
        maxRetry: MAX_RETRY_COUNT,
      });
    },
  });

  channel.on("error", (err) => {
    logger.error(LogChannelError, {
      service: RabbitmqConsumerService,
      error: err.message,
    });
  });

  channel.on("close", () => {
    logger.warn(LogChannelClosed, { service: RabbitmqConsumerService });
  });

  return channel;
};
