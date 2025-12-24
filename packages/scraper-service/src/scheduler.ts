/**
 * Job scheduler using node-cron
 *
 * Replaces EventBridge rules from Lambda with persistent cron-based scheduling.
 * Includes smart scheduling for odds scraping to avoid detection.
 */

import cron from 'node-cron';
import { logger } from './logger.js';
import { getBrowserPool } from './browser/pool.js';
import { recordJobStart, recordJobComplete, recordJobFailed } from './monitoring/metrics.js';
import { getDb } from './database/client.js';
import { events } from '@sport-sage/database';
import { gte, lte, sql, and } from 'drizzle-orm';

// Job definitions
interface JobDefinition {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

// Job status tracking
interface JobStatus {
  name: string;
  lastRun: Date | null;
  lastDuration: number | null;
  lastStatus: 'success' | 'failed' | 'running' | 'never';
  nextRun: Date | null;
  runCount: number;
  failCount: number;
}

const jobStatuses: Map<string, JobStatus> = new Map();
const scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

// Job handlers - dynamically imported to avoid circular dependencies
let syncFixtures: (() => Promise<void>) | null = null;
let syncOdds: (() => Promise<void>) | null = null;
let syncLiveScores: (() => Promise<void>) | null = null;
let transitionEvents: (() => Promise<void>) | null = null;

export async function initializeJobs(): Promise<void> {
  // Dynamic imports for job handlers
  const fixturesModule = await import('./jobs/sync-fixtures.js');
  const oddsModule = await import('./jobs/sync-odds.js');
  const liveScoresModule = await import('./jobs/sync-live-scores.js');
  const transitionModule = await import('./jobs/transition-events.js');

  syncFixtures = fixturesModule.runSyncFixtures;
  syncOdds = oddsModule.runSyncOdds;
  syncLiveScores = liveScoresModule.runSyncLiveScores;
  transitionEvents = transitionModule.runTransitionEvents;
}

// Set to true to enable cron-based scheduling, false for manual-only testing
const CRON_ENABLED = process.env.ENABLE_CRON === 'true';

// Smart scheduling for sync-odds to avoid detection
let nextOddsSyncTime: Date | null = null;
let oddsSyncTimeout: NodeJS.Timeout | null = null;

/**
 * Check upcoming events and return urgency level
 * Returns: 'imminent' (0-2h), 'soon' (2-6h), 'later' (6-24h), 'none' (no events)
 */
async function getEventUrgency(): Promise<'imminent' | 'soon' | 'later' | 'none'> {
  try {
    const db = getDb();
    const now = new Date();
    const twoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const sixHours = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Check for imminent events (next 2 hours)
    const imminent = await db.query.events.findFirst({
      where: and(
        sql`${events.status}::text = 'scheduled'`,
        gte(events.startTime, now),
        lte(events.startTime, twoHours)
      ),
    });

    if (imminent) return 'imminent';

    // Check for events in next 2-6 hours
    const soon = await db.query.events.findFirst({
      where: and(
        sql`${events.status}::text = 'scheduled'`,
        gte(events.startTime, twoHours),
        lte(events.startTime, sixHours)
      ),
    });

    if (soon) return 'soon';

    // Check for events in next 6-24 hours
    const later = await db.query.events.findFirst({
      where: and(
        sql`${events.status}::text = 'scheduled'`,
        gte(events.startTime, sixHours),
        lte(events.startTime, tomorrow)
      ),
    });

    if (later) return 'later';

    return 'none';
  } catch (error) {
    logger.warn('Failed to check upcoming events, assuming imminent', { error });
    return 'imminent'; // Fail-safe: assume urgent
  }
}

/**
 * Calculate weighted random delay based on:
 * - Event urgency (imminent/soon/later/none)
 * - Time of day (off-peak = longer delays)
 * - Multi-source load distribution
 */
function getSmartDelay(urgency: 'imminent' | 'soon' | 'later' | 'none'): number {
  const hour = new Date().getHours();

  // Base delays by urgency (with 4 sources, we can be slightly more frequent)
  // Imminent (0-2h): 45-75 min - need fresh odds
  // Soon (2-6h): 60-90 min - moderate freshness
  // Later (6-24h): 90-150 min - original timing
  // None: 4-6 hours - just check periodically
  let minDelay: number;
  let maxDelay: number;

  switch (urgency) {
    case 'imminent':
      minDelay = 45 * 60 * 1000;  // 45 min
      maxDelay = 75 * 60 * 1000;  // 1h 15min
      break;
    case 'soon':
      minDelay = 60 * 60 * 1000;  // 1 hour
      maxDelay = 90 * 60 * 1000;  // 1.5 hours
      break;
    case 'later':
      minDelay = 90 * 60 * 1000;  // 1.5 hours
      maxDelay = 150 * 60 * 1000; // 2.5 hours
      break;
    case 'none':
      minDelay = 240 * 60 * 1000; // 4 hours
      maxDelay = 360 * 60 * 1000; // 6 hours
      break;
  }

  // Off-peak multiplier (longer delays at night = less suspicious)
  let multiplier = 1.0;
  if (hour >= 0 && hour < 6) {
    // Midnight to 6am: extend delays by 50%
    multiplier = 1.5;
  } else if (hour >= 22 || hour < 1) {
    // 10pm to 1am: extend delays by 30%
    multiplier = 1.3;
  } else if (hour >= 6 && hour < 9) {
    // Early morning 6-9am: slight extension
    multiplier = 1.2;
  }

  // Random delay within range, then apply multiplier
  const baseDelay = minDelay + Math.random() * (maxDelay - minDelay);
  const delay = Math.floor(baseDelay * multiplier);

  // Add extra jitter (±10 minutes)
  const jitter = (Math.random() - 0.5) * 20 * 60 * 1000;

  // Minimum delay based on urgency
  const minimums: Record<string, number> = {
    imminent: 30 * 60 * 1000, // 30 min
    soon: 45 * 60 * 1000,     // 45 min
    later: 60 * 60 * 1000,    // 1 hour
    none: 180 * 60 * 1000,    // 3 hours
  };

  return Math.max(minimums[urgency] || 60 * 60 * 1000, delay + jitter);
}

/**
 * Schedule next odds sync with smart timing based on event urgency
 */
async function scheduleNextOddsSync(): Promise<void> {
  if (!CRON_ENABLED || !syncOdds) return;

  // Check event urgency to determine timing
  const urgency = await getEventUrgency();
  const delay = getSmartDelay(urgency);
  nextOddsSyncTime = new Date(Date.now() + delay);

  const urgencyLabels = {
    imminent: 'events in 0-2h',
    soon: 'events in 2-6h',
    later: 'events in 6-24h',
    none: 'no events in 24h',
  };

  logger.info(`Next odds sync: ${nextOddsSyncTime.toISOString()} (in ${Math.round(delay / 60000)}min) - ${urgencyLabels[urgency]}`);

  oddsSyncTimeout = setTimeout(async () => {
    try {
      // Re-check urgency before running
      const currentUrgency = await getEventUrgency();

      if (currentUrgency === 'none') {
        logger.info('No upcoming events in next 24h, skipping odds sync');
        scheduleNextOddsSync(); // Schedule next check
        return;
      }

      // Run the actual sync
      const job = jobs.find(j => j.name === 'sync-odds');
      if (job) {
        await runJob(job);
      }
    } catch (error) {
      logger.error('Smart odds sync failed', { error });
    } finally {
      // Schedule next run
      scheduleNextOddsSync();
    }
  }, delay);
}

const jobs: JobDefinition[] = [
  {
    name: 'sync-fixtures',
    schedule: '0 3 * * *', // Daily at 3 AM
    handler: async () => {
      if (syncFixtures) await syncFixtures();
    },
    enabled: CRON_ENABLED,
  },
  {
    name: 'sync-odds',
    schedule: '', // Empty - uses smart scheduling instead of cron
    handler: async () => {
      if (syncOdds) await syncOdds();
    },
    enabled: false, // Disabled for cron - uses smart scheduler
  },
  {
    name: 'sync-live-scores',
    schedule: '*/2 * * * *', // Every 2 minutes
    handler: async () => {
      if (syncLiveScores) await syncLiveScores();
    },
    enabled: CRON_ENABLED,
  },
  {
    name: 'transition-events',
    schedule: '* * * * *', // Every minute
    handler: async () => {
      if (transitionEvents) await transitionEvents();
    },
    enabled: CRON_ENABLED,
  },
  {
    name: 'browser-rotation',
    schedule: '0 */6 * * *', // Every 6 hours - rotate browser contexts
    handler: async () => {
      const pool = getBrowserPool();
      await pool.recycleAllContexts('scheduled_rotation');
      logger.info('Scheduled browser context rotation completed');
    },
    enabled: CRON_ENABLED,
  },
];

async function runJob(job: JobDefinition): Promise<void> {
  const status = jobStatuses.get(job.name) || {
    name: job.name,
    lastRun: null,
    lastDuration: null,
    lastStatus: 'never' as const,
    nextRun: null,
    runCount: 0,
    failCount: 0,
  };

  // Check if already running
  if (status.lastStatus === 'running') {
    logger.warn(`Job ${job.name} is already running, skipping`);
    return;
  }

  const startTime = Date.now();
  status.lastRun = new Date();
  status.lastStatus = 'running';
  status.runCount++;
  jobStatuses.set(job.name, status);

  recordJobStart(job.name);
  logger.info(`Starting job: ${job.name}`);

  try {
    await job.handler();
    status.lastDuration = Date.now() - startTime;
    status.lastStatus = 'success';
    recordJobComplete(job.name, status.lastDuration, true);
    logger.info(`Job completed: ${job.name}`, { durationMs: status.lastDuration });
  } catch (error) {
    status.lastDuration = Date.now() - startTime;
    status.lastStatus = 'failed';
    status.failCount++;
    recordJobFailed(job.name, error as Error);
    logger.error(`Job failed: ${job.name}`, { error, durationMs: status.lastDuration });
  }

  jobStatuses.set(job.name, status);
}

export function startScheduler(): void {
  logger.info('Starting job scheduler');

  for (const job of jobs) {
    if (!job.enabled) {
      logger.info(`Job ${job.name} is disabled, skipping`);
      continue;
    }

    // Validate cron expression
    if (!cron.validate(job.schedule)) {
      logger.error(`Invalid cron expression for job ${job.name}: ${job.schedule}`);
      continue;
    }

    // Initialize status
    jobStatuses.set(job.name, {
      name: job.name,
      lastRun: null,
      lastDuration: null,
      lastStatus: 'never',
      nextRun: null,
      runCount: 0,
      failCount: 0,
    });

    // Schedule the job
    const task = cron.schedule(job.schedule, () => {
      runJob(job).catch((error) => {
        logger.error(`Unhandled error in job ${job.name}`, { error });
      });
    });

    scheduledTasks.set(job.name, task);
    logger.info(`Scheduled job: ${job.name} (${job.schedule})`);
  }

  // Start smart odds scheduling (separate from cron)
  if (CRON_ENABLED) {
    logger.info('Starting smart odds scheduler (urgency-based: 45min-6h, off-peak weighted)');
    // Initialize sync-odds status
    jobStatuses.set('sync-odds', {
      name: 'sync-odds',
      lastRun: null,
      lastDuration: null,
      lastStatus: 'never',
      nextRun: null,
      runCount: 0,
      failCount: 0,
    });
    // Start async scheduling (don't await - it's fire-and-forget)
    scheduleNextOddsSync().catch((error) => {
      logger.error('Failed to start smart odds scheduler', { error });
    });
  } else {
    logger.info('Smart odds scheduler disabled (ENABLE_CRON=false)');
  }

  logger.info(`Scheduler started with ${scheduledTasks.size} cron jobs + smart odds scheduler`);
}

export function stopScheduler(): void {
  logger.info('Stopping job scheduler');

  for (const [name, task] of scheduledTasks) {
    task.stop();
    logger.info(`Stopped job: ${name}`);
  }

  scheduledTasks.clear();

  // Stop smart odds scheduler
  if (oddsSyncTimeout) {
    clearTimeout(oddsSyncTimeout);
    oddsSyncTimeout = null;
    nextOddsSyncTime = null;
    logger.info('Stopped smart odds scheduler');
  }
}

export function getJobStatus(): Record<string, JobStatus & { nextScheduledRun?: string }> {
  const result: Record<string, JobStatus & { nextScheduledRun?: string }> = {};
  for (const [name, status] of jobStatuses) {
    result[name] = { ...status };
    // Add next scheduled run time for sync-odds
    if (name === 'sync-odds' && nextOddsSyncTime) {
      result[name].nextScheduledRun = nextOddsSyncTime.toISOString();
    }
  }
  return result;
}

export async function triggerJob(jobName: string): Promise<void> {
  const job = jobs.find((j) => j.name === jobName);
  if (!job) {
    throw new Error(`Unknown job: ${jobName}`);
  }
  await runJob(job);
}
