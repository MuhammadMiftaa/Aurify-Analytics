// ─────────────────────────────────────────────────────────────
// getUserTransaction.test.ts
// Unit test untuk: getUserTransaction
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
const mockAggregate = jest.fn<(...args: any[]) => any>();

jest.unstable_mockModule("../utils/model", () => ({
  userTransactionModel: {
    aggregate: mockAggregate,
  },
  userBalanceModel: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn() }),
    }),
    aggregate: jest.fn(),
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
const FIXED_DATE = new Date("2025-01-15T00:00:00.000Z");

const sampleTransactionResult = () => [
  {
    CategoryID: "cat-1",
    CategoryName: "Food",
    CategoryType: "expense",
    TotalAmount: 500000,
    TotalTransactions: 10,
  },
  {
    CategoryID: "cat-2",
    CategoryName: "Salary",
    CategoryType: "income",
    TotalAmount: 5000000,
    TotalTransactions: 1,
  },
];

// ─────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────

describe("getUserTransaction", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Happy Path: No filter (ALL TIME) ───────

  it("Success — returns aggregated transactions without date filter (ALL TIME)", async () => {
    mockAggregate.mockResolvedValue(sampleTransactionResult());

    const result = await service.getUserTransaction({
      userID: USER_ID,
      dateOption: {},
    });

    expect(result).toHaveLength(2);
    expect(result[0].CategoryName).toBe("Food");
    expect(result[1].CategoryName).toBe("Salary");
    expect(mockAggregate).toHaveBeenCalledTimes(1);
  });

  it("Success — match conditions only include UserID for ALL TIME", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: {},
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage).toEqual({ UserID: USER_ID });
  });

  // ── Happy Path: Wallet filtering ──────────

  it("Success — includes WalletID in match when walletID is provided", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      walletID: WALLET_ID,
      dateOption: {},
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage.WalletID).toBe(WALLET_ID);
  });

  it("Success — does not include WalletID when walletID is undefined", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: {},
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage.WalletID).toBeUndefined();
  });

  // ── Happy Path: Exact date (priority 1) ────

  it("Success — uses exact Date when dateOption.date is provided", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: { date: FIXED_DATE },
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage.Date).toEqual(FIXED_DATE);
  });

  // ── Happy Path: Date range (priority 2) ────

  it("Success — uses date range ($gte/$lte) when range.start and range.end are provided", async () => {
    const rangeStart = new Date("2025-01-01");
    const rangeEnd = new Date("2025-01-31");
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: { range: { start: rangeStart, end: rangeEnd } },
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage.Date.$gte).toEqual(rangeStart);
    expect(matchStage.Date.$lte).toEqual(rangeEnd);
  });

  // ── Happy Path: Year + Month + Day (priority 3) ─

  it("Success — uses Year+Month+Day when all three are provided", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: { year: 2025, month: 1, day: 15 },
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage.Year).toBe(2025);
    expect(matchStage.Month).toBe(1);
    expect(matchStage.Day).toBe(15);
  });

  // ── Happy Path: Year + Month (priority 4) ──

  it("Success — uses Year+Month when year and month are provided without day", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: { year: 2025, month: 6 },
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage.Year).toBe(2025);
    expect(matchStage.Month).toBe(6);
    expect(matchStage.Day).toBeUndefined();
  });

  // ── Happy Path: Year only (priority 5) ─────

  it("Success — uses Year only when only year is provided", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: { year: 2025 },
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    expect(matchStage.Year).toBe(2025);
    expect(matchStage.Month).toBeUndefined();
  });

  // ── Priority order: date > range ───────────

  it("Priority — exact date takes priority over date range", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: {
        date: FIXED_DATE,
        range: { start: new Date("2025-01-01"), end: new Date("2025-01-31") },
      },
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline[0].$match;
    // Exact date should win; no $gte/$lte
    expect(matchStage.Date).toEqual(FIXED_DATE);
  });

  // ── Aggregation pipeline structure ─────────

  it("Success — pipeline contains $match, $group, $sort, $project stages", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: {},
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline).toHaveLength(4);
    expect(pipeline[0]).toHaveProperty("$match");
    expect(pipeline[1]).toHaveProperty("$group");
    expect(pipeline[2]).toHaveProperty("$sort");
    expect(pipeline[3]).toHaveProperty("$project");
  });

  it("Success — $group groups by CategoryID, CategoryName, CategoryType", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: {},
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const groupStage = pipeline[1].$group;
    expect(groupStage._id).toHaveProperty("CategoryID");
    expect(groupStage._id).toHaveProperty("CategoryName");
    expect(groupStage._id).toHaveProperty("CategoryType");
  });

  it("Success — $sort sorts by TotalAmount descending", async () => {
    mockAggregate.mockResolvedValue([]);

    await service.getUserTransaction({
      userID: USER_ID,
      dateOption: {},
    });

    const pipeline = mockAggregate.mock.calls[0][0];
    const sortStage = pipeline[2].$sort;
    expect(sortStage.TotalAmount).toBe(-1);
  });

  // ── Empty result ───────────────────────────

  it("Success — returns empty array when no matching transactions", async () => {
    mockAggregate.mockResolvedValue([]);

    const result = await service.getUserTransaction({
      userID: USER_ID,
      dateOption: {},
    });

    expect(result).toHaveLength(0);
  });

  // ── Database Error ─────────────────────────

  it("Error — propagates database error", async () => {
    mockAggregate.mockRejectedValue(new Error("aggregation failed"));

    await expect(
      service.getUserTransaction({
        userID: USER_ID,
        dateOption: {},
      }),
    ).rejects.toThrow("aggregation failed");
  });
});
