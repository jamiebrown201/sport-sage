import { z } from 'zod';
import { UserSchema, UserStatsSchema } from './user';
import { PredictionSchema } from './predictions';

// =============================================================================
// SOCIAL SCHEMAS
// =============================================================================

export const FriendshipStatusSchema = z.enum(['pending', 'accepted', 'blocked']);
export type FriendshipStatus = z.infer<typeof FriendshipStatusSchema>;

export const FriendshipSchema = z.object({
  id: z.string(),
  requesterId: z.string(),
  addresseeId: z.string(),
  status: FriendshipStatusSchema,
  createdAt: z.string().datetime(),
  acceptedAt: z.string().datetime().optional(),
});
export type Friendship = z.infer<typeof FriendshipSchema>;

export const FriendProfileSchema = z.object({
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().url().optional(),
  subscriptionTier: z.enum(['free', 'pro', 'elite']),
  stats: UserStatsSchema.pick({
    totalPredictions: true,
    winRate: true,
    currentStreak: true,
    bestStreak: true,
  }),
  isOnline: z.boolean().default(false),
  lastActiveAt: z.string().datetime().optional(),
  equippedBadgeId: z.string().optional(),
});
export type FriendProfile = z.infer<typeof FriendProfileSchema>;

export const FriendsListResponseSchema = z.object({
  friends: z.array(FriendProfileSchema),
  pendingRequests: z.array(z.object({
    friendship: FriendshipSchema,
    user: FriendProfileSchema,
  })),
  sentRequests: z.array(z.object({
    friendship: FriendshipSchema,
    user: FriendProfileSchema,
  })),
});
export type FriendsListResponse = z.infer<typeof FriendsListResponseSchema>;

// Activity feed
export const ActivityTypeSchema = z.enum([
  'prediction_placed',
  'prediction_won',
  'accumulator_won',
  'achievement_unlocked',
  'challenge_completed',
  'streak_milestone',
  'leaderboard_rank',
  'friend_joined',
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ActivityFeedItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().url().optional(),
  type: ActivityTypeSchema,
  title: z.string(),
  description: z.string().optional(),

  // Optional references
  predictionId: z.string().optional(),
  achievementId: z.string().optional(),

  // For rich preview
  metadata: z.record(z.unknown()).optional(),

  createdAt: z.string().datetime(),
});
export type ActivityFeedItem = z.infer<typeof ActivityFeedItemSchema>;

export const ActivityFeedResponseSchema = z.object({
  items: z.array(ActivityFeedItemSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});
export type ActivityFeedResponse = z.infer<typeof ActivityFeedResponseSchema>;

// Sharing predictions
export const ShareablePredictionSchema = z.object({
  predictionId: z.string(),
  prediction: PredictionSchema,
  shareCode: z.string(),
  shareUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});
export type ShareablePrediction = z.infer<typeof ShareablePredictionSchema>;

// User search
export const UserSearchResultSchema = z.object({
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().url().optional(),
  subscriptionTier: z.enum(['free', 'pro', 'elite']),
  isFriend: z.boolean(),
  hasPendingRequest: z.boolean(),
});
export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;

export const UserSearchResponseSchema = z.object({
  results: z.array(UserSearchResultSchema),
  total: z.number().int(),
});
export type UserSearchResponse = z.infer<typeof UserSearchResponseSchema>;

// Referral system
export const ReferralSchema = z.object({
  id: z.string(),
  referrerId: z.string(),
  referredUserId: z.string(),
  referralCode: z.string(),
  status: z.enum(['pending', 'completed', 'rewarded']),
  rewardCoins: z.number().int(),
  rewardGems: z.number().int(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type Referral = z.infer<typeof ReferralSchema>;

export const ReferralInfoSchema = z.object({
  referralCode: z.string(),
  referralUrl: z.string().url(),
  totalReferrals: z.number().int(),
  pendingReferrals: z.number().int(),
  totalEarned: z.object({
    coins: z.number().int(),
    gems: z.number().int(),
  }),
  rewardPerReferral: z.object({
    coins: z.number().int(),
    gems: z.number().int(),
  }),
});
export type ReferralInfo = z.infer<typeof ReferralInfoSchema>;
