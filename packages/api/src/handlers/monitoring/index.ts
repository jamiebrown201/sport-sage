import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDb, scraperRuns, scraperAlerts, events, sports } from '@sport-sage/database';
import { desc, gte, eq, sql, and, count } from 'drizzle-orm';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  // HTTP API v2 uses requestContext.http for method and rawPath for path
  const httpMethod = event.requestContext?.http?.method || (event as any).httpMethod;
  const path = event.rawPath || (event as any).path;
  const pathParameters = event.pathParameters;

  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // Route: GET /monitoring/dashboard
    if (httpMethod === 'GET' && path.endsWith('/dashboard')) {
      return getDashboard();
    }

    // Route: GET /monitoring/runs
    if (httpMethod === 'GET' && path.endsWith('/runs')) {
      return getRecentRuns(event);
    }

    // Route: GET /monitoring/alerts
    if (httpMethod === 'GET' && path.endsWith('/alerts')) {
      return getAlerts();
    }

    // Route: POST /monitoring/alerts/:id/acknowledge
    if (httpMethod === 'POST' && path.includes('/alerts/') && path.endsWith('/acknowledge')) {
      const alertId = pathParameters?.id;
      if (!alertId) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Alert ID required' }) };
      }
      return acknowledgeAlert(alertId);
    }

    // Route: GET /monitoring/data-quality
    if (httpMethod === 'GET' && path.endsWith('/data-quality')) {
      return getDataQuality();
    }

    // Route: GET /monitoring/health
    if (httpMethod === 'GET' && path.endsWith('/health')) {
      return getHealth();
    }

    // Route: GET /monitoring/sources
    if (httpMethod === 'GET' && path.endsWith('/sources')) {
      return getSourceStatus();
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('Monitoring handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

async function getDashboard(): Promise<APIGatewayProxyResultV2> {
  const db = getDb();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get recent runs
  const recentRuns = await db
    .select()
    .from(scraperRuns)
    .where(gte(scraperRuns.startedAt, oneDayAgo))
    .orderBy(desc(scraperRuns.startedAt))
    .limit(50);

  // Get active alerts
  const activeAlerts = await db
    .select()
    .from(scraperAlerts)
    .where(sql`${scraperAlerts.acknowledgedAt} IS NULL`)
    .orderBy(desc(scraperAlerts.createdAt))
    .limit(20);

  // Calculate summary
  const summary = {
    totalRuns: recentRuns.length,
    successful: recentRuns.filter(r => r.status === 'success').length,
    failed: recentRuns.filter(r => r.status === 'failed').length,
    partial: recentRuns.filter(r => r.status === 'partial').length,
    running: recentRuns.filter(r => r.status === 'running').length,
    totalItemsProcessed: recentRuns.reduce((sum, r) => sum + (r.itemsProcessed || 0), 0),
    totalItemsCreated: recentRuns.reduce((sum, r) => sum + (r.itemsCreated || 0), 0),
    avgDurationMs: recentRuns.length > 0
      ? Math.round(recentRuns.filter(r => r.durationMs).reduce((sum, r) => sum + (r.durationMs || 0), 0) / recentRuns.filter(r => r.durationMs).length)
      : 0,
    activeAlerts: activeAlerts.length,
  };

  // Group by job type
  const byJobType: Record<string, { total: number; success: number; failed: number; lastRun: string | null; avgDuration: number }> = {};
  for (const run of recentRuns) {
    if (!byJobType[run.jobType]) {
      byJobType[run.jobType] = { total: 0, success: 0, failed: 0, lastRun: null, avgDuration: 0 };
    }
    const jt = byJobType[run.jobType]!;
    jt.total++;
    if (run.status === 'success') jt.success++;
    if (run.status === 'failed') jt.failed++;
    if (!jt.lastRun) jt.lastRun = run.startedAt.toISOString();
  }

  // Calculate avg duration per job type
  for (const jobType of Object.keys(byJobType)) {
    const runs = recentRuns.filter(r => r.jobType === jobType && r.durationMs);
    if (runs.length > 0) {
      byJobType[jobType]!.avgDuration = Math.round(
        runs.reduce((sum, r) => sum + (r.durationMs || 0), 0) / runs.length
      );
    }
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      summary,
      byJobType,
      recentRuns: recentRuns.slice(0, 10).map(formatRun),
      activeAlerts: activeAlerts.map(formatAlert),
      generatedAt: new Date().toISOString(),
    }),
  };
}

async function getRecentRuns(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const db = getDb();
  const params = event.queryStringParameters || {};
  const limit = Math.min(parseInt(params.limit || '50'), 100);
  const jobType = params.jobType;
  const status = params.status;

  let query = db.select().from(scraperRuns).orderBy(desc(scraperRuns.startedAt)).limit(limit);

  // Note: Drizzle doesn't support dynamic where clauses easily, so we'll filter in memory for now
  const runs = await query;

  let filtered = runs;
  if (jobType) {
    filtered = filtered.filter(r => r.jobType === jobType);
  }
  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      runs: filtered.map(formatRun),
      total: filtered.length,
    }),
  };
}

async function getAlerts(): Promise<APIGatewayProxyResultV2> {
  const db = getDb();

  const alerts = await db
    .select()
    .from(scraperAlerts)
    .orderBy(desc(scraperAlerts.createdAt))
    .limit(50);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      alerts: alerts.map(formatAlert),
      active: alerts.filter(a => !a.acknowledgedAt).length,
      total: alerts.length,
    }),
  };
}

async function acknowledgeAlert(alertId: string): Promise<APIGatewayProxyResultV2> {
  const db = getDb();

  // Use raw SQL for Data API compatibility
  await db.execute(sql`
    UPDATE scraper_alerts
    SET acknowledged_at = NOW(), acknowledged_by = 'api'
    WHERE id = ${alertId}::uuid
  `);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true }),
  };
}

async function getDataQuality(): Promise<APIGatewayProxyResultV2> {
  const db = getDb();

  // Get fixture counts by sport for the next 7 days
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const fixtureCountsResult = await db.execute(sql`
    SELECT s.slug as sport_slug, COUNT(e.id) as fixture_count
    FROM events e
    JOIN sports s ON e.sport_id = s.id
    WHERE e.start_time >= ${now.toISOString()}::timestamptz
      AND e.start_time <= ${nextWeek.toISOString()}::timestamptz
      AND e.status = 'scheduled'
    GROUP BY s.slug
    ORDER BY fixture_count DESC
  `);

  const fixtureCounts = (fixtureCountsResult.rows || []) as Array<{ sport_slug: string; fixture_count: number }>;

  // Get last successful run for each job type
  const lastRuns = await db.execute(sql`
    SELECT DISTINCT ON (job_type) job_type, started_at, status, items_processed
    FROM scraper_runs
    WHERE status = 'success'
    ORDER BY job_type, started_at DESC
  `);

  const lastSuccessfulRuns = (lastRuns.rows || []) as Array<{
    job_type: string;
    started_at: Date;
    status: string;
    items_processed: number;
  }>;

  // Calculate data freshness
  const freshness: Record<string, { lastSync: string; minutesAgo: number; isStale: boolean }> = {};
  const staleThresholds: Record<string, number> = {
    sync_fixtures: 12 * 60, // 12 hours
    sync_odds: 30, // 30 minutes
    sync_live_scores: 5, // 5 minutes
    sync_results: 15, // 15 minutes
  };

  for (const run of lastSuccessfulRuns) {
    const minutesAgo = Math.round((Date.now() - new Date(run.started_at).getTime()) / 60000);
    const threshold = staleThresholds[run.job_type] || 60;

    freshness[run.job_type] = {
      lastSync: new Date(run.started_at).toISOString(),
      minutesAgo,
      isStale: minutesAgo > threshold,
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      fixtureCounts,
      freshness,
      expectedMinFixtures: {
        football: 50,
        basketball: 20,
        tennis: 5,
        darts: 2,
        cricket: 1,
      },
      generatedAt: new Date().toISOString(),
    }),
  };
}

async function getSourceStatus(): Promise<APIGatewayProxyResultV2> {
  const db = getDb();

  // Get bot detection alerts from last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const botAlerts = await db
    .select()
    .from(scraperAlerts)
    .where(and(
      gte(scraperAlerts.createdAt, oneDayAgo),
      sql`${scraperAlerts.alertType} IN ('source_degraded', 'source_down', 'bot_detected')`
    ))
    .orderBy(desc(scraperAlerts.createdAt));

  // Get recent runs grouped by source
  const recentRuns = await db.execute(sql`
    SELECT
      source,
      status,
      COUNT(*) as count,
      MAX(started_at) as last_run
    FROM scraper_runs
    WHERE started_at >= ${oneDayAgo.toISOString()}::timestamptz
    GROUP BY source, status
    ORDER BY source, status
  `);

  // Build source status
  const sourceStatus: Record<string, {
    status: 'healthy' | 'degraded' | 'down' | 'cooldown' | 'unknown';
    lastRun: string | null;
    successCount: number;
    failCount: number;
    successRate: number;
    nextRetryAt: string | null;
    recentAlerts: Array<{ type: string; severity: string; message: string; createdAt: string }>;
  }> = {};

  const sources = ['flashscore', 'oddschecker', 'sofascore', 'espn', '365scores', 'fotmob', 'livescore', 'oddsportal'];

  for (const source of sources) {
    sourceStatus[source] = {
      status: 'unknown',
      lastRun: null,
      successCount: 0,
      failCount: 0,
      successRate: 0,
      nextRetryAt: null,
      recentAlerts: [],
    };
  }

  // Process run data
  for (const row of (recentRuns.rows || []) as Array<{ source: string; status: string; count: number; last_run: Date }>) {
    if (sourceStatus[row.source]) {
      if (row.status === 'success') {
        sourceStatus[row.source].successCount = Number(row.count);
      } else if (row.status === 'failed') {
        sourceStatus[row.source].failCount = Number(row.count);
      }
      if (!sourceStatus[row.source].lastRun || new Date(row.last_run) > new Date(sourceStatus[row.source].lastRun!)) {
        sourceStatus[row.source].lastRun = new Date(row.last_run).toISOString();
      }
    }
  }

  // Calculate status and success rate
  for (const source of Object.keys(sourceStatus)) {
    const s = sourceStatus[source];
    const total = s.successCount + s.failCount;
    s.successRate = total > 0 ? Math.round((s.successCount / total) * 100) : 0;

    // Determine status based on success rate and alerts
    const sourceAlerts = botAlerts.filter(a => (a.metadata as any)?.source === source);
    s.recentAlerts = sourceAlerts.map(a => ({
      type: a.alertType,
      severity: a.severity,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    }));

    const hasCriticalAlert = sourceAlerts.some(a => a.severity === 'critical' && !a.acknowledgedAt);
    const hasWarningAlert = sourceAlerts.some(a => a.severity === 'warning' && !a.acknowledgedAt);

    if (hasCriticalAlert || s.successRate < 20) {
      s.status = 'down';
    } else if (hasWarningAlert || s.successRate < 70) {
      s.status = 'degraded';
    } else if (total > 0) {
      s.status = 'healthy';
    }
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      sources: sourceStatus,
      activeBotAlerts: botAlerts.filter(a => !a.acknowledgedAt).length,
      generatedAt: new Date().toISOString(),
    }),
  };
}

async function getHealth(): Promise<APIGatewayProxyResultV2> {
  const db = getDb();

  // Check database connectivity
  let dbHealthy = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbHealthy = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  // Check recent scraper activity
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRuns = await db
    .select({ status: scraperRuns.status })
    .from(scraperRuns)
    .where(gte(scraperRuns.startedAt, oneHourAgo));

  const scraperHealthy = recentRuns.some(r => r.status === 'success');

  // Count active alerts
  const alertCount = await db
    .select({ count: count() })
    .from(scraperAlerts)
    .where(sql`${scraperAlerts.acknowledgedAt} IS NULL AND ${scraperAlerts.severity} IN ('error', 'critical')`);

  const criticalAlerts = alertCount[0]?.count || 0;

  const isHealthy = dbHealthy && scraperHealthy && criticalAlerts === 0;

  return {
    statusCode: isHealthy ? 200 : 503,
    headers: corsHeaders,
    body: JSON.stringify({
      status: isHealthy ? 'healthy' : 'degraded',
      checks: {
        database: dbHealthy ? 'ok' : 'failing',
        scraperActivity: scraperHealthy ? 'ok' : 'no recent activity',
        criticalAlerts: criticalAlerts === 0 ? 'ok' : `${criticalAlerts} critical alerts`,
      },
      timestamp: new Date().toISOString(),
    }),
  };
}

// Helpers
function formatRun(run: typeof scraperRuns.$inferSelect) {
  return {
    id: run.id,
    jobType: run.jobType,
    source: run.source,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() || null,
    durationMs: run.durationMs,
    durationFormatted: run.durationMs ? formatDuration(run.durationMs) : null,
    itemsProcessed: run.itemsProcessed,
    itemsCreated: run.itemsCreated,
    itemsUpdated: run.itemsUpdated,
    itemsFailed: run.itemsFailed,
    sportStats: run.sportStats,
    errorMessage: run.errorMessage,
    memoryUsedMb: run.lambdaMemoryUsedMb,
  };
}

function formatAlert(alert: typeof scraperAlerts.$inferSelect) {
  return {
    id: alert.id,
    type: alert.alertType,
    severity: alert.severity,
    message: alert.message,
    metadata: alert.metadata,
    createdAt: alert.createdAt.toISOString(),
    acknowledgedAt: alert.acknowledgedAt?.toISOString() || null,
    acknowledgedBy: alert.acknowledgedBy,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
