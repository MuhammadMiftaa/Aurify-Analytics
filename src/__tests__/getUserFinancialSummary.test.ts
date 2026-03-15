// ─────────────────────────────────────────────────────────────
// getUserFinancialSummary.test.ts
// Unit test untuk: getUserFinancialSummary
// ─────────────────────────────────────────────────────────────

import {
  jest,
  describe,
  it,
  beforeAll,
  afterEach,
  expect,
} from "@jest/globals";

// ─── Mock Declarations ───────────────────────────────────────
const mockFind = jest.fn<(...args: any[]) => any>();
const mockSort = jest.fn<(...args: any[]) => any>();
const mockLean = jest.fn<(...args: any[]) => any>();

// Chainable: find().sort().lean()
mockSort.mockReturnValue({ lean: mockLean });
mockFind.mockReturnValue({ sort: mockSort });

jest.unstable_mockModule("../utils/model", () => ({
  userTransactionModel: {
    aggregate: jest.fn(),
  },
  userBalanceModel: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn() }),
    }),
    aggregate: jest.fn(),
  },
  userFinancialSummariesModel: {
    find: mockFind,
  },
  userNetWorthCompositionModel: {
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn() }),
    }),
  },
  userWalletModel: {},
  userInvestmentModel: {},
}));

jest.unstable_mockModule("../utils/env", () => ({
  default: {
    HTTP_PORT: 3000,
    GRPC_PORT: 50051,
    NODE_ENV: "test",
    DATABASE_URL: "mongodb://test",
    LOG_LEVEL: "error",
    INITIAL_SYNC_KEY: "test-key",
    WALLET_ADDRESS: "localhost:50052",
    TRANSACTION_ADDRESS: "localhost:50053",
    INVESTMENT_ADDRESS: "localhost:50054",
    RABBITMQ_HOST: "localhost",
    RABBITMQ_PORT: "5672",
    RABBITMQ_USER: "guest",
    RABBITMQ_PASSWORD: "guest",
    RABBITMQ_VIRTUAL_HOST: "/",
  },
}));

jest.unstable_mockModule("../utils/logger", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Dynamic Imports ─────────────────────────────────────────
let service: any;

beforeAll(async () => {
  ({ default: service } = await import("../service"));
});

// ─────────────────────────────────────────────
// Sample Data Factories
// ─────────────────────────────────────────────

const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const WALLET_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const sampleFinancialSummary = () => [
  {
    UserID: USER_ID,
    PeriodType: "monthly",
    PeriodKey: "2025-01",
    PeriodStart: new Date("2025-01-01"),
    PeriodEnd: new Date("2025-01-31"),
    IncomeNow: 5000000,
    ExpenseNow: 3000000,
    ProfitNow: 2000000,
    BalanceNow: 10000000,
    IncomePrev: 4000000,
    ExpensePrev: 2500000,
    ProfitPrev: 1500000,
    BalancePrev: 8000000,
    IncomeGrowthPct: 25,
    ExpenseGrowthPct: 20,
    ProfitGrowthPct: 33.33,
    BalanceGrowthPct: 25,
    SavingsRate: 40,
    ExpenseToIncomeRatio: 60,
    BurnRateDaily: 100000,
    AvgIncomeDaily: 166666,
    AvgExpenseDaily: 100000,
    RunwayDays: 100,
    TotalTransactions: 50,
    IncomeTransactionCount: 10,
    ExpenseTransactionCount: 40,
    AvgTransactionAmount: 160000,
    LargestIncome: 3000000,
    LargestExpense: 500000,
    InvestmentSummary: {
      TotalInvested: 5000000,
      TotalCurrentValuation: 5500000,
      TotalSoldAmount: 0,
      TotalDeficit: 0,
      UnrealizedGain: 500000,
      RealizedGain: 0,
    },
    NetWorth: {
      Total: 15500000,
      WalletPortion: 10000000,
      InvestmentPortion: 5500000,
    },
    TopExpenseCategories: [
      { CategoryID: "cat-1", CategoryName: "Food", Amount: 1000000 },
    ],
    TopIncomeCategories: [
      { CategoryID: "cat-2", CategoryName: "Salary", Amount: 5000000 },
    ],
    WalletSummaries: [
      {
        WalletID: WALLET_ID,
        WalletName: "Bank A",
        Income: 5000000,
        Expense: 3000000,
      },
    ],
  },
];

// ─────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────

describe("getUserFinancialSummary", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Happy Path ─────────────────────────────

  it("Success — returns financial summaries for user", async () => {
    mockLean.mockResolvedValue(sampleFinancialSummary());

    const result = await service.getUserFinancialSummary({
      userID: USER_ID,
    });

    expect(result).toHaveLength(1);
    expect(result[0].UserID).toBe(USER_ID);
    expect(result[0].PeriodType).toBe("monthly");
    expect(mockFind).toHaveBeenCalledTimes(1);
  });

  it("Success — sorts by PeriodStart ascending", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserFinancialSummary({ userID: USER_ID });

    expect(mockSort).toHaveBeenCalledWith({ PeriodStart: 1 });
  });

  // ── Match conditions ───────────────────────

  it("Success — match includes UserID", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserFinancialSummary({ userID: USER_ID });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg.UserID).toBe(USER_ID);
  });

  it("Success — match includes WalletSummaries.WalletID when walletID is provided", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserFinancialSummary({
      userID: USER_ID,
      walletID: WALLET_ID,
    });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg["WalletSummaries.WalletID"]).toBe(WALLET_ID);
  });

  it("Success — match does not include WalletSummaries.WalletID when walletID is not provided", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserFinancialSummary({ userID: USER_ID });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg["WalletSummaries.WalletID"]).toBeUndefined();
  });

  // ── Date range filtering ───────────────────

  it("Success — applies PeriodStart/PeriodEnd range when range is provided", async () => {
    mockLean.mockResolvedValue([]);
    const rangeStart = new Date("2025-01-01");
    const rangeEnd = new Date("2025-06-30");

    await service.getUserFinancialSummary({
      userID: USER_ID,
      range: { start: rangeStart, end: rangeEnd },
    });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg.PeriodStart.$gte).toEqual(rangeStart);
    expect(findArg.PeriodEnd.$lte).toEqual(rangeEnd);
  });

  it("Success — does not include PeriodStart/PeriodEnd filter when range is not provided", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserFinancialSummary({ userID: USER_ID });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg.PeriodStart).toBeUndefined();
    expect(findArg.PeriodEnd).toBeUndefined();
  });

  // ── Projection (WalletSummaries) ───────────

  it("Success — uses $elemMatch for WalletSummaries when walletID is provided", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserFinancialSummary({
      userID: USER_ID,
      walletID: WALLET_ID,
    });

    const projection = mockFind.mock.calls[0][1];
    expect(projection.WalletSummaries).toEqual({
      $elemMatch: { WalletID: WALLET_ID },
    });
  });

  it("Success — returns all WalletSummaries when walletID is not provided", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserFinancialSummary({ userID: USER_ID });

    const projection = mockFind.mock.calls[0][1];
    expect(projection.WalletSummaries).toBe(1);
  });

  // ── Projection base fields ─────────────────

  it("Success — projection includes all required base fields", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserFinancialSummary({ userID: USER_ID });

    const projection = mockFind.mock.calls[0][1];
    expect(projection._id).toBe(0);
    expect(projection.UserID).toBe(1);
    expect(projection.PeriodType).toBe(1);
    expect(projection.PeriodKey).toBe(1);
    expect(projection.IncomeNow).toBe(1);
    expect(projection.ExpenseNow).toBe(1);
    expect(projection.ProfitNow).toBe(1);
    expect(projection.BalanceNow).toBe(1);
    expect(projection.SavingsRate).toBe(1);
    expect(projection.InvestmentSummary).toBe(1);
    expect(projection.NetWorth).toBe(1);
    expect(projection.TopExpenseCategories).toBe(1);
    expect(projection.TopIncomeCategories).toBe(1);
  });

  // ── Empty result ───────────────────────────

  it("Success — returns empty array when no summaries found", async () => {
    mockLean.mockResolvedValue([]);

    const result = await service.getUserFinancialSummary({
      userID: USER_ID,
    });

    expect(result).toHaveLength(0);
  });

  // ── Database Error ─────────────────────────

  it("Error — propagates database error", async () => {
    mockLean.mockRejectedValue(new Error("query timeout"));

    await expect(
      service.getUserFinancialSummary({ userID: USER_ID }),
    ).rejects.toThrow("query timeout");
  });
});
