import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Enums
export const transactionTypeEnum = pgEnum('transaction_type', [
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
  'welcome_bonus',
]);

export const currencyTypeEnum = pgEnum('currency_type', ['coins', 'stars', 'gems']);

// Transactions table
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: transactionTypeEnum('type').notNull(),
    currency: currencyTypeEnum('currency').notNull(),
    amount: integer('amount').notNull(), // Positive for credit, negative for debit
    balanceAfter: integer('balance_after').notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    referenceId: uuid('reference_id'), // Prediction ID, achievement ID, etc.
    referenceType: varchar('reference_type', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('transactions_user_id_idx').on(table.userId),
    index('transactions_user_created_at_idx').on(table.userId, table.createdAt),
    index('transactions_reference_idx').on(table.referenceId),
    index('transactions_type_idx').on(table.type),
  ]
);

// Relations
export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

// Type exports
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Constants
export const DAILY_TOPUP_AMOUNT = 500;
export const WELCOME_BONUS_COINS = 1000;
export const REFERRER_BONUS_COINS = 500;
export const REFERRER_BONUS_STARS = 100;
export const REFERRED_BONUS_COINS = 1000;
export const REFERRED_BONUS_STARS = 50;
