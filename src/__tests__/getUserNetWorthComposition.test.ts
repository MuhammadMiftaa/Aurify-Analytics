// ─────────────────────────────────────────────────────────────
// getUserNetWorthComposition.test.ts
// Unit test untuk: getUserNetWorthComposition
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
const mockFindOne = jest.fn<(...args: any[]) => any>();
const mockSort = jest.fn<(...args: any[]) => any>();
const mockLean = jest.fn<(...args: any[]) => any>();

// Chainable: findOne().sort().lean()
mockSort.mockReturnValue({ lean: mockLean });
mockFindOne.mockReturnValue({ sort: mockSort });

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
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn() }),
    }),
  },
  userNetWorthCompositionModel: {
    findOne: mockFindOne,
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
const FIXED_DATE = new Date("2025-01-15T00:00:00.000Z");

const sampleNetWorthComposition = () => ({
  UserID: USER_ID,
  Total: 15500000,
  Slices: [
    {
      Label: "Wallet",
      Amount: 10000000,
      Percentage: 64.5,
      Details: {
        ItemCount: 3,
        Description: "3 wallets",
      },
    },
    {
      Label: "Investment",
      Amount: 5500000,
      Percentage: 35.5,
      Details: {
        ItemCount: 2,
        Description: "2 active positions",
        UnrealizedGain: 500000,
      },
    },
  ],
  CreatedAt: FIXED_DATE,
  UpdatedAt: FIXED_DATE,
});

// ─────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────

describe("getUserNetWorthComposition", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Happy Path ─────────────────────────────

  it("Success — returns net worth composition for user", async () => {
    mockLean.mockResolvedValue(sampleNetWorthComposition());

    const result = await service.getUserNetWorthComposition({
      userID: USER_ID,
    });

    expect(result.UserID).toBe(USER_ID);
    expect(result.Total).toBe(15500000);
    expect(result.Slices).toHaveLength(2);
    expect(mockFindOne).toHaveBeenCalledTimes(1);
  });

  it("Success — Slices contain Wallet and Investment labels", async () => {
    mockLean.mockResolvedValue(sampleNetWorthComposition());

    const result = await service.getUserNetWorthComposition({
      userID: USER_ID,
    });

    const labels = result.Slices.map((s: any) => s.Label);
    expect(labels).toContain("Wallet");
    expect(labels).toContain("Investment");
  });

  it("Success — each Slice has Amount and Percentage", async () => {
    mockLean.mockResolvedValue(sampleNetWorthComposition());

    const result = await service.getUserNetWorthComposition({
      userID: USER_ID,
    });

    for (const slice of result.Slices) {
      expect(slice).toHaveProperty("Amount");
      expect(slice).toHaveProperty("Percentage");
      expect(typeof slice.Amount).toBe("number");
      expect(typeof slice.Percentage).toBe("number");
    }
  });

  // ── Query verification ─────────────────────

  it("Success — findOne is called with UserID filter", async () => {
    mockLean.mockResolvedValue(null);

    await service.getUserNetWorthComposition({ userID: USER_ID });

    const findOneArg = mockFindOne.mock.calls[0][0];
    expect(findOneArg).toEqual({ UserID: USER_ID });
  });

  it("Success — projection includes required fields and excludes _id", async () => {
    mockLean.mockResolvedValue(null);

    await service.getUserNetWorthComposition({ userID: USER_ID });

    const projection = mockFindOne.mock.calls[0][1];
    expect(projection._id).toBe(0);
    expect(projection.UserID).toBe(1);
    expect(projection.Total).toBe(1);
    expect(projection.Slices).toBe(1);
    expect(projection.CreatedAt).toBe(1);
    expect(projection.UpdatedAt).toBe(1);
  });

  it("Success — sorts by UpdatedAt descending to get latest", async () => {
    mockLean.mockResolvedValue(null);

    await service.getUserNetWorthComposition({ userID: USER_ID });

    expect(mockSort).toHaveBeenCalledWith({ UpdatedAt: -1 });
  });

  // ── Null result ────────────────────────────

  it("Success — returns null when no composition found for user", async () => {
    mockLean.mockResolvedValue(null);

    const result = await service.getUserNetWorthComposition({
      userID: USER_ID,
    });

    expect(result).toBeNull();
  });

  // ── Database Error ─────────────────────────

  it("Error — propagates database error", async () => {
    mockLean.mockRejectedValue(new Error("connection reset"));

    await expect(
      service.getUserNetWorthComposition({ userID: USER_ID }),
    ).rejects.toThrow("connection reset");
  });
});
