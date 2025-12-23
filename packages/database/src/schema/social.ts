import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';

// Enums
export const friendshipStatusEnum = pgEnum('friendship_status', ['pending', 'accepted', 'blocked']);

export const activityTypeEnum = pgEnum('activity_type', [
  'prediction_placed',
  'prediction_won',
  'accumulator_won',
  'achievement_unlocked',
  'challenge_completed',
  'streak_milestone',
  'leaderboard_rank',
  'friend_joined',
]);

export const referralStatusEnum = pgEnum('referral_status', ['pending', 'completed', 'rewarded']);

// Friendships table
export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendshipStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (table) => [
    index('friendships_requester_id_idx').on(table.requesterId),
    index('friendships_addressee_id_idx').on(table.addresseeId),
    index('friendships_status_idx').on(table.status),
  ]
);

// Activity feed table
export const activityFeed = pgTable(
  'activity_feed',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: activityTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 500 }),
    predictionId: uuid('prediction_id'),
    achievementId: uuid('achievement_id'),
    metadata: jsonb('metadata'), // Additional context-specific data
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('activity_feed_user_id_idx').on(table.userId),
    index('activity_feed_created_at_idx').on(table.createdAt),
    index('activity_feed_user_created_at_idx').on(table.userId, table.createdAt),
  ]
);

// Referrals table
export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    referredUserId: uuid('referred_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    referralCode: varchar('referral_code', { length: 20 }).notNull(),
    status: referralStatusEnum('status').notNull().default('pending'),
    referrerRewardCoins: integer('referrer_reward_coins').notNull().default(500),
    referrerRewardStars: integer('referrer_reward_stars').notNull().default(100),
    referredRewardCoins: integer('referred_reward_coins').notNull().default(1000),
    referredRewardStars: integer('referred_reward_stars').notNull().default(50),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('referrals_referrer_id_idx').on(table.referrerId),
    index('referrals_referred_user_id_idx').on(table.referredUserId),
    index('referrals_referral_code_idx').on(table.referralCode),
    index('referrals_status_idx').on(table.status),
  ]
);

// Relations
export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(users, {
    fields: [friendships.requesterId],
    references: [users.id],
    relationName: 'sentFriendRequests',
  }),
  addressee: one(users, {
    fields: [friendships.addresseeId],
    references: [users.id],
    relationName: 'receivedFriendRequests',
  }),
}));

export const activityFeedRelations = relations(activityFeed, ({ one }) => ({
  user: one(users, {
    fields: [activityFeed.userId],
    references: [users.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: 'referralsMade',
  }),
  referredUser: one(users, {
    fields: [referrals.referredUserId],
    references: [users.id],
    relationName: 'referralReceived',
  }),
}));

// Type exports
export type Friendship = typeof friendships.$inferSelect;
export type NewFriendship = typeof friendships.$inferInsert;
export type ActivityFeedItem = typeof activityFeed.$inferSelect;
export type NewActivityFeedItem = typeof activityFeed.$inferInsert;
export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
