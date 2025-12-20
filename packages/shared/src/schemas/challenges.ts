import { z } from 'zod';

// =============================================================================
// DAILY CHALLENGES SCHEMAS
// =============================================================================

export const ChallengeTypeSchema = z.enum([
  'win_predictions',
  'place_predictions',
  'win_accumulator',
  'predict_sport',
  'predict_live',
  'win_streak',
  'odds_range',
  'specific_market',
]);
export type ChallengeType = z.infer<typeof ChallengeTypeSchema>;

export const ChallengeDifficultySchema = z.enum(['easy', 'medium', 'hard']);
export type ChallengeDifficulty = z.infer<typeof ChallengeDifficultySchema>;

export const ChallengeSchema = z.object({
  id: z.string(),
  type: ChallengeTypeSchema,
  difficulty: ChallengeDifficultySchema,
  title: z.string(),
  description: z.string(),
  iconName: z.string(),

  // Requirements
  targetValue: z.number().int().positive(), // e.g., win 3 predictions
  sportSlug: z.string().optional(), // If challenge is sport-specific
  marketType: z.string().optional(), // If challenge requires specific market
  minOdds: z.number().positive().optional(),
  maxOdds: z.number().positive().optional(),
  requireLive: z.boolean().optional(),
  requireAccumulator: z.boolean().optional(),

  // Rewards
  rewardCoins: z.number().int().min(0),
  rewardStars: z.number().int().min(0),
  rewardGems: z.number().int().min(0),
  rewardBadgeId: z.string().optional(),

  // Timing
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),

  // Display
  sortOrder: z.number().int().default(0),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const UserChallengeProgressSchema = z.object({
  challengeId: z.string(),
  challenge: ChallengeSchema,
  userId: z.string(),
  currentValue: z.number().int().min(0),
  targetValue: z.number().int().positive(),
  isCompleted: z.boolean().default(false),
  isClaimed: z.boolean().default(false),
  completedAt: z.string().datetime().optional(),
  claimedAt: z.string().datetime().optional(),
});
export type UserChallengeProgress = z.infer<typeof UserChallengeProgressSchema>;

export const DailyChallengesResponseSchema = z.object({
  challenges: z.array(UserChallengeProgressSchema),
  refreshesAt: z.string().datetime(),
  bonusMultiplier: z.number().positive().default(1.0), // For premium users
});
export type DailyChallengesResponse = z.infer<typeof DailyChallengesResponseSchema>;

export const ClaimChallengeResponseSchema = z.object({
  success: z.boolean(),
  coinsEarned: z.number().int().min(0),
  starsEarned: z.number().int().min(0),
  gemsEarned: z.number().int().min(0),
  badgeUnlocked: z.string().optional(),
  newCoinsBalance: z.number().int(),
  newStarsBalance: z.number().int(),
  newGemsBalance: z.number().int(),
});
export type ClaimChallengeResponse = z.infer<typeof ClaimChallengeResponseSchema>;

// Weekly challenges with bigger rewards
export const WeeklyChallengeSchema = ChallengeSchema.extend({
  isWeekly: z.literal(true),
  requiredDailyChallenges: z.number().int().min(0).optional(), // Complete X daily challenges
});
export type WeeklyChallenge = z.infer<typeof WeeklyChallengeSchema>;
