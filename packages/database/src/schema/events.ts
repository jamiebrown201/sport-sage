import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  numeric,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sports, competitions, teams, players } from './sports';

// Enums
export const eventStatusEnum = pgEnum('event_status', [
  'scheduled',
  'live',
  'finished',
  'cancelled',
  'postponed',
]);

export const marketTypeEnum = pgEnum('market_type', [
  'match_winner',
  'double_chance',
  'both_teams_score',
  'over_under_goals',
  'over_under_points',
  'correct_score',
  'first_scorer',
  'handicap',
  'set_winner',
  'game_winner',
  'frame_winner',
  'to_qualify',
]);

// Events table
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sportId: uuid('sport_id')
      .notNull()
      .references(() => sports.id),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id),
    competitionName: varchar('competition_name', { length: 200 }), // Denormalized for convenience
    homeTeamId: uuid('home_team_id').references(() => teams.id),
    awayTeamId: uuid('away_team_id').references(() => teams.id),
    homeTeamName: varchar('home_team_name', { length: 200 }), // Denormalized
    awayTeamName: varchar('away_team_name', { length: 200 }), // Denormalized
    player1Id: uuid('player1_id').references(() => players.id),
    player2Id: uuid('player2_id').references(() => players.id),
    player1Name: varchar('player1_name', { length: 200 }), // Denormalized
    player2Name: varchar('player2_name', { length: 200 }), // Denormalized
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    status: eventStatusEnum('status').notNull().default('scheduled'),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    period: varchar('period', { length: 50 }), // "1st Half", "2nd Set", etc.
    minute: integer('minute'),
    isFeatured: boolean('is_featured').notNull().default(false),
    viewCount: integer('view_count').notNull().default(0),
    predictionCount: integer('prediction_count').notNull().default(0),
    externalFlashscoreId: varchar('external_flashscore_id', { length: 100 }),
    externalOddscheckerId: varchar('external_oddschecker_id', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('events_sport_id_idx').on(table.sportId),
    index('events_competition_id_idx').on(table.competitionId),
    index('events_start_time_idx').on(table.startTime),
    index('events_status_idx').on(table.status),
    index('events_status_start_time_idx').on(table.status, table.startTime),
    index('events_featured_idx').on(table.isFeatured),
    index('events_external_flashscore_idx').on(table.externalFlashscoreId),
  ]
);

// Markets table
export const markets = pgTable(
  'markets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    type: marketTypeEnum('type').notNull(),
    name: varchar('name', { length: 100 }),
    line: numeric('line', { precision: 5, scale: 2 }), // For over/under, handicap
    isSuspended: boolean('is_suspended').notNull().default(false),
    isMainMarket: boolean('is_main_market').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('markets_event_id_idx').on(table.eventId),
    index('markets_event_type_idx').on(table.eventId, table.type),
  ]
);

// Outcomes table
export const outcomes = pgTable(
  'outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    marketId: uuid('market_id')
      .notNull()
      .references(() => markets.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    odds: numeric('odds', { precision: 8, scale: 2 }).notNull(),
    previousOdds: numeric('previous_odds', { precision: 8, scale: 2 }),
    isWinner: boolean('is_winner'),
    isSuspended: boolean('is_suspended').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('outcomes_market_id_idx').on(table.marketId)]
);

// Sponsored events table
export const sponsoredEvents = pgTable(
  'sponsored_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' })
      .unique(),
    sponsorName: varchar('sponsor_name', { length: 100 }).notNull(),
    sponsorLogoUrl: varchar('sponsor_logo_url', { length: 512 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 500 }),
    prizeDescription: varchar('prize_description', { length: 500 }),
    brandingColor: varchar('branding_color', { length: 20 }),
    bonusStarsMultiplier: numeric('bonus_stars_multiplier', { precision: 4, scale: 2 })
      .notNull()
      .default('1.5'),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  },
  (table) => [index('sponsored_events_event_id_idx').on(table.eventId)]
);

// Relations
export const eventsRelations = relations(events, ({ one, many }) => ({
  sport: one(sports, {
    fields: [events.sportId],
    references: [sports.id],
  }),
  competition: one(competitions, {
    fields: [events.competitionId],
    references: [competitions.id],
  }),
  homeTeam: one(teams, {
    fields: [events.homeTeamId],
    references: [teams.id],
    relationName: 'homeTeam',
  }),
  awayTeam: one(teams, {
    fields: [events.awayTeamId],
    references: [teams.id],
    relationName: 'awayTeam',
  }),
  player1: one(players, {
    fields: [events.player1Id],
    references: [players.id],
    relationName: 'player1',
  }),
  player2: one(players, {
    fields: [events.player2Id],
    references: [players.id],
    relationName: 'player2',
  }),
  markets: many(markets),
  sponsoredEvent: one(sponsoredEvents),
}));

export const marketsRelations = relations(markets, ({ one, many }) => ({
  event: one(events, {
    fields: [markets.eventId],
    references: [events.id],
  }),
  outcomes: many(outcomes),
}));

export const outcomesRelations = relations(outcomes, ({ one }) => ({
  market: one(markets, {
    fields: [outcomes.marketId],
    references: [markets.id],
  }),
}));

export const sponsoredEventsRelations = relations(sponsoredEvents, ({ one }) => ({
  event: one(events, {
    fields: [sponsoredEvents.eventId],
    references: [events.id],
  }),
}));

// Type exports
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;
export type Outcome = typeof outcomes.$inferSelect;
export type NewOutcome = typeof outcomes.$inferInsert;
export type SponsoredEvent = typeof sponsoredEvents.$inferSelect;
export type NewSponsoredEvent = typeof sponsoredEvents.$inferInsert;
