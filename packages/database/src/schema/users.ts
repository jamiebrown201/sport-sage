import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro', 'elite']);

// Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cognitoId: varchar('cognito_id', { length: 128 }).unique().notNull(),
    username: varchar('username', { length: 20 }).unique().notNull(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    coins: integer('coins').notNull().default(1000),
    stars: integer('stars').notNull().default(0),
    gems: integer('gems').notNull().default(0),
    subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
    subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
    isAdsEnabled: boolean('is_ads_enabled').notNull().default(true),
    isOver18: boolean('is_over_18').notNull().default(true),
    showAffiliates: boolean('show_affiliates').notNull().default(false),
    avatarUrl: varchar('avatar_url', { length: 512 }),
    referralCode: varchar('referral_code', { length: 20 }).unique(),
    referredById: uuid('referred_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('users_cognito_id_idx').on(table.cognitoId),
    index('users_username_idx').on(table.username),
    index('users_referral_code_idx').on(table.referralCode),
  ]
);

// User stats table (denormalized for fast leaderboard queries)
export const userStats = pgTable(
  'user_stats',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    totalPredictions: integer('total_predictions').notNull().default(0),
    totalWins: integer('total_wins').notNull().default(0),
    totalLosses: integer('total_losses').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),
    totalStarsEarned: integer('total_stars_earned').notNull().default(0),
    totalCoinsWagered: integer('total_coins_wagered').notNull().default(0),
    totalAccumulatorsWon: integer('total_accumulators_won').notNull().default(0),
    biggestWin: integer('biggest_win').notNull().default(0),
    lastTopupDate: timestamp('last_topup_date', { withTimezone: true }),
    loginStreak: integer('login_streak').notNull().default(0),
    lastLoginDate: timestamp('last_login_date', { withTimezone: true }),
    adsWatchedToday: integer('ads_watched_today').notNull().default(0),
    hasPredictionBoost: boolean('has_prediction_boost').notNull().default(false),
    predictionBoostExpiresAt: timestamp('prediction_boost_expires_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('user_stats_total_stars_idx').on(table.totalStarsEarned),
    index('user_stats_current_streak_idx').on(table.currentStreak),
  ]
);

// User settings table
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  notifyPredictions: boolean('notify_predictions').notNull().default(true),
  notifyChallenges: boolean('notify_challenges').notNull().default(true),
  notifyFriends: boolean('notify_friends').notNull().default(true),
  notifyMarketing: boolean('notify_marketing').notNull().default(false),
  theme: varchar('theme', { length: 20 }).notNull().default('dark'),
  showOnLeaderboard: boolean('show_on_leaderboard').notNull().default(true),
  showActivityToFriends: boolean('show_activity_to_friends').notNull().default(true),
  allowFriendRequests: boolean('allow_friend_requests').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  stats: one(userStats, {
    fields: [users.id],
    references: [userStats.userId],
  }),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  referredBy: one(users, {
    fields: [users.referredById],
    references: [users.id],
    relationName: 'referrals',
  }),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, {
    fields: [userStats.userId],
    references: [users.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserStats = typeof userStats.$inferSelect;
export type NewUserStats = typeof userStats.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
