import amqp from "amqp-connection-manager";
import type { AmqpConnectionManager } from "amqp-connection-manager";
import logger from "../utils/logger";
import env from "../utils/env";
import {
  LogRabbitmqConnected,
  LogRabbitmqConnectionClosed,
  LogRabbitmqConnectFailed,
  LogRabbitmqDisconnected,
  RabbitmqService,
} from "../utils/log";

let connection: AmqpConnectionManager | null = null;

export const getConnection = (): AmqpConnectionManager => {
  if (connection) return connection;

  connection = amqp.connect(
    [
      `amqp://${env.RABBITMQ_USER}:${env.RABBITMQ_PASSWORD}@${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}/${env.RABBITMQ_VIRTUAL_HOST}`,
    ],
    {
      reconnectTimeInSeconds: 5,
    },
  );

  connection.on("connect", () => {
    logger.info(LogRabbitmqConnected, { service: RabbitmqService });
  });

  connection.on("disconnect", ({ err }) => {
    logger.warn(LogRabbitmqDisconnected, {
      service: RabbitmqService,
      error: err?.message,
    });
  });

  connection.on("connectFailed", ({ err }) => {
    logger.error(LogRabbitmqConnectFailed, {
      service: RabbitmqService,
      error: err?.message,
    });
  });

  return connection;
};

export const closeConnection = async (): Promise<void> => {
  if (connection) {
    await connection.close();
    connection = null;
    logger.info(LogRabbitmqConnectionClosed, { service: RabbitmqService });
  }
};
