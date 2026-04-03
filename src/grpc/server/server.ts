import * as grpc from "@grpc/grpc-js";
import dashboardGrpcModule from "@muhammadmiftaa/refina-protobuf/dashboard/dashboard_grpc_pb.js";
import dashboardPbModule from "@muhammadmiftaa/refina-protobuf/dashboard/dashboard_pb.js";
import service from "../../service.js";
import logger from "../../utils/logger.js";
import { userWalletModel } from "../../utils/model.js";
import {
  GRPCServerService,
  LogGRPCHandlerFailed,
  LogGRPCServerBindFailed,
  LogGRPCServerStarted,
} from "../../utils/log.js";
import {
  unaryServerInterceptor,
  logFieldsFromCall,
} from "../interceptor/userMetadata.js";

const dpb = (dashboardPbModule as any).proto?.dashboard || dashboardPbModule;
const dgrpc = (dashboardGrpcModule as any).dashboard || dashboardGrpcModule;

// ═══════════════════════════════════════════════
// gRPC Server Implementation
// ═══════════════════════════════════════════════

// S6544 fix: separate the async logic from the void-returning gRPC handler.
// grpc.handleUnaryCall expects a void return; async functions return Promise<void>,
// which SonarQube flags. The pattern below keeps async/await while satisfying the type.

async function handleGetUserTransactions(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): Promise<void> {
  const req = call.request;
  const dateOption: any = {};
  const grpcDateOption = req.getDateOption();
  if (grpcDateOption) {
    if (grpcDateOption.getDate())
      dateOption.date = new Date(grpcDateOption.getDate());
    if (grpcDateOption.getYear()) dateOption.year = grpcDateOption.getYear();
    if (grpcDateOption.getMonth()) dateOption.month = grpcDateOption.getMonth();
    if (grpcDateOption.getDay()) dateOption.day = grpcDateOption.getDay();
    const grpcRange = grpcDateOption.getRange();
    if (grpcRange?.getStart()) {
      dateOption.range = {
        start: new Date(grpcRange.getStart()),
        end: new Date(grpcRange.getEnd()),
      };
    }
  }
  const result = await service.getUserTransaction({
    userID: req.getUserId(),
    walletID: req.getWalletId() || undefined,
    dateOption: dateOption,
  });
  const response = new dpb.GetUserTransactionsResponse();
  const categories = result.map((cat: any) => {
    const c = new dpb.TransactionCategory();
    c.setCategoryId(cat.CategoryID || "");
    c.setCategoryName(cat.CategoryName || "");
    c.setCategoryType(cat.CategoryType || "");
    c.setParentCategoryName(cat.ParentCategoryName || "");
    c.setTotalAmount(cat.TotalAmount || 0);
    c.setTotalTransactions(cat.TotalTransactions || 0);
    return c;
  });
  response.setCategoriesList(categories);
  callback(null, response);
}

const getUserTransactions: grpc.handleUnaryCall<any, any> = (
  call,
  callback,
) => {
  handleGetUserTransactions(call, callback).catch((error: any) => {
    logger.error(LogGRPCHandlerFailed, {
      ...logFieldsFromCall(call),
      handler: "getUserTransactions",
      error: error.message,
    });
    callback({
      code: grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  });
};

async function handleGetUserBalance(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): Promise<void> {
  const req = call.request;
  let range: any = undefined;
  const grpcRange = req.getRange();
  if (grpcRange?.getStart()) {
    range = {
      start: new Date(grpcRange.getStart()),
      end: new Date(grpcRange.getEnd()),
    };
  }
  const result = await service.getUserBalance({
    userID: req.getUserId(),
    walletID: req.getWalletId() || undefined,
    aggregation: req.getAggregation() || "monthly",
    range,
  });
  const response = new dpb.GetUserBalanceResponse();
  const snapshots = (result || []).map((snap: any) => {
    const s = new dpb.BalanceSnapshot();
    s.setWalletId(snap.WalletID || "");
    s.setWalletName(snap.WalletName || "");
    s.setDate(snap.Date ? new Date(snap.Date).toISOString() : "");
    s.setYear(snap.Year || 0);
    s.setMonth(snap.Month || 0);
    s.setWeek(snap.Week || 0);
    s.setDay(snap.Day || 0);
    s.setOpeningBalance(snap.OpeningBalance || 0);
    s.setClosingBalance(snap.ClosingBalance || 0);
    s.setTotalIncome(snap.TotalIncome || 0);
    s.setTotalExpense(snap.TotalExpense || 0);
    s.setNetChange(snap.NetChange || 0);
    s.setTransactionCount(snap.TransactionCount || snap.TotalTransactions || 0);
    return s;
  });
  response.setSnapshotsList(snapshots);
  callback(null, response);
}

const getUserBalance: grpc.handleUnaryCall<any, any> = (call, callback) => {
  handleGetUserBalance(call, callback).catch((error: any) => {
    logger.error(LogGRPCHandlerFailed, {
      ...logFieldsFromCall(call),
      handler: "getUserBalance",
      error: error.message,
    });
    callback({
      code: grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  });
};

async function handleGetUserFinancialSummary(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): Promise<void> {
  const req = call.request;
  let range: any = undefined;
  const grpcRange = req.getRange();
  if (grpcRange?.getStart()) {
    range = {
      start: new Date(grpcRange.getStart()),
      end: new Date(grpcRange.getEnd()),
    };
  }
  const result = await service.getUserFinancialSummary({
    userID: req.getUserId(),
    walletID: req.getWalletId() || undefined,
    range,
  });
  const response = new dpb.GetUserFinancialSummaryResponse();
  const summaries = (result || []).map((s: any) => {
    const fs = new dpb.FinancialSummary();
    fs.setUserId(s.UserID || "");
    fs.setPeriodType(s.PeriodType || "");
    fs.setPeriodKey(s.PeriodKey || "");
    fs.setPeriodStart(
      s.PeriodStart ? new Date(s.PeriodStart).toISOString() : "",
    );
    fs.setPeriodEnd(s.PeriodEnd ? new Date(s.PeriodEnd).toISOString() : "");
    fs.setIncomeNow(s.IncomeNow || 0);
    fs.setExpenseNow(s.ExpenseNow || 0);
    fs.setProfitNow(s.ProfitNow || 0);
    fs.setBalanceNow(s.BalanceNow || 0);
    fs.setIncomePrev(s.IncomePrev || 0);
    fs.setExpensePrev(s.ExpensePrev || 0);
    fs.setProfitPrev(s.ProfitPrev || 0);
    fs.setBalancePrev(s.BalancePrev || 0);
    fs.setIncomeGrowthPct(s.IncomeGrowthPct || 0);
    fs.setExpenseGrowthPct(s.ExpenseGrowthPct || 0);
    fs.setProfitGrowthPct(s.ProfitGrowthPct || 0);
    fs.setBalanceGrowthPct(s.BalanceGrowthPct || 0);
    fs.setSavingsRate(s.SavingsRate || 0);
    fs.setExpenseToIncomeRatio(s.ExpenseToIncomeRatio || 0);
    fs.setBurnRateDaily(s.BurnRateDaily || 0);
    fs.setAvgIncomeDaily(s.AvgIncomeDaily || 0);
    fs.setAvgExpenseDaily(s.AvgExpenseDaily || 0);
    fs.setRunwayDays(s.RunwayDays || 0);
    fs.setTotalTransactions(s.TotalTransactions || 0);
    fs.setIncomeTransactionCount(s.IncomeTransactionCount || 0);
    fs.setExpenseTransactionCount(s.ExpenseTransactionCount || 0);
    fs.setAvgTransactionAmount(s.AvgTransactionAmount || 0);
    fs.setLargestIncome(s.LargestIncome || 0);
    fs.setLargestExpense(s.LargestExpense || 0);
    if (s.InvestmentSummary) {
      const inv = new dpb.InvestmentSummary();
      inv.setTotalInvested(s.InvestmentSummary.TotalInvested || 0);
      inv.setTotalCurrentValuation(
        s.InvestmentSummary.TotalCurrentValuation || 0,
      );
      inv.setTotalSoldAmount(s.InvestmentSummary.TotalSoldAmount || 0);
      inv.setTotalDeficit(s.InvestmentSummary.TotalDeficit || 0);
      inv.setUnrealizedGain(s.InvestmentSummary.UnrealizedGain || 0);
      inv.setRealizedGain(s.InvestmentSummary.RealizedGain || 0);
      inv.setInvestmentGrowthPct(s.InvestmentSummary.InvestmentGrowthPct || 0);
      inv.setBuyCount(s.InvestmentSummary.BuyCount || 0);
      inv.setSellCount(s.InvestmentSummary.SellCount || 0);
      inv.setActivePositions(s.InvestmentSummary.ActivePositions || 0);
      fs.setInvestmentSummary(inv);
    }
    if (s.NetWorth) {
      const nw = new dpb.NetWorthSummary();
      nw.setTotal(s.NetWorth.Total || 0);
      nw.setWalletPortion(s.NetWorth.WalletPortion || 0);
      nw.setInvestmentPortion(s.NetWorth.InvestmentPortion || 0);
      nw.setNetWorthPrev(s.NetWorth.NetWorthPrev || 0);
      nw.setNetWorthGrowthPct(s.NetWorth.NetWorthGrowthPct || 0);
      fs.setNetWorth(nw);
    }
    if (s.TopExpenseCategories) {
      const cats = s.TopExpenseCategories.map((cat: any) => {
        const c = new dpb.CategorySummary();
        c.setCategoryId(cat.CategoryID || "");
        c.setCategoryName(cat.CategoryName || "");
        c.setAmount(cat.Amount || 0);
        c.setPercentage(cat.Percentage || 0);
        c.setTransactionCount(cat.TransactionCount || 0);
        return c;
      });
      fs.setTopExpenseCategoriesList(cats);
    }
    if (s.TopIncomeCategories) {
      const cats = s.TopIncomeCategories.map((cat: any) => {
        const c = new dpb.CategorySummary();
        c.setCategoryId(cat.CategoryID || "");
        c.setCategoryName(cat.CategoryName || "");
        c.setAmount(cat.Amount || 0);
        c.setPercentage(cat.Percentage || 0);
        c.setTransactionCount(cat.TransactionCount || 0);
        return c;
      });
      fs.setTopIncomeCategoriesList(cats);
    }
    if (s.WalletSummaries) {
      const ws = s.WalletSummaries.map((w: any) => {
        const wm = new dpb.WalletSummary();
        wm.setWalletId(w.WalletID || "");
        wm.setWalletName(w.WalletName || "");
        wm.setWalletType(w.WalletType || "");
        wm.setOpeningBalance(w.OpeningBalance || 0);
        wm.setClosingBalance(w.ClosingBalance || 0);
        wm.setIncome(w.Income || 0);
        wm.setExpense(w.Expense || 0);
        wm.setNetChange(w.NetChange || 0);
        wm.setShareOfBalancePct(w.ShareOfBalancePct || 0);
        return wm;
      });
      fs.setWalletSummariesList(ws);
    }
    return fs;
  });
  response.setSummariesList(summaries);
  callback(null, response);
}

const getUserFinancialSummary: grpc.handleUnaryCall<any, any> = (
  call,
  callback,
) => {
  handleGetUserFinancialSummary(call, callback).catch((error: any) => {
    logger.error(LogGRPCHandlerFailed, {
      ...logFieldsFromCall(call),
      handler: "getUserFinancialSummary",
      error: error.message,
    });
    callback({
      code: grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  });
};

async function handleGetUserNetWorthComposition(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): Promise<void> {
  const req = call.request;
  const result = await service.getUserNetWorthComposition({
    userID: req.getUserId(),
  });
  const response = new dpb.NetWorthComposition();
  if (result) {
    response.setUserId(result.UserID || "");
    response.setTotal(result.Total || 0);
    if (result.Slices && Array.isArray(result.Slices)) {
      const slices = result.Slices.map((s: any) => {
        const slice = new dpb.NetWorthSlice();
        slice.setLabel(s.Label || "");
        slice.setAmount(s.Amount || 0);
        slice.setPercentage(s.Percentage || 0);
        if (s.Details) {
          const details = new dpb.NetWorthSliceDetails();
          details.setItemCount(s.Details.ItemCount || 0);
          details.setDescription(s.Details.Description || "");
          details.setUnrealizedGain(s.Details.UnrealizedGain || 0);
          slice.setDetails(details);
        }
        return slice;
      });
      response.setSlicesList(slices);
    }
  }
  callback(null, response);
}

const getUserNetWorthComposition: grpc.handleUnaryCall<any, any> = (
  call,
  callback,
) => {
  handleGetUserNetWorthComposition(call, callback).catch((error: any) => {
    logger.error(LogGRPCHandlerFailed, {
      ...logFieldsFromCall(call),
      handler: "getUserNetWorthComposition",
      error: error.message,
    });
    callback({
      code: grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  });
};

async function handleGetUserWallets(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): Promise<void> {
  const req = call.request;
  const userID = req.getId();
  const wallets = await userWalletModel
    .find(
      { UserID: userID, IsActive: true },
      {
        _id: 0,
        WalletID: 1,
        UserID: 1,
        WalletName: 1,
        WalletType: 1,
        WalletTypeName: 1,
        Balance: 1,
        Currency: 1,
        Icon: 1,
        IsActive: 1,
      },
    )
    .lean();
  const response = new dpb.GetUserWalletsResponse();
  const walletMessages = (wallets || []).map((w: any) => {
    const wm = new dpb.DashboardWallet();
    wm.setWalletId(w.WalletID || "");
    wm.setUserId(w.UserID || "");
    wm.setWalletName(w.WalletName || "");
    wm.setWalletType(w.WalletType || "");
    wm.setWalletTypeName(w.WalletTypeName || "");
    wm.setBalance(w.Balance || 0);
    wm.setCurrency(w.Currency || "IDR");
    wm.setIcon(w.Icon || "");
    wm.setIsActive(w.IsActive !== false);
    return wm;
  });
  response.setWalletsList(walletMessages);
  callback(null, response);
}

const getUserWallets: grpc.handleUnaryCall<any, any> = (call, callback) => {
  handleGetUserWallets(call, callback).catch((error: any) => {
    logger.error(LogGRPCHandlerFailed, {
      ...logFieldsFromCall(call),
      handler: "getUserWallets",
      error: error.message,
    });
    callback({
      code: grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  });
};

// ── GetCategoryTransactions ──

async function handleGetCategoryTransactions(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): Promise<void> {
  const req = call.request;
  const dateOption: any = {};
  const grpcDateOption = req.getDateOption();
  if (grpcDateOption) {
    if (grpcDateOption.getDate())
      dateOption.date = new Date(grpcDateOption.getDate());
    if (grpcDateOption.getYear()) dateOption.year = grpcDateOption.getYear();
    if (grpcDateOption.getMonth()) dateOption.month = grpcDateOption.getMonth();
    if (grpcDateOption.getDay()) dateOption.day = grpcDateOption.getDay();
    const grpcRange = grpcDateOption.getRange();
    if (grpcRange?.getStart()) {
      dateOption.range = {
        start: new Date(grpcRange.getStart()),
        end: new Date(grpcRange.getEnd()),
      };
    }
  }
  const result = await service.getCategoryTransactions({
    userID: req.getUserId(),
    walletID: req.getWalletId() || undefined,
    categoryID: req.getCategoryId(),
    dateOption: dateOption,
  });

  const response = new dpb.GetCategoryTransactionsResponse();

  // Handle null result
  if (!result) {
    response.setTransactionsList([]);
    callback(null, response);
    return;
  }

  logger.debug("DEBUG: ", { result: result?.Transactions });
  const transactions = (result?.Transactions || []).map((tx: any) => {
    const t = new dpb.CategoryTransactionItem();
    t.setTransactionId(tx.TransactionID || "");
    t.setDescription(tx.Description || "");
    t.setAmount(tx.Amount || 0);
    t.setTransactionDate(
      tx.TransactionDate ? new Date(tx.TransactionDate).toISOString() : "",
    );
    t.setWalletName(tx.WalletName || "");
    return t;
  });
  response.setTransactionsList(transactions);
  callback(null, response);
}

const getCategoryTransactions: grpc.handleUnaryCall<any, any> = (
  call,
  callback,
) => {
  handleGetCategoryTransactions(call, callback).catch((error: any) => {
    logger.error(LogGRPCHandlerFailed, {
      ...logFieldsFromCall(call),
      handler: "getCategoryTransactions",
      error: error.message,
    });
    callback({
      code: grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  });
};

// ═══════════════════════════════════════════════
// Server Setup
// ═══════════════════════════════════════════════
export function startGRPCServer(port: string | number): grpc.Server {
  const server = new grpc.Server();
  server.addService(dgrpc.DashboardServiceService, {
    getUserTransactions: unaryServerInterceptor(getUserTransactions),
    getUserBalance: unaryServerInterceptor(getUserBalance),
    getUserFinancialSummary: unaryServerInterceptor(getUserFinancialSummary),
    getUserNetWorthComposition: unaryServerInterceptor(
      getUserNetWorthComposition,
    ),
    getUserWallets: unaryServerInterceptor(getUserWallets),
    getCategoryTransactions: unaryServerInterceptor(getCategoryTransactions),
  });
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error(LogGRPCServerBindFailed, {
          service: GRPCServerService,
          port,
          error: err.message,
        });
        process.exit(1);
      }
      logger.info(LogGRPCServerStarted, {
        service: GRPCServerService,
        port: boundPort,
      });
    },
  );
  return server;
}
