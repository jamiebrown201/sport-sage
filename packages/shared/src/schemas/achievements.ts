import { z } from 'zod';

// =============================================================================
// ACHIEVEMENTS SCHEMAS
// =============================================================================

export const AchievementCategorySchema = z.enum([
  'predictions',
  'wins',
  'streaks',
  'sports',
  'accumulators',
  'social',
  'collector',
  'special',
]);
export type AchievementCategory = z.infer<typeof AchievementCategorySchema>;

export const AchievementTierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']);
export type AchievementTier = z.infer<typeof AchievementTierSchema>;

export const AchievementSchema = z.object({
  id: z.string(),
  category: AchievementCategorySchema,
  tier: AchievementTierSchema,
  name: z.string(),
  description: z.string(),
  iconName: z.string(),

  // Requirements
  requirement: z.object({
    type: z.string(), // 'total_predictions', 'win_streak', 'sport_wins', etc.
    value: z.number().int().positive(),
    sportSlug: z.string().optional(),
    additionalCriteria: z.record(z.unknown()).optional(),
  }),

  // Rewards
  rewardCoins: z.number().int().min(0),
  rewardStars: z.number().int().min(0),
  rewardGems: z.number().int().min(0),

  // Progression (for tiered achievements)
  nextTierId: z.string().optional(), // Links to next tier
  previousTierId: z.string().optional(),

  // Display
  isHidden: z.boolean().default(false), // Secret achievements
  sortOrder: z.number().int().default(0),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const UserAchievementSchema = z.object({
  achievementId: z.string(),
  achievement: AchievementSchema,
  userId: z.string(),
  currentProgress: z.number().int().min(0),
  targetProgress: z.number().int().positive(),
  progressPercentage: z.number().min(0).max(100),
  isUnlocked: z.boolean().default(false),
  unlockedAt: z.string().datetime().optional(),
  isClaimed: z.boolean().default(false),
  claimedAt: z.string().datetime().optional(),
});
export type UserAchievement = z.infer<typeof UserAchievementSchema>;

export const AchievementsResponseSchema = z.object({
  achievements: z.array(UserAchievementSchema),
  totalUnlocked: z.number().int(),
  totalAchievements: z.number().int(),
  recentUnlocks: z.array(UserAchievementSchema),
});
export type AchievementsResponse = z.infer<typeof AchievementsResponseSchema>;

export const ClaimAchievementResponseSchema = z.object({
  success: z.boolean(),
  coinsEarned: z.number().int().min(0),
  starsEarned: z.number().int().min(0),
  gemsEarned: z.number().int().min(0),
  newCoinsBalance: z.number().int(),
  newStarsBalance: z.number().int(),
  newGemsBalance: z.number().int(),
  nextTierAchievement: AchievementSchema.optional(),
});
export type ClaimAchievementResponse = z.infer<typeof ClaimAchievementResponseSchema>;

// Badge is a special type of achievement that can be displayed on profile
export const BadgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  iconName: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  achievementId: z.string().optional(), // If earned via achievement
  isEquipped: z.boolean().default(false),
});
export type Badge = z.infer<typeof BadgeSchema>;

export const UserBadgesSchema = z.object({
  badges: z.array(BadgeSchema),
  equippedBadgeId: z.string().optional(),
});
export type UserBadges = z.infer<typeof UserBadgesSchema>;
