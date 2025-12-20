import {
  pgTable,
  uuid,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { events, markets, outcomes } from './events';

// Enums
export const predictionStatusEnum = pgEnum('prediction_status', [
  'pending',
  'won',
  'lost',
  'void',
  'cashout',
]);

export const predictionTypeEnum = pgEnum('prediction_type', ['single', 'accumulator']);

// Predictions table
export const predictions = pgTable(
  'predictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: predictionTypeEnum('type').notNull(),

    // For single predictions only
    eventId: uuid('event_id').references(() => events.id),
    marketId: uuid('market_id').references(() => markets.id),
    outcomeId: uuid('outcome_id').references(() => outcomes.id),

    stake: integer('stake').notNull(),
    odds: numeric('odds', { precision: 8, scale: 2 }).notNull(), // For singles
    totalOdds: numeric('total_odds', { precision: 10, scale: 2 }).notNull(), // Combined for accumulators
    potentialCoins: integer('potential_coins').notNull(),
    potentialStars: integer('potential_stars').notNull(),
    starsMultiplier: numeric('stars_multiplier', { precision: 4, scale: 2 }).notNull().default('1.0'),

    status: predictionStatusEnum('status').notNull().default('pending'),
    settledCoins: integer('settled_coins'),
    settledStars: integer('settled_stars'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('predictions_user_id_idx').on(table.userId),
    index('predictions_user_status_idx').on(table.userId, table.status),
    index('predictions_event_id_idx').on(table.eventId),
    index('predictions_status_idx').on(table.status),
    index('predictions_created_at_idx').on(table.createdAt),
  ]
);

// Accumulator selections table
export const accumulatorSelections = pgTable(
  'accumulator_selections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    predictionId: uuid('prediction_id')
      .notNull()
      .references(() => predictions.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    marketId: uuid('market_id')
      .notNull()
      .references(() => markets.id),
    outcomeId: uuid('outcome_id')
      .notNull()
      .references(() => outcomes.id),
    odds: numeric('odds', { precision: 8, scale: 2 }).notNull(),
    status: predictionStatusEnum('status').notNull().default('pending'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (table) => [
    index('accumulator_selections_prediction_id_idx').on(table.predictionId),
    index('accumulator_selections_event_id_idx').on(table.eventId),
  ]
);

// Relations
export const predictionsRelations = relations(predictions, ({ one, many }) => ({
  user: one(users, {
    fields: [predictions.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [predictions.eventId],
    references: [events.id],
  }),
  market: one(markets, {
    fields: [predictions.marketId],
    references: [markets.id],
  }),
  outcome: one(outcomes, {
    fields: [predictions.outcomeId],
    references: [outcomes.id],
  }),
  selections: many(accumulatorSelections),
}));

export const accumulatorSelectionsRelations = relations(accumulatorSelections, ({ one }) => ({
  prediction: one(predictions, {
    fields: [accumulatorSelections.predictionId],
    references: [predictions.id],
  }),
  event: one(events, {
    fields: [accumulatorSelections.eventId],
    references: [events.id],
  }),
  market: one(markets, {
    fields: [accumulatorSelections.marketId],
    references: [markets.id],
  }),
  outcome: one(outcomes, {
    fields: [accumulatorSelections.outcomeId],
    references: [outcomes.id],
  }),
}));

// Type exports
export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;
export type AccumulatorSelection = typeof accumulatorSelections.$inferSelect;
export type NewAccumulatorSelection = typeof accumulatorSelections.$inferInsert;

// Constants for accumulator bonuses
export const ACCUMULATOR_BONUSES: Record<number, number> = {
  2: 1.0,
  3: 1.05,
  4: 1.1,
  5: 1.15,
  6: 1.2,
  7: 1.3,
  8: 1.4,
  9: 1.5,
  10: 1.75,
};

export const ACCUMULATOR_LIMITS = {
  minSelections: 2,
  maxSelections: 10,
  minStake: 10,
  maxStake: 500,
} as const;
