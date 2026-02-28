import env from "./utils/env";
import express, { Request, Response } from "express";
import logger from "./utils/logger";
import middleware from "./middleware";
import route from "./route";
import { connect } from "mongoose";
import handler from "./handler";
import { GRPCClient } from "./grpc/client/client";
import { WalletGRPCClient } from "./grpc/client/client.wallet";
import { TransactionGRPCClient } from "./grpc/client/client.transaction";
import { InvestmentGRPCClient } from "./grpc/client/client.investment";
import setupSwagger from "./utils/swagger";
import { startConsumer } from "./event/consumer/consumer";
import { closeConnection } from "./event/config";
import {
  DatabaseService,
  HTTPServerService,
  LogDBConnected,
  LogDBConnectFailed,
  LogHTTPServerStarted,
  LogHTTPServerClosed,
  LogShutdownStarted,
  LogUncaughtException,
  LogUnhandledRejection,
  MainService,
} from "./utils/log";

connect(env.DATABASE_URL)
  .then(() => {
    logger.info(LogDBConnected, { service: DatabaseService });
  })
  .catch((error) => {
    logger.error(LogDBConnectFailed, {
      service: DatabaseService,
      error: error.message,
    });
    process.exit(1);
  });

const app = express();

const grpcClient = new GRPCClient(
  env.WALLET_ADDRESS,
  env.TRANSACTION_ADDRESS,
  env.INVESTMENT_ADDRESS,
);
app.locals.walletGRPCClient = new WalletGRPCClient(grpcClient);
app.locals.transactionGRPCClient = new TransactionGRPCClient(grpcClient);
app.locals.investmentGRPCClient = new InvestmentGRPCClient(grpcClient);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware order: requestID → requestLogger → router
app.use(middleware.requestIDMiddleware);
app.use(middleware.requestLogger);

setupSwagger(app);

app.get("/test", (req: Request, res: Response) => {
  res.json({ message: "Hello World" });
});

app.post("/analytics/initial-sync", handler.initialSyncHandler);

app.use("/analytics", route);

app.use(middleware.notFoundHandler);
app.use(middleware.errorHandler);

startConsumer();

const httpServer = app.listen(env.PORT, () => {
  logger.info(LogHTTPServerStarted, {
    service: HTTPServerService,
    port: env.PORT,
    env: env.NODE_ENV,
    log_level: env.LOG_LEVEL,
  });
});

// Graceful shutdown
const shutdown = async (signal?: string) => {
  logger.info(LogShutdownStarted, { service: MainService });

  httpServer.close(async () => {
    await closeConnection();
    logger.info(LogHTTPServerClosed, { service: HTTPServerService });
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  logger.error(LogUncaughtException, {
    service: MainService,
    error: error.message,
  });
  shutdown();
});

process.on("unhandledRejection", (reason) => {
  logger.error(LogUnhandledRejection, {
    service: MainService,
    error: reason instanceof Error ? reason.message : String(reason),
  });
  shutdown();
});

export default app;
