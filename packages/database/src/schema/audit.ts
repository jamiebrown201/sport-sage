/**
 * Audit Schema - Score history and audit logging for data protection
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { events } from './events.js';
import { users } from './users.js';

// Enum for audit actions
export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'flag',
  'unflag',
  'hold',
  'release',
  'settle',
  'void',
]);

// Event score history - tracks all score changes for audit trail
export const eventScoreHistory = pgTable(
  'event_score_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    period: varchar('period', { length: 50 }),
    minute: integer('minute'),
    source: varchar('source', { length: 50 }).notNull(), // flashscore, manual, etc.
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('event_score_history_event_id_idx').on(table.eventId),
    index('event_score_history_scraped_at_idx').on(table.scrapedAt),
  ]
);

// Audit log - tracks all important changes for accountability
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tableName: varchar('table_name', { length: 100 }).notNull(),
    recordId: uuid('record_id').notNull(),
    action: auditActionEnum('action').notNull(),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    reason: text('reason'), // Why the change was made
    changedBy: uuid('changed_by').references(() => users.id), // null for system actions
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_table_record_idx').on(table.tableName, table.recordId),
    index('audit_log_changed_at_idx').on(table.changedAt),
    index('audit_log_action_idx').on(table.action),
    index('audit_log_changed_by_idx').on(table.changedBy),
  ]
);

// Odds change history - tracks suspicious odds changes
export const oddsHistory = pgTable(
  'odds_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    marketType: varchar('market_type', { length: 50 }).notNull(),
    outcomeName: varchar('outcome_name', { length: 100 }).notNull(),
    previousOdds: varchar('previous_odds', { length: 20 }),
    newOdds: varchar('new_odds', { length: 20 }).notNull(),
    changePercent: varchar('change_percent', { length: 20 }), // e.g. "+50%", "-30%"
    source: varchar('source', { length: 50 }).notNull(),
    isFlagged: integer('is_flagged').notNull().default(0), // 1 if this change triggered a flag
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('odds_history_event_id_idx').on(table.eventId),
    index('odds_history_recorded_at_idx').on(table.recordedAt),
    index('odds_history_flagged_idx').on(table.isFlagged),
  ]
);

// Relations
export const eventScoreHistoryRelations = relations(eventScoreHistory, ({ one }) => ({
  event: one(events, {
    fields: [eventScoreHistory.eventId],
    references: [events.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  changedByUser: one(users, {
    fields: [auditLog.changedBy],
    references: [users.id],
  }),
}));

export const oddsHistoryRelations = relations(oddsHistory, ({ one }) => ({
  event: one(events, {
    fields: [oddsHistory.eventId],
    references: [events.id],
  }),
}));

// Type exports
export type EventScoreHistory = typeof eventScoreHistory.$inferSelect;
export type NewEventScoreHistory = typeof eventScoreHistory.$inferInsert;
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
export type OddsHistory = typeof oddsHistory.$inferSelect;
export type NewOddsHistory = typeof oddsHistory.$inferInsert;
