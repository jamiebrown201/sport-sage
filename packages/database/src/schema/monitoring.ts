import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const scraperJobTypeEnum = pgEnum('scraper_job_type', [
  'sync_fixtures',
  'sync_odds',
  'sync_live_scores',
  'sync_results',
  'settlement',
]);

export const scraperJobStatusEnum = pgEnum('scraper_job_status', [
  'running',
  'success',
  'failed',
  'partial',
]);

export const scraperSourceEnum = pgEnum('scraper_source', [
  'flashscore',
  'oddschecker',
  'sofascore',
  'betexplorer',
  'espn',
  '365scores',
  'oddsportal',
  'multi', // For jobs that use multiple sources
]);

// Scraper runs table - tracks each execution of a scraper job
export const scraperRuns = pgTable(
  'scraper_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobType: scraperJobTypeEnum('job_type').notNull(),
    source: scraperSourceEnum('source').notNull(),
    status: scraperJobStatusEnum('status').notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),

    // Metrics
    itemsProcessed: integer('items_processed').default(0),
    itemsCreated: integer('items_created').default(0),
    itemsUpdated: integer('items_updated').default(0),
    itemsFailed: integer('items_failed').default(0),

    // Sport breakdown (JSON object)
    sportStats: jsonb('sport_stats').$type<Record<string, { processed: number; created: number; updated: number; failed: number }>>(),

    // Error tracking
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),

    // Lambda context
    lambdaRequestId: varchar('lambda_request_id', { length: 100 }),
    lambdaMemoryUsedMb: integer('lambda_memory_used_mb'),
  },
  (table) => [
    index('scraper_runs_job_type_idx').on(table.jobType),
    index('scraper_runs_status_idx').on(table.status),
    index('scraper_runs_started_at_idx').on(table.startedAt),
    index('scraper_runs_source_idx').on(table.source),
  ]
);

// Scraper alerts table - for tracking issues that need attention
export const scraperAlerts = pgTable(
  'scraper_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').references(() => scraperRuns.id, { onDelete: 'set null' }),
    alertType: varchar('alert_type', { length: 50 }).notNull(), // 'consecutive_failures', 'low_fixture_count', 'high_error_rate', 'source_down'
    severity: varchar('severity', { length: 20 }).notNull().default('warning'), // 'info', 'warning', 'error', 'critical'
    message: text('message').notNull(),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: varchar('acknowledged_by', { length: 100 }),
  },
  (table) => [
    index('scraper_alerts_type_idx').on(table.alertType),
    index('scraper_alerts_severity_idx').on(table.severity),
    index('scraper_alerts_created_at_idx').on(table.createdAt),
  ]
);

// Data quality metrics - track data freshness and consistency
export const dataQualityMetrics = pgTable(
  'data_quality_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    metricType: varchar('metric_type', { length: 50 }).notNull(), // 'fixture_freshness', 'odds_coverage', 'team_match_rate'
    sportSlug: varchar('sport_slug', { length: 50 }),
    value: integer('value').notNull(),
    threshold: integer('threshold'),
    isHealthy: integer('is_healthy').notNull().default(1), // 1 = healthy, 0 = unhealthy
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
  },
  (table) => [
    index('data_quality_metric_type_idx').on(table.metricType),
    index('data_quality_measured_at_idx').on(table.measuredAt),
  ]
);

// Relations
export const scraperRunsRelations = relations(scraperRuns, ({ many }) => ({
  alerts: many(scraperAlerts),
}));

export const scraperAlertsRelations = relations(scraperAlerts, ({ one }) => ({
  run: one(scraperRuns, {
    fields: [scraperAlerts.runId],
    references: [scraperRuns.id],
  }),
}));

// Type exports
export type ScraperRun = typeof scraperRuns.$inferSelect;
export type NewScraperRun = typeof scraperRuns.$inferInsert;
export type ScraperAlert = typeof scraperAlerts.$inferSelect;
export type NewScraperAlert = typeof scraperAlerts.$inferInsert;
export type DataQualityMetric = typeof dataQualityMetrics.$inferSelect;
export type NewDataQualityMetric = typeof dataQualityMetrics.$inferInsert;
