// ─────────────────────────────────────────────────────────────
// getUserBalance.test.ts
// Unit test untuk: getUserBalance (daily, weekly, monthly)
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
const mockAggregate = jest.fn<(...args: any[]) => any>();

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
    find: mockFind,
    aggregate: mockAggregate,
  },
  userFinancialSummariesModel: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn() }),
    }),
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

const sampleDailyBalance = () => [
  {
    WalletID: WALLET_ID,
    WalletName: "Bank A",
    Date: new Date("2025-01-01"),
    Year: 2025,
    Month: 1,
    Day: 1,
    OpeningBalance: 1000000,
    ClosingBalance: 1100000,
    TotalIncome: 200000,
    TotalExpense: 100000,
    NetChange: 100000,
    TransactionCount: 5,
  },
];

const sampleWeeklyBalance = () => [
  {
    Year: 2025,
    Week: 1,
    OpeningBalance: 1000000,
    ClosingBalance: 1500000,
    TotalIncome: 800000,
    TotalExpense: 300000,
    NetChange: 500000,
    TotalTransactions: 20,
  },
];

const sampleMonthlyBalance = () => [
  {
    Year: 2025,
    Month: 1,
    OpeningBalance: 1000000,
    ClosingBalance: 2000000,
    TotalIncome: 2000000,
    TotalExpense: 1000000,
    NetChange: 1000000,
    TotalTransactions: 50,
  },
];

// ─────────────────────────────────────────────
// Test Cases — DAILY aggregation
// ─────────────────────────────────────────────

describe("getUserBalance — daily", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Success — returns daily balances using find().sort().lean()", async () => {
    mockLean.mockResolvedValue(sampleDailyBalance());

    const result = await service.getUserBalance({
      userID: USER_ID,
      aggregation: "daily",
    });

    expect(result).toHaveLength(1);
    expect(result[0].WalletName).toBe("Bank A");
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockSort).toHaveBeenCalledWith({ Date: 1 });
  });

  it("Success — applies UserID to match conditions", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "daily",
    });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg.UserID).toBe(USER_ID);
  });

  it("Success — applies WalletID when provided", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      walletID: WALLET_ID,
      aggregation: "daily",
    });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg.WalletID).toBe(WALLET_ID);
  });

  it("Success — does not include WalletID when not provided", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "daily",
    });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg.WalletID).toBeUndefined();
  });

  it("Success — applies date range filter when range is provided", async () => {
    mockLean.mockResolvedValue([]);
    const rangeStart = new Date("2025-01-01");
    const rangeEnd = new Date("2025-01-31");

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "daily",
      range: { start: rangeStart, end: rangeEnd },
    });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg.Date.$gte).toEqual(rangeStart);
    expect(findArg.Date.$lte).toEqual(rangeEnd);
  });

  it("Success — no date filter when range is not provided", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "daily",
    });

    const findArg = mockFind.mock.calls[0][0];
    expect(findArg.Date).toBeUndefined();
  });

  it("Success — returns empty array when no balances found", async () => {
    mockLean.mockResolvedValue([]);

    const result = await service.getUserBalance({
      userID: USER_ID,
      aggregation: "daily",
    });

    expect(result).toHaveLength(0);
  });

  it("Success — projection includes required fields", async () => {
    mockLean.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "daily",
    });

    const projection = mockFind.mock.calls[0][1];
    expect(projection._id).toBe(0);
    expect(projection.WalletID).toBe(1);
    expect(projection.OpeningBalance).toBe(1);
    expect(projection.ClosingBalance).toBe(1);
    expect(projection.TotalIncome).toBe(1);
    expect(projection.TotalExpense).toBe(1);
    expect(projection.NetChange).toBe(1);
  });

  it("Error — propagates database error", async () => {
    mockLean.mockRejectedValue(new Error("db connection failed"));

    await expect(
      service.getUserBalance({
        userID: USER_ID,
        aggregation: "daily",
      }),
    ).rejects.toThrow("db connection failed");
  });
});

// ─────────────────────────────────────────────
// Test Cases — WEEKLY aggregation
// ─────────────────────────────────────────────

describe("getUserBalance — weekly", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Success — returns weekly aggregated balances", async () => {
    mockAggregate.mockResolvedValue(sampleWeeklyBalance());

    const result = await service.getUserBalance({
      userID: USER_ID,
      aggregation: "weekly",
    });

    expect(result).toHaveLength(1);
    expect(result[0].Year).toBe(2025);
    expect(result[0].Week).toBe(1);
    expect(mockAggregate).toHaveBeenCalledTimes(1);
  });

  it("Success — pipeline contains $match, $sort, $group, $sort, $project stages", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "weekly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline).toHaveLength(5);
    expect(pipeline[0]).toHaveProperty("$match");
    expect(pipeline[1]).toHaveProperty("$sort");
    expect(pipeline[2]).toHaveProperty("$group");
    expect(pipeline[3]).toHaveProperty("$sort");
    expect(pipeline[4]).toHaveProperty("$project");
  });

  it("Success — $group groups by Year and Week", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "weekly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const groupStage = pipeline[2].$group;
    expect(groupStage._id).toHaveProperty("Year");
    expect(groupStage._id).toHaveProperty("Week");
  });

  it("Success — includes WalletID/WalletName in group when no walletID filter", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "weekly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const groupStage = pipeline[2].$group;
    expect(groupStage._id).toHaveProperty("WalletID");
    expect(groupStage._id).toHaveProperty("WalletName");
  });

  it("Success — excludes WalletID/WalletName from group when walletID is provided", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      walletID: WALLET_ID,
      aggregation: "weekly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const groupStage = pipeline[2].$group;
    expect(groupStage._id.WalletID).toBeUndefined();
    expect(groupStage._id.WalletName).toBeUndefined();
  });

  it("Success — applies date range in $match when range provided", async () => {
    const rangeStart = new Date("2025-01-01");
    const rangeEnd = new Date("2025-03-31");
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "weekly",
      range: { start: rangeStart, end: rangeEnd },
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage.Date.$gte).toEqual(rangeStart);
    expect(matchStage.Date.$lte).toEqual(rangeEnd);
  });

  it("Success — returns empty array when no data", async () => {
    mockAggregate.mockResolvedValue([]);

    const result = await service.getUserBalance({
      userID: USER_ID,
      aggregation: "weekly",
    });

    expect(result).toHaveLength(0);
  });

  it("Error — propagates database error", async () => {
    mockAggregate.mockRejectedValue(new Error("aggregation timeout"));

    await expect(
      service.getUserBalance({
        userID: USER_ID,
        aggregation: "weekly",
      }),
    ).rejects.toThrow("aggregation timeout");
  });
});

// ─────────────────────────────────────────────
// Test Cases — MONTHLY aggregation
// ─────────────────────────────────────────────

describe("getUserBalance — monthly", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Success — returns monthly aggregated balances", async () => {
    mockAggregate.mockResolvedValue(sampleMonthlyBalance());

    const result = await service.getUserBalance({
      userID: USER_ID,
      aggregation: "monthly",
    });

    expect(result).toHaveLength(1);
    expect(result[0].Year).toBe(2025);
    expect(result[0].Month).toBe(1);
    expect(mockAggregate).toHaveBeenCalledTimes(1);
  });

  it("Success — pipeline contains $match, $sort, $group, $sort, $project stages", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "monthly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline).toHaveLength(5);
    expect(pipeline[0]).toHaveProperty("$match");
    expect(pipeline[1]).toHaveProperty("$sort");
    expect(pipeline[2]).toHaveProperty("$group");
    expect(pipeline[3]).toHaveProperty("$sort");
    expect(pipeline[4]).toHaveProperty("$project");
  });

  it("Success — $group groups by Year and Month", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "monthly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const groupStage = pipeline[2].$group;
    expect(groupStage._id).toHaveProperty("Year");
    expect(groupStage._id).toHaveProperty("Month");
  });

  it("Success — includes WalletID/WalletName in group when no walletID filter", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "monthly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const groupStage = pipeline[2].$group;
    expect(groupStage._id).toHaveProperty("WalletID");
    expect(groupStage._id).toHaveProperty("WalletName");
  });

  it("Success — excludes WalletID/WalletName from group when walletID is provided", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      walletID: WALLET_ID,
      aggregation: "monthly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const groupStage = pipeline[2].$group;
    expect(groupStage._id.WalletID).toBeUndefined();
    expect(groupStage._id.WalletName).toBeUndefined();
  });

  it("Success — excludes WalletID/WalletName from $project when walletID is provided", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      walletID: WALLET_ID,
      aggregation: "monthly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const projectStage = pipeline[4].$project;
    expect(projectStage.WalletID).toBeUndefined();
    expect(projectStage.WalletName).toBeUndefined();
  });

  it("Success — includes WalletID/WalletName in $project when no walletID filter", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "monthly",
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const projectStage = pipeline[4].$project;
    expect(projectStage).toHaveProperty("WalletID");
    expect(projectStage).toHaveProperty("WalletName");
  });

  it("Success — applies date range in $match when range provided", async () => {
    const rangeStart = new Date("2025-01-01");
    const rangeEnd = new Date("2025-06-30");
    mockAggregate.mockResolvedValue([]);

    await service.getUserBalance({
      userID: USER_ID,
      aggregation: "monthly",
      range: { start: rangeStart, end: rangeEnd },
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage.Date.$gte).toEqual(rangeStart);
    expect(matchStage.Date.$lte).toEqual(rangeEnd);
  });

  it("Error — propagates database error", async () => {
    mockAggregate.mockRejectedValue(new Error("mongo down"));

    await expect(
      service.getUserBalance({
        userID: USER_ID,
        aggregation: "monthly",
      }),
    ).rejects.toThrow("mongo down");
  });
});
