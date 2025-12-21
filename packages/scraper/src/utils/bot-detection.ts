import { getDb, scraperAlerts } from '@sport-sage/database';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { logger } from './logger';

/**
 * Bot detection and source health tracking
 *
 * Monitors sources for signs of being blocked:
 * - Consecutive failures
 * - Captcha/blocked responses
 * - Rate limiting (429)
 * - Empty responses when data is expected
 */

// Cooldown range before retrying a "down" source (8-15 minutes with jitter)
const COOLDOWN_MIN_MS = 8 * 60 * 1000;   // 8 minutes
const COOLDOWN_MAX_MS = 15 * 60 * 1000;  // 15 minutes

/**
 * Generate a randomized cooldown period to avoid predictable retry patterns
 */
function getRandomCooldown(): number {
  return COOLDOWN_MIN_MS + Math.random() * (COOLDOWN_MAX_MS - COOLDOWN_MIN_MS);
}

// Track failures per source (in-memory for Lambda execution)
const sourceFailures: Record<string, {
  consecutive: number;
  lastSuccess: number;
  lastFailure: number;
  markedDownAt: number;       // When the source crossed the "down" threshold
  cooldownDuration: number;   // Randomized cooldown for this source (different each time)
  failureReasons: string[];
}> = {};

// Blocked response patterns
const BLOCKED_PATTERNS = [
  /access denied/i,
  /blocked/i,
  /captcha/i,
  /cloudflare/i,
  /please verify/i,
  /rate limit/i,
  /too many requests/i,
  /robot check/i,
  /403 forbidden/i,
  /429 too many/i,
  /unusual traffic/i,
  /automated access/i,
  /bot detection/i,
];

export interface BotDetectionResult {
  isBlocked: boolean;
  reason?: string;
  statusCode?: number;
}

/**
 * Check if a response indicates bot blocking
 */
export function detectBlocking(
  content: string,
  statusCode?: number
): BotDetectionResult {
  // Check status code first
  if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
    return {
      isBlocked: true,
      reason: `HTTP ${statusCode}`,
      statusCode,
    };
  }

  // Check content for blocking patterns
  const lowerContent = content.toLowerCase();
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(lowerContent)) {
      return {
        isBlocked: true,
        reason: `Content matched: ${pattern.source}`,
        statusCode,
      };
    }
  }

  return { isBlocked: false, statusCode };
}

/**
 * Record a successful scrape for a source
 */
export function recordSuccess(source: string): void {
  if (!sourceFailures[source]) {
    sourceFailures[source] = {
      consecutive: 0,
      lastSuccess: Date.now(),
      lastFailure: 0,
      markedDownAt: 0,
      cooldownDuration: 0,
      failureReasons: [],
    };
  }

  const wasDown = sourceFailures[source].consecutive >= 5;
  sourceFailures[source].consecutive = 0;
  sourceFailures[source].lastSuccess = Date.now();
  sourceFailures[source].markedDownAt = 0;
  sourceFailures[source].cooldownDuration = 0;
  sourceFailures[source].failureReasons = [];

  if (wasDown) {
    logger.info(`Source ${source}: RECOVERED from down state`);
  } else {
    logger.debug(`Source ${source}: success recorded`);
  }
}

/**
 * Record a failure for a source
 */
export function recordFailure(source: string, reason: string): void {
  const DOWN_THRESHOLD = 5;

  if (!sourceFailures[source]) {
    sourceFailures[source] = {
      consecutive: 0,
      lastSuccess: 0,
      lastFailure: 0,
      markedDownAt: 0,
      cooldownDuration: 0,
      failureReasons: [],
    };
  }

  const tracker = sourceFailures[source];
  tracker.consecutive++;
  tracker.lastFailure = Date.now();
  tracker.failureReasons.push(reason);

  // Mark when source first crossed the down threshold with a random cooldown
  if (tracker.consecutive === DOWN_THRESHOLD && tracker.markedDownAt === 0) {
    tracker.markedDownAt = Date.now();
    tracker.cooldownDuration = getRandomCooldown();
    const cooldownMins = Math.round(tracker.cooldownDuration / 60000);
    logger.error(`Source ${source}: marked as DOWN after ${DOWN_THRESHOLD} failures, retry in ~${cooldownMins}min`);
  }

  // Keep only last 10 reasons
  if (tracker.failureReasons.length > 10) {
    tracker.failureReasons.shift();
  }

  logger.warn(`Source ${source}: failure #${tracker.consecutive} - ${reason}`);
}

/**
 * Check if a source should be considered down
 *
 * Sources are marked down after hitting the failure threshold, but they
 * get a retry opportunity after a randomized cooldown period (8-15 min).
 * This allows sources to recover from temporary blocking while avoiding
 * predictable retry patterns that could be detected.
 */
export function isSourceDown(source: string, threshold = 5): boolean {
  const tracker = sourceFailures[source];
  if (!tracker) return false;

  // Not enough failures to be considered down
  if (tracker.consecutive < threshold) {
    return false;
  }

  // Source is down, but check if cooldown has passed for a retry
  if (tracker.markedDownAt > 0 && tracker.cooldownDuration > 0) {
    const timeSinceDown = Date.now() - tracker.markedDownAt;

    if (timeSinceDown >= tracker.cooldownDuration) {
      // Reset timer and assign new random cooldown for next potential failure
      tracker.markedDownAt = Date.now();
      tracker.cooldownDuration = getRandomCooldown();
      logger.info(`Source ${source}: cooldown passed (${Math.round(timeSinceDown / 60000)}min), allowing retry attempt`);
      return false;  // Allow a retry
    }

    // Still in cooldown
    const remainingMs = tracker.cooldownDuration - timeSinceDown;
    const remainingMins = Math.round(remainingMs / 60000);
    logger.debug(`Source ${source}: still down, retry in ~${remainingMins}min`);
  }

  return true;
}

/**
 * Get source health summary
 */
export function getSourceHealth(): Record<string, {
  status: 'healthy' | 'degraded' | 'down' | 'cooldown';
  consecutiveFailures: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  nextRetryAt: Date | null;
  recentReasons: string[];
}> {
  const health: Record<string, any> = {};

  for (const [source, tracker] of Object.entries(sourceFailures)) {
    let status: 'healthy' | 'degraded' | 'down' | 'cooldown' = 'healthy';
    let nextRetryAt: Date | null = null;

    if (tracker.consecutive >= 5) {
      if (tracker.markedDownAt > 0 && tracker.cooldownDuration > 0) {
        const retryTime = tracker.markedDownAt + tracker.cooldownDuration;
        if (Date.now() < retryTime) {
          status = 'cooldown';
          nextRetryAt = new Date(retryTime);
        } else {
          status = 'down';  // Cooldown passed, will retry on next attempt
        }
      } else {
        status = 'down';
      }
    } else if (tracker.consecutive >= 2) {
      status = 'degraded';
    }

    health[source] = {
      status,
      consecutiveFailures: tracker.consecutive,
      lastSuccess: tracker.lastSuccess ? new Date(tracker.lastSuccess) : null,
      lastFailure: tracker.lastFailure ? new Date(tracker.lastFailure) : null,
      nextRetryAt,
      recentReasons: tracker.failureReasons.slice(-5),
    };
  }

  return health;
}

/**
 * Create a bot detection alert if needed
 */
export async function checkAndAlertBotDetection(
  source: string,
  runId?: string
): Promise<void> {
  const tracker = sourceFailures[source];
  if (!tracker) return;

  // Alert thresholds
  const DEGRADED_THRESHOLD = 2;
  const DOWN_THRESHOLD = 5;

  // Only alert on threshold crossings
  if (tracker.consecutive === DEGRADED_THRESHOLD) {
    await createBotAlert(
      'source_degraded',
      'warning',
      `Source ${source} is degraded: ${tracker.consecutive} consecutive failures`,
      source,
      tracker.failureReasons,
      runId
    );
  } else if (tracker.consecutive === DOWN_THRESHOLD) {
    await createBotAlert(
      'source_down',
      'critical',
      `Source ${source} appears to be blocked: ${tracker.consecutive} consecutive failures`,
      source,
      tracker.failureReasons,
      runId
    );
  }
}

/**
 * Create a bot detection alert
 */
async function createBotAlert(
  alertType: string,
  severity: string,
  message: string,
  source: string,
  reasons: string[],
  runId?: string
): Promise<void> {
  const db = getDb();

  // Check if similar alert exists in last 30 minutes (avoid spam)
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
  const existing = await db.query.scraperAlerts.findFirst({
    where: and(
      eq(scraperAlerts.alertType, alertType),
      gte(scraperAlerts.createdAt, thirtyMinsAgo),
      sql`${scraperAlerts.metadata}->>'source' = ${source}`
    ),
  });

  if (existing) {
    logger.debug('Skipping duplicate bot detection alert', { alertType, source });
    return;
  }

  // Create alert
  await db.execute(sql`
    INSERT INTO scraper_alerts (run_id, alert_type, severity, message, metadata)
    VALUES (
      ${runId || null}::uuid,
      ${alertType},
      ${severity},
      ${message},
      ${JSON.stringify({
        source,
        consecutiveFailures: sourceFailures[source]?.consecutive,
        recentReasons: reasons.slice(-5),
        detectedAt: new Date().toISOString(),
      })}::jsonb
    )
  `);

  logger.error(`🚨 BOT DETECTION ALERT: ${message}`, {
    alertType,
    severity,
    source,
    reasons: reasons.slice(-3),
  });
}

/**
 * Get recent bot detection alerts
 */
export async function getRecentBotAlerts(
  hoursBack = 24
): Promise<Array<{
  id: string;
  alertType: string;
  severity: string;
  message: string;
  source: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
}>> {
  const db = getDb();
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const alerts = await db.query.scraperAlerts.findMany({
    where: and(
      gte(scraperAlerts.createdAt, since),
      sql`${scraperAlerts.alertType} IN ('source_degraded', 'source_down', 'bot_detected')`
    ),
    orderBy: desc(scraperAlerts.createdAt),
    limit: 50,
  });

  return alerts.map(alert => ({
    id: alert.id,
    alertType: alert.alertType,
    severity: alert.severity,
    message: alert.message,
    source: (alert.metadata as any)?.source || 'unknown',
    createdAt: alert.createdAt,
    acknowledgedAt: alert.acknowledgedAt,
  }));
}

/**
 * Clear failure count for a source (e.g., after recovery)
 */
export function clearFailures(source: string): void {
  if (sourceFailures[source]) {
    sourceFailures[source].consecutive = 0;
    sourceFailures[source].markedDownAt = 0;
    sourceFailures[source].cooldownDuration = 0;
    sourceFailures[source].failureReasons = [];
    logger.info(`Source ${source}: failures cleared manually`);
  }
}

/**
 * Reset all source tracking (useful between Lambda invocations)
 */
export function resetAllTracking(): void {
  for (const source of Object.keys(sourceFailures)) {
    delete sourceFailures[source];
  }
}
