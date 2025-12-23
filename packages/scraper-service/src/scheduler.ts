/**
 * Job scheduler using node-cron
 *
 * Replaces EventBridge rules from Lambda with persistent cron-based scheduling.
 */

import cron from 'node-cron';
import { logger } from './logger.js';
import { getBrowserPool } from './browser/pool.js';
import { recordJobStart, recordJobComplete, recordJobFailed } from './monitoring/metrics.js';

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

const jobs: JobDefinition[] = [
  {
    name: 'sync-fixtures',
    schedule: '0 3 * * *', // Daily at 3 AM
    handler: async () => {
      if (syncFixtures) await syncFixtures();
    },
    enabled: true,
  },
  {
    name: 'sync-odds',
    schedule: '*/15 * * * *', // Every 15 minutes
    handler: async () => {
      if (syncOdds) await syncOdds();
    },
    enabled: true,
  },
  {
    name: 'sync-live-scores',
    schedule: '* * * * *', // Every minute
    handler: async () => {
      if (syncLiveScores) await syncLiveScores();
    },
    enabled: true,
  },
  {
    name: 'transition-events',
    schedule: '* * * * *', // Every minute
    handler: async () => {
      if (transitionEvents) await transitionEvents();
    },
    enabled: true,
  },
  {
    name: 'browser-rotation',
    schedule: '0 */6 * * *', // Every 6 hours - rotate browser contexts
    handler: async () => {
      const pool = getBrowserPool();
      await pool.recycleAllContexts('scheduled_rotation');
      logger.info('Scheduled browser context rotation completed');
    },
    enabled: true,
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

  logger.info(`Scheduler started with ${scheduledTasks.size} jobs`);
}

export function stopScheduler(): void {
  logger.info('Stopping job scheduler');

  for (const [name, task] of scheduledTasks) {
    task.stop();
    logger.info(`Stopped job: ${name}`);
  }

  scheduledTasks.clear();
}

export function getJobStatus(): Record<string, JobStatus> {
  const result: Record<string, JobStatus> = {};
  for (const [name, status] of jobStatuses) {
    result[name] = { ...status };
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
