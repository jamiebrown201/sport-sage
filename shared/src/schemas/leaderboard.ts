import { z } from 'zod';

// =============================================================================
// LEADERBOARD SCHEMAS
// =============================================================================

export const LeaderboardPeriodSchema = z.enum(['daily', 'weekly', 'monthly', 'all_time']);
export type LeaderboardPeriod = z.infer<typeof LeaderboardPeriodSchema>;

export const LeaderboardTypeSchema = z.enum(['stars', 'win_rate', 'streak', 'accumulators']);
export type LeaderboardType = z.infer<typeof LeaderboardTypeSchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  previousRank: z.number().int().positive().optional(), // For showing movement
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().url().optional(),
  subscriptionTier: z.enum(['free', 'pro', 'elite']),
  value: z.number(), // Stars earned, win rate %, streak count, etc.
  secondaryValue: z.number().optional(), // e.g., total predictions for context
  isCurrentUser: z.boolean().default(false),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardSchema = z.object({
  type: LeaderboardTypeSchema,
  period: LeaderboardPeriodSchema,
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  entries: z.array(LeaderboardEntrySchema),
  currentUserEntry: LeaderboardEntrySchema.optional(),
  totalParticipants: z.number().int(),
  lastUpdatedAt: z.string().datetime(),
});
export type Leaderboard = z.infer<typeof LeaderboardSchema>;

export const LeaderboardRewardSchema = z.object({
  rank: z.number().int().positive(),
  rankTo: z.number().int().positive().optional(), // For ranges like "4-10"
  coins: z.number().int().min(0),
  stars: z.number().int().min(0),
  gems: z.number().int().min(0),
  badgeId: z.string().optional(),
});
export type LeaderboardReward = z.infer<typeof LeaderboardRewardSchema>;

export const LeaderboardInfoSchema = z.object({
  type: LeaderboardTypeSchema,
  period: LeaderboardPeriodSchema,
  name: z.string(),
  description: z.string(),
  rewards: z.array(LeaderboardRewardSchema),
  endsAt: z.string().datetime(),
  minPredictionsToQualify: z.number().int().default(5),
});
export type LeaderboardInfo = z.infer<typeof LeaderboardInfoSchema>;
