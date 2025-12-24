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
 * Check if there are any upcoming events in the next 24 hours
 */
async function hasUpcomingEvents(): Promise<boolean> {
  try {
    const db = getDb();
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcoming = await db.query.events.findFirst({
      where: and(
        sql`${events.status}::text = 'scheduled'`,
        gte(events.startTime, now),
        lte(events.startTime, tomorrow)
      ),
    });

    return !!upcoming;
  } catch (error) {
    logger.warn('Failed to check upcoming events, assuming there are some', { error });
    return true; // Fail-safe: assume there are events
  }
}

/**
 * Calculate weighted random delay based on time of day
 * Off-peak hours (midnight-6am, 10pm-midnight) get longer delays
 * Peak hours (6am-10pm) get shorter delays
 */
function getSmartDelay(): number {
  const hour = new Date().getHours();

  // Base delay: 90-150 minutes (1.5-2.5 hours)
  const minDelay = 90 * 60 * 1000;  // 1.5 hours
  const maxDelay = 150 * 60 * 1000; // 2.5 hours

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

  return Math.max(60 * 60 * 1000, delay + jitter); // Minimum 1 hour
}

/**
 * Schedule next odds sync with smart timing
 */
function scheduleNextOddsSync(): void {
  if (!CRON_ENABLED || !syncOdds) return;

  const delay = getSmartDelay();
  nextOddsSyncTime = new Date(Date.now() + delay);

  logger.info(`Next odds sync scheduled for ${nextOddsSyncTime.toISOString()} (in ${Math.round(delay / 60000)} minutes)`);

  oddsSyncTimeout = setTimeout(async () => {
    try {
      // Check if there are upcoming events first
      const hasEvents = await hasUpcomingEvents();
      if (!hasEvents) {
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
    schedule: '* * * * *', // Every minute
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
    logger.info('Starting smart odds scheduler (variable 1.5-2.5h intervals, off-peak weighted)');
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
    scheduleNextOddsSync();
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
