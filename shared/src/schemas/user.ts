import { z } from 'zod';

// =============================================================================
// USER & AUTH SCHEMAS
// =============================================================================

export const SubscriptionTierSchema = z.enum(['free', 'pro', 'elite']);
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export const UserSchema = z.object({
  id: z.string(),
  username: z.string().min(3).max(20),
  email: z.string().email(),
  coins: z.number().int().min(0),
  stars: z.number().int().min(0),
  gems: z.number().int().min(0),
  subscriptionTier: SubscriptionTierSchema,
  subscriptionExpiresAt: z.string().datetime().optional(),
  isAdsEnabled: z.boolean(),
  isOver18: z.boolean(),
  showAffiliates: z.boolean(),
  avatarUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const UserStatsSchema = z.object({
  userId: z.string(),
  totalPredictions: z.number().int().min(0),
  totalWins: z.number().int().min(0),
  totalLosses: z.number().int().min(0),
  winRate: z.number().min(0).max(100),
  currentStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
  totalStarsEarned: z.number().int().min(0),
  totalCoinsWagered: z.number().int().min(0),
  totalAccumulatorsWon: z.number().int().min(0).default(0),
  biggestWin: z.number().int().min(0).default(0),
  lastTopupDate: z.string().datetime().optional(),
  lastAdDoubleTopup: z.string().datetime().optional(),
  lastAdBonusStars: z.string().datetime().optional(),
  lastAdPredictionBoost: z.string().datetime().optional(),
  adsWatchedToday: z.number().int().min(0),
  hasPredictionBoost: z.boolean(),
  loginStreak: z.number().int().min(0).default(0),
  lastLoginDate: z.string().datetime().optional(),
});
export type UserStats = z.infer<typeof UserStatsSchema>;

// Auth request/response schemas
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email(),
  password: z.string().min(6),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
  stats: UserStatsSchema,
  token: z.string(),
  refreshToken: z.string().optional(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
