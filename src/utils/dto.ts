import { z } from "zod";

//$ Zod schemas for validation
export const monthSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
  z.literal(12),
]);

export const daySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
  z.literal(12),
  z.literal(13),
  z.literal(14),
  z.literal(15),
  z.literal(16),
  z.literal(17),
  z.literal(18),
  z.literal(19),
  z.literal(20),
  z.literal(21),
  z.literal(22),
  z.literal(23),
  z.literal(24),
  z.literal(25),
  z.literal(26),
  z.literal(27),
  z.literal(28),
  z.literal(29),
  z.literal(30),
  z.literal(31),
]);

export const getUserTransactionSchema = z.object({
  userID: z.string(),
  walletID: z.string().optional(),
  dateOption: z.object({
    date: z.coerce.date().optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    month: monthSchema.optional(),
    day: daySchema.optional(),
    range: z
      .object({
        start: z.coerce.date().optional(),
        end: z.coerce.date().optional(),
      })
      .optional(),
  }),
});

export const getCategoryTransactionsSchema = z.object({
  userID: z.string(),
  categoryID: z.string(),
  walletID: z.string().optional(),
  dateOption: z.object({
    date: z.coerce.date().optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    month: monthSchema.optional(),
    day: daySchema.optional(),
    range: z
      .object({
        start: z.coerce.date().optional(),
        end: z.coerce.date().optional(),
      })
      .optional(),
  }),
});

export const getUserBalanceSchema = z.object({
  userID: z.string(),
  walletID: z.string().optional(),
  aggregation: z.enum(["daily", "weekly", "monthly"]),
  range: z
    .object({
      start: z.coerce.date(),
      end: z.coerce.date(),
    })
    .optional(),
});

export const getUserFinancialSummarySchema = z.object({
  userID: z.string(),
  walletID: z.string().optional(),
  range: z
    .object({
      start: z.coerce.date(),
      end: z.coerce.date(),
    })
    .optional(),
});

export const getUserNetWorthCompositionSchema = z.object({
  userID: z.string(),
});

export const initialSyncSchema = z.object({
  secretKey: z.string().min(1, "Secret key is required"),
  userID: z.string().optional(),
});

export const walletSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string(),
  number: z.string(),
  balance: z.number().min(0),
  wallet_type_id: z.uuid(),
  wallet_type: z.string(),
  wallet_type_name: z.string(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export const transactionSchema = z.object({
  id: z.uuid(),
  wallet_id: z.uuid({ error: "Invalid wallet ID" }),
  amount: z.number().min(0),
  category_id: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
      message: "Invalid category ID format",
    }),
  category_name: z.string(),
  category_type: z.string(),
  parent_category_name: z.string().optional().default(""),
  transaction_date: z.coerce.date(),
  description: z.string(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  attachments: z.array(z.string()).nullable().default([]),
});

export const investmentBuySchema = z.object({
  id: z.string(),
  code: z.string(),
  userId: z.string(),
  quantity: z.coerce.number(),
  initialValuation: z.coerce.number(),
  amount: z.coerce.number(),
  date: z.coerce.date(),
  description: z.string(),
  assetCode: z.object({
    code: z.string(),
    name: z.string(),
    unit: z.string().nullish(),
    toUSD: z.coerce.number().nullish(),
    toEUR: z.coerce.number().nullish(),
    toIDR: z.coerce.number().nullish(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const investmentSellItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  investmentId: z.string(),
  quantity: z.coerce.number(),
  sellPrice: z.coerce.number(),
  amount: z.coerce.number(),
  date: z.coerce.date(),
  description: z.string(),
  deficit: z.coerce.number(),
  assetCode: z.object({
    code: z.string(),
    name: z.string(),
    unit: z.string().nullish(),
    toUSD: z.coerce.number().nullish(),
    toEUR: z.coerce.number().nullish(),
    toIDR: z.coerce.number().nullish(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const investmentSellSchema = z.array(investmentSellItemSchema);

// Keep backward-compatible alias for initial-sync
export const investmentSchema = investmentBuySchema;

//$ Infer types from schemas
export type getUserTransactionType = z.infer<typeof getUserTransactionSchema>;
export type getCategoryTransactionsType = z.infer<
  typeof getCategoryTransactionsSchema
>;
export type getUserBalanceType = z.infer<typeof getUserBalanceSchema>;
export type getUserFinancialSummaryType = z.infer<
  typeof getUserFinancialSummarySchema
>;
export type getUserNetWorthCompositionType = z.infer<
  typeof getUserNetWorthCompositionSchema
>;
export type initialSyncType = z.infer<typeof initialSyncSchema>;
export type month = z.infer<typeof monthSchema>;
export type day = z.infer<typeof daySchema>;
export type walletType = z.infer<typeof walletSchema>;
export type transactionType = z.infer<typeof transactionSchema>;
export type investmentType = z.infer<typeof investmentSchema>;
export type investmentBuyType = z.infer<typeof investmentBuySchema>;
export type investmentSellItemType = z.infer<typeof investmentSellItemSchema>;
export type investmentSellType = z.infer<typeof investmentSellSchema>;

export type EventHandler = (
  routingKey: string,
  payload: unknown,
) => void | Promise<void>;
