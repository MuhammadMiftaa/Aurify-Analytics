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

connect(env.DATABASE_URL)
  .then(() => {
    logger.info("Connected to MongoDB");
  })
  .catch((error) => {
    logger.error("MongoDB connection failed", { error: error.message });
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
app.use(middleware.responseInterceptor);
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

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  await closeConnection();
  logger.info("RabbitMQ connection closed");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

app.listen(env.PORT, () => {
  logger.info(`Server started on port ${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Log level: ${env.LOG_LEVEL}`);
});

export default app;
