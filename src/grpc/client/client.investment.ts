import investmentPbModule from "@muhammadmiftaa/refina-protobuf/investment/investment_pb.js";
import logger from "../../utils/logger";
import { investmentType } from "../../utils/dto";
import { GRPCClient } from "./client";
import {
  GRPCClientService,
  LogGetInvestmentsStreamCompleted,
  LogGetInvestmentsStreamFailed,
  LogGetUserInvestmentsStreamCompleted,
  LogGetUserInvestmentsStreamFailed,
} from "../../utils/log";

const ipb = (investmentPbModule as any).proto?.investment || investmentPbModule;

export class InvestmentGRPCClient {
  private client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  getInvestments(): Promise<investmentType[]> {
    return new Promise((resolve, reject) => {
      const request = new ipb.GetInvestmentOptions();
      request.setLimit(9999);

      const investments: investmentType[] = [];

      const call = this.client.getInvestmentClient().getInvestments(request);

      call.on("data", (response) => {
        if (response) {
          const assetCode = response.getAssetcode();

          investments.push({
            id: response.getId(),
            code: response.getCode(),
            userId: response.getUserid(),
            quantity: response.getQuantity(),
            initialValuation: response.getInitialvaluation(),
            amount: response.getAmount(),
            date: response.getDate(),
            description: response.getDescription(),
            assetCode: {
              code: assetCode.getCode(),
              name: assetCode.getName(),
              unit: assetCode.getUnit(),
              toUSD: assetCode.getTousd(),
              toEUR: assetCode.getToeur(),
              toIDR: assetCode.getToidr(),
              createdAt: assetCode.getCreatedat(),
              updatedAt: assetCode.getUpdatedat(),
            },
            createdAt: response.getCreatedat(),
            updatedAt: response.getUpdatedat(),
          });
        }
      });

      call.on("end", () => {
        logger.info(LogGetInvestmentsStreamCompleted, {
          service: GRPCClientService,
          count: investments.length,
        });
        resolve(investments);
      });

      call.on("error", (error) => {
        logger.error(LogGetInvestmentsStreamFailed, {
          service: GRPCClientService,
          error: error.message,
        });
        reject(error);
      });
    });
  }

  getUserInvestments(userID: string): Promise<investmentType[]> {
    return new Promise((resolve, reject) => {
      const request = new ipb.UserID();
      request.setId(userID);

      const investments: investmentType[] = [];

      const call = this.client
        .getInvestmentClient()
        .getUserInvestments(request);

      call.on("data", (response) => {
        if (response) {
          const assetCode = response.getAssetcode();

          investments.push({
            id: response.getId(),
            code: response.getCode(),
            userId: response.getUserid(),
            quantity: response.getQuantity(),
            initialValuation: response.getInitialvaluation(),
            amount: response.getAmount(),
            date: response.getDate(),
            description: response.getDescription(),
            assetCode: {
              code: assetCode.getCode(),
              name: assetCode.getName(),
              unit: assetCode.getUnit(),
              toUSD: assetCode.getTousd(),
              toEUR: assetCode.getToeur(),
              toIDR: assetCode.getToidr(),
              createdAt: assetCode.getCreatedat(),
              updatedAt: assetCode.getUpdatedat(),
            },
            createdAt: response.getCreatedat(),
            updatedAt: response.getUpdatedat(),
          });
        }
      });

      call.on("end", () => {
        logger.info(LogGetUserInvestmentsStreamCompleted, {
          service: GRPCClientService,
          user_id: userID,
          count: investments.length,
        });
        resolve(investments);
      });

      call.on("error", (error) => {
        logger.error(LogGetUserInvestmentsStreamFailed, {
          service: GRPCClientService,
          user_id: userID,
          error: error.message,
        });
        reject(error);
      });
    });
  }
}
