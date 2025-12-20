import { z } from 'zod';

// =============================================================================
// TRANSACTIONS SCHEMAS
// =============================================================================

export const TransactionTypeSchema = z.enum([
  'prediction_stake',
  'prediction_win',
  'prediction_refund',
  'daily_topup',
  'ad_bonus',
  'achievement_reward',
  'challenge_reward',
  'leaderboard_reward',
  'shop_purchase',
  'gem_purchase',
  'subscription_bonus',
  'referral_bonus',
  'streak_bonus',
  'login_bonus',
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const CurrencyTypeSchema = z.enum(['coins', 'stars', 'gems']);
export type CurrencyType = z.infer<typeof CurrencyTypeSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: TransactionTypeSchema,
  currency: CurrencyTypeSchema,
  amount: z.number().int(), // Positive for credit, negative for debit
  balanceAfter: z.number().int().min(0),
  description: z.string(),
  referenceId: z.string().optional(), // e.g., prediction ID, achievement ID
  referenceType: z.string().optional(), // e.g., 'prediction', 'achievement'
  createdAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const TransactionHistoryFilterSchema = z.object({
  type: TransactionTypeSchema.optional(),
  currency: CurrencyTypeSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().default(1),
  pageSize: z.number().int().default(50),
});
export type TransactionHistoryFilter = z.infer<typeof TransactionHistoryFilterSchema>;

export const TransactionHistoryResponseSchema = z.object({
  transactions: z.array(TransactionSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type TransactionHistoryResponse = z.infer<typeof TransactionHistoryResponseSchema>;

// Daily topup tracking
export const DailyTopupStatusSchema = z.object({
  canTopup: z.boolean(),
  nextTopupAt: z.string().datetime().optional(),
  baseAmount: z.number().int(),
  streakBonus: z.number().int(),
  totalAmount: z.number().int(),
  currentStreak: z.number().int(),
});
export type DailyTopupStatus = z.infer<typeof DailyTopupStatusSchema>;
