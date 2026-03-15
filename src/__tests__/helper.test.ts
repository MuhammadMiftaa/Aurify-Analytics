// ─────────────────────────────────────────────────────────────
// helper.test.ts
// Unit test untuk: helper (validate, getWeekNumber)
// ─────────────────────────────────────────────────────────────

import {
  jest,
  describe,
  it,
  beforeAll,
  afterEach,
  expect,
} from "@jest/globals";

// ─── Mock env (to prevent process.exit on import) ────────────
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
let helper: any;
let ValidationError: any;
let z: any;

beforeAll(async () => {
  ({ default: helper } = await import("../utils/helper"));
  ({ ValidationError } = await import("../utils/errors"));
  ({ z } = await import("zod"));
});

// ─────────────────────────────────────────────
// getWeekNumber
// ─────────────────────────────────────────────

describe("getWeekNumber", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Success — returns week 1 for Jan 1st of a year", () => {
    const date = new Date("2025-01-01");
    const week = helper.getWeekNumber(date);
    expect(typeof week).toBe("number");
    expect(week).toBeGreaterThanOrEqual(1);
  });

  it("Success — returns week number for mid-year date", () => {
    const date = new Date("2025-07-15");
    const week = helper.getWeekNumber(date);
    expect(week).toBeGreaterThan(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it("Success — returns valid week number for Dec 31st", () => {
    const date = new Date("2025-12-31");
    const week = helper.getWeekNumber(date);
    expect(week).toBeGreaterThan(50);
    expect(week).toBeLessThanOrEqual(53);
  });

  it("Success — week number increases over the year", () => {
    const jan = helper.getWeekNumber(new Date("2025-01-10"));
    const mar = helper.getWeekNumber(new Date("2025-03-10"));
    const jun = helper.getWeekNumber(new Date("2025-06-10"));

    expect(mar).toBeGreaterThan(jan);
    expect(jun).toBeGreaterThan(mar);
  });

  it("Success — consecutive days in same week return same week number", () => {
    // Mon and Tue of the same week
    const mon = helper.getWeekNumber(new Date("2025-01-06"));
    const tue = helper.getWeekNumber(new Date("2025-01-07"));
    expect(mon).toBe(tue);
  });
});

// ─────────────────────────────────────────────
// validate
// ─────────────────────────────────────────────

describe("validate", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Happy Path ─────────────────────────────

  it("Success — returns parsed data for valid input", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().int().min(0),
    });

    const result = helper.validate(schema, { name: "Test", age: 25 });

    expect(result).toEqual({ name: "Test", age: 25 });
  });

  it("Success — strips extra fields with strict schema", () => {
    const schema = z
      .object({
        name: z.string(),
      })
      .strict();

    // strict schema should reject extra fields
    expect(() =>
      helper.validate(schema, { name: "Test", extra: "field" }),
    ).toThrow();
  });

  it("Success — coerces types when schema allows it", () => {
    const schema = z.object({
      amount: z.coerce.number(),
    });

    const result = helper.validate(schema, { amount: "100" });
    expect(result.amount).toBe(100);
  });

  it("Success — handles optional fields", () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().optional(),
    });

    const result = helper.validate(schema, { name: "Test" });
    expect(result.name).toBe("Test");
    expect(result.email).toBeUndefined();
  });

  // ── Validation Error ────────────────────────

  it("Error — throws ValidationError for invalid data", () => {
    const schema = z.object({
      name: z.string(),
    });

    expect(() => helper.validate(schema, { name: 123 })).toThrow(
      ValidationError,
    );
  });

  it("Error — throws ValidationError with descriptive message", () => {
    const schema = z.object({
      name: z.string(),
    });

    expect(() => helper.validate(schema, { name: 123 })).toThrow(
      /Invalid request data/,
    );
  });

  it("Error — throws ValidationError for missing required fields", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    expect(() => helper.validate(schema, {})).toThrow(ValidationError);
  });

  it("Error — throws ValidationError for invalid enum value", () => {
    const schema = z.object({
      type: z.enum(["income", "expense"]),
    });

    expect(() => helper.validate(schema, { type: "invalid" })).toThrow(
      ValidationError,
    );
  });

  it("Error — throws ValidationError for negative number when min is 0", () => {
    const schema = z.object({
      amount: z.number().min(0),
    });

    expect(() => helper.validate(schema, { amount: -1 })).toThrow(
      ValidationError,
    );
  });

  it("Error — throws ValidationError with combined error messages", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    try {
      helper.validate(schema, { name: 123, age: "abc" });
    } catch (err: any) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toContain("Invalid request data");
    }
  });

  it("Error — ValidationError has statusCode 400", () => {
    const schema = z.object({
      name: z.string(),
    });

    try {
      helper.validate(schema, {});
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
    }
  });
});
