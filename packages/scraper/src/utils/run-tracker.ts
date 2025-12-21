import { getDb, scraperRuns, scraperAlerts } from '@sport-sage/database';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { logger } from './logger';

export type JobType = 'sync_fixtures' | 'sync_odds' | 'sync_live_scores' | 'sync_results' | 'settlement';
export type Source = 'flashscore' | 'oddschecker' | 'sofascore' | 'betexplorer' | 'espn' | '365scores' | 'oddsportal' | 'multi';

interface SportStats {
  processed: number;
  created: number;
  updated: number;
  failed: number;
}

/**
 * Tracks scraper job execution for monitoring and debugging
 */
export class RunTracker {
  private runId: string | null = null;
  private startTime: number;
  private sportStats: Record<string, SportStats> = {};
  private totals = { processed: 0, created: 0, updated: 0, failed: 0 };

  constructor(
    private jobType: JobType,
    private source: Source,
    private lambdaRequestId?: string
  ) {
    this.startTime = Date.now();
  }

  /**
   * Start tracking a new run
   */
  async start(): Promise<string> {
    const db = getDb();

    // Use raw SQL for enum compatibility with Data API
    const result = await db.execute(sql`
      INSERT INTO scraper_runs (job_type, source, status, lambda_request_id)
      VALUES (
        ${this.jobType}::scraper_job_type,
        ${this.source}::scraper_source,
        'running'::scraper_job_status,
        ${this.lambdaRequestId || null}
      )
      RETURNING id
    `);

    this.runId = (result.rows?.[0] as any)?.id;
    logger.info('Scraper run started', { runId: this.runId, jobType: this.jobType, source: this.source });

    return this.runId!;
  }

  /**
   * Record stats for a specific sport
   */
  recordSportStats(sport: string, stats: Partial<SportStats>): void {
    if (!this.sportStats[sport]) {
      this.sportStats[sport] = { processed: 0, created: 0, updated: 0, failed: 0 };
    }

    const sportStat = this.sportStats[sport]!;

    if (stats.processed) {
      sportStat.processed += stats.processed;
      this.totals.processed += stats.processed;
    }
    if (stats.created) {
      sportStat.created += stats.created;
      this.totals.created += stats.created;
    }
    if (stats.updated) {
      sportStat.updated += stats.updated;
      this.totals.updated += stats.updated;
    }
    if (stats.failed) {
      sportStat.failed += stats.failed;
      this.totals.failed += stats.failed;
    }
  }

  /**
   * Complete the run successfully
   */
  async complete(): Promise<void> {
    if (!this.runId) return;

    const db = getDb();
    const durationMs = Date.now() - this.startTime;
    const status = this.totals.failed > 0 ? 'partial' : 'success';

    // Use raw SQL for enum compatibility with Data API
    await db.execute(sql`
      UPDATE scraper_runs
      SET
        status = ${status}::scraper_job_status,
        completed_at = NOW(),
        duration_ms = ${durationMs},
        items_processed = ${this.totals.processed},
        items_created = ${this.totals.created},
        items_updated = ${this.totals.updated},
        items_failed = ${this.totals.failed},
        sport_stats = ${JSON.stringify(this.sportStats)}::jsonb,
        lambda_memory_used_mb = ${this.getMemoryUsage()}
      WHERE id = ${this.runId}::uuid
    `);

    logger.info('Scraper run completed', {
      runId: this.runId,
      durationMs,
      ...this.totals,
    });

    // Check for alerts
    await this.checkForAlerts();
  }

  /**
   * Mark the run as failed
   */
  async fail(error: Error): Promise<void> {
    if (!this.runId) return;

    const db = getDb();
    const durationMs = Date.now() - this.startTime;
    const errorStack = error.stack?.substring(0, 5000) || null;

    // Use raw SQL for enum compatibility with Data API
    await db.execute(sql`
      UPDATE scraper_runs
      SET
        status = 'failed'::scraper_job_status,
        completed_at = NOW(),
        duration_ms = ${durationMs},
        items_processed = ${this.totals.processed},
        items_created = ${this.totals.created},
        items_updated = ${this.totals.updated},
        items_failed = ${this.totals.failed},
        sport_stats = ${JSON.stringify(this.sportStats)}::jsonb,
        error_message = ${error.message},
        error_stack = ${errorStack},
        lambda_memory_used_mb = ${this.getMemoryUsage()}
      WHERE id = ${this.runId}::uuid
    `);

    logger.error('Scraper run failed', { runId: this.runId, error: error.message });

    // Create failure alert
    await this.createAlert('job_failure', 'error', `Job ${this.jobType} failed: ${error.message}`, {
      errorMessage: error.message,
    });

    // Check for consecutive failures
    await this.checkConsecutiveFailures();
  }

  /**
   * Check for conditions that warrant alerts
   */
  private async checkForAlerts(): Promise<void> {
    const db = getDb();

    // Alert if fixture count is suspiciously low
    if (this.jobType === 'sync_fixtures') {
      const expectedMinFixtures: Record<string, number> = {
        football: 50,
        basketball: 20,
        tennis: 5,
        darts: 2,
        cricket: 1,
      };

      for (const [sport, stats] of Object.entries(this.sportStats)) {
        const expected = expectedMinFixtures[sport] || 5;
        if (stats.processed < expected && stats.failed === 0) {
          await this.createAlert(
            'low_fixture_count',
            'warning',
            `Low fixture count for ${sport}: ${stats.processed} (expected at least ${expected})`,
            { sport, count: stats.processed, expected }
          );
        }
      }
    }

    // Alert if error rate is high
    if (this.totals.processed > 0) {
      const errorRate = this.totals.failed / this.totals.processed;
      if (errorRate > 0.1) { // More than 10% failures
        await this.createAlert(
          'high_error_rate',
          'warning',
          `High error rate: ${(errorRate * 100).toFixed(1)}% of items failed`,
          { errorRate, failed: this.totals.failed, processed: this.totals.processed }
        );
      }
    }
  }

  /**
   * Check if there have been consecutive failures
   */
  private async checkConsecutiveFailures(): Promise<void> {
    const db = getDb();

    // Get last 5 runs of this job type
    const recentRuns = await db
      .select({ status: scraperRuns.status })
      .from(scraperRuns)
      .where(eq(scraperRuns.jobType, this.jobType))
      .orderBy(desc(scraperRuns.startedAt))
      .limit(5);

    const consecutiveFailures = recentRuns.filter(r => r.status === 'failed').length;

    if (consecutiveFailures >= 3) {
      await this.createAlert(
        'consecutive_failures',
        'critical',
        `${consecutiveFailures} consecutive failures for ${this.jobType}`,
        { consecutiveFailures, jobType: this.jobType }
      );
    }
  }

  /**
   * Create an alert
   */
  private async createAlert(
    alertType: string,
    severity: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const db = getDb();

    // Check if similar alert exists in last hour (avoid spam)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await db.query.scraperAlerts.findFirst({
      where: and(
        eq(scraperAlerts.alertType, alertType),
        gte(scraperAlerts.createdAt, oneHourAgo)
      ),
    });

    if (existing) {
      logger.debug('Skipping duplicate alert', { alertType });
      return;
    }

    // Use raw SQL for compatibility
    await db.execute(sql`
      INSERT INTO scraper_alerts (run_id, alert_type, severity, message, metadata)
      VALUES (
        ${this.runId}::uuid,
        ${alertType},
        ${severity},
        ${message},
        ${metadata ? JSON.stringify(metadata) : null}::jsonb
      )
    `);

    logger.warn('Alert created', { alertType, severity, message });
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }
}

/**
 * Get scraper dashboard data
 */
export async function getScraperDashboard() {
  const db = getDb();

  // Get last 24 hours of runs
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentRuns = await db
    .select()
    .from(scraperRuns)
    .where(gte(scraperRuns.startedAt, oneDayAgo))
    .orderBy(desc(scraperRuns.startedAt))
    .limit(100);

  // Get unacknowledged alerts
  const activeAlerts = await db.query.scraperAlerts.findMany({
    where: sql`${scraperAlerts.acknowledgedAt} IS NULL`,
    orderBy: desc(scraperAlerts.createdAt),
    limit: 20,
  });

  // Calculate summary stats
  const summary = {
    totalRuns: recentRuns.length,
    successful: recentRuns.filter(r => r.status === 'success').length,
    failed: recentRuns.filter(r => r.status === 'failed').length,
    partial: recentRuns.filter(r => r.status === 'partial').length,
    running: recentRuns.filter(r => r.status === 'running').length,
    totalItemsProcessed: recentRuns.reduce((sum, r) => sum + (r.itemsProcessed || 0), 0),
    avgDurationMs: recentRuns.length > 0
      ? Math.round(recentRuns.reduce((sum, r) => sum + (r.durationMs || 0), 0) / recentRuns.length)
      : 0,
  };

  // Group by job type
  const byJobType = recentRuns.reduce((acc, run) => {
    if (!acc[run.jobType]) {
      acc[run.jobType] = { total: 0, success: 0, failed: 0, lastRun: null as Date | null };
    }
    acc[run.jobType].total++;
    if (run.status === 'success') acc[run.jobType].success++;
    if (run.status === 'failed') acc[run.jobType].failed++;
    if (!acc[run.jobType].lastRun || run.startedAt > acc[run.jobType].lastRun!) {
      acc[run.jobType].lastRun = run.startedAt;
    }
    return acc;
  }, {} as Record<string, { total: number; success: number; failed: number; lastRun: Date | null }>);

  return {
    summary,
    byJobType,
    recentRuns: recentRuns.slice(0, 20), // Last 20 runs
    activeAlerts,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
  const db = getDb();

  // Use raw SQL for compatibility
  await db.execute(sql`
    UPDATE scraper_alerts
    SET acknowledged_at = NOW(), acknowledged_by = ${acknowledgedBy}
    WHERE id = ${alertId}::uuid
  `);
}
