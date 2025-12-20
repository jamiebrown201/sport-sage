import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { sportSlugEnum } from './sports';

// Achievement enums
export const achievementCategoryEnum = pgEnum('achievement_category', [
  'predictions',
  'wins',
  'streaks',
  'sports',
  'accumulators',
  'social',
  'collector',
  'special',
]);

export const achievementTierEnum = pgEnum('achievement_tier', [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
]);

// Challenge enums
export const challengeTypeEnum = pgEnum('challenge_type', [
  'win_predictions',
  'place_predictions',
  'win_accumulator',
  'predict_sport',
  'predict_live',
  'win_streak',
  'odds_range',
  'specific_market',
]);

export const challengeDifficultyEnum = pgEnum('challenge_difficulty', ['easy', 'medium', 'hard']);

// Achievements table
export const achievements = pgTable(
  'achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: achievementCategoryEnum('category').notNull(),
    tier: achievementTierEnum('tier').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    iconName: varchar('icon_name', { length: 50 }).notNull(),
    requirementType: varchar('requirement_type', { length: 50 }).notNull(),
    requirementValue: integer('requirement_value').notNull(),
    requirementSportSlug: sportSlugEnum('requirement_sport_slug'),
    additionalCriteria: jsonb('additional_criteria'),
    rewardCoins: integer('reward_coins').notNull().default(0),
    rewardStars: integer('reward_stars').notNull().default(0),
    rewardGems: integer('reward_gems').notNull().default(0),
    nextTierId: uuid('next_tier_id'),
    isHidden: boolean('is_hidden').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('achievements_category_idx').on(table.category),
    index('achievements_tier_idx').on(table.tier),
  ]
);

// User achievements table
export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: uuid('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    currentProgress: integer('current_progress').notNull().default(0),
    isUnlocked: boolean('is_unlocked').notNull().default(false),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
    isClaimed: boolean('is_claimed').notNull().default(false),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (table) => [
    index('user_achievements_user_id_idx').on(table.userId),
    index('user_achievements_user_unlocked_idx').on(table.userId, table.isUnlocked),
  ]
);

// Challenges table
export const challenges = pgTable(
  'challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: challengeTypeEnum('type').notNull(),
    difficulty: challengeDifficultyEnum('difficulty').notNull(),
    title: varchar('title', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    iconName: varchar('icon_name', { length: 50 }).notNull(),
    targetValue: integer('target_value').notNull(),
    sportSlug: sportSlugEnum('sport_slug'),
    marketType: varchar('market_type', { length: 50 }),
    minOdds: integer('min_odds'),
    maxOdds: integer('max_odds'),
    requireLive: boolean('require_live').default(false),
    requireAccumulator: boolean('require_accumulator').default(false),
    rewardCoins: integer('reward_coins').notNull().default(0),
    rewardStars: integer('reward_stars').notNull().default(0),
    rewardGems: integer('reward_gems').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    isWeekly: boolean('is_weekly').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('challenges_expires_at_idx').on(table.expiresAt),
    index('challenges_weekly_idx').on(table.isWeekly),
  ]
);

// User challenges table
export const userChallenges = pgTable(
  'user_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    currentValue: integer('current_value').notNull().default(0),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    isClaimed: boolean('is_claimed').notNull().default(false),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (table) => [
    index('user_challenges_user_id_idx').on(table.userId),
    index('user_challenges_user_completed_idx').on(table.userId, table.isCompleted),
  ]
);

// Relations
export const achievementsRelations = relations(achievements, ({ one, many }) => ({
  nextTier: one(achievements, {
    fields: [achievements.nextTierId],
    references: [achievements.id],
    relationName: 'achievementTiers',
  }),
  userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

export const challengesRelations = relations(challenges, ({ many }) => ({
  userChallenges: many(userChallenges),
}));

export const userChallengesRelations = relations(userChallenges, ({ one }) => ({
  user: one(users, {
    fields: [userChallenges.userId],
    references: [users.id],
  }),
  challenge: one(challenges, {
    fields: [userChallenges.challengeId],
    references: [challenges.id],
  }),
}));

// Type exports
export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = typeof userAchievements.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
export type UserChallenge = typeof userChallenges.$inferSelect;
export type NewUserChallenge = typeof userChallenges.$inferInsert;
