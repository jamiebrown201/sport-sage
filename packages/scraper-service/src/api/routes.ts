/**
 * Health check and trigger API endpoints
 */

import express, { Router } from 'express';
import { healthCheck as dbHealthCheck } from '../database/client.js';
import { getBrowserPoolStats } from '../browser/pool.js';
import { getMetrics } from '../monitoring/metrics.js';
import { getJobStatus, triggerJob } from '../scheduler.js';
import { logger } from '../logger.js';

export const router: Router = express.Router();

// Health check endpoint
router.get('/health', async (_req, res) => {
  const dbHealth = await dbHealthCheck();
  const browserStats = getBrowserPoolStats();
  const metrics = getMetrics();
  const jobStatus = getJobStatus();

  const isHealthy = dbHealth.ok && browserStats.activeContexts < browserStats.maxContexts;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      connected: dbHealth.ok,
      latencyMs: dbHealth.latencyMs,
    },
    browserPool: browserStats,
    jobs: jobStatus,
    metrics: {
      successRate: metrics.successRate,
      blockedRate: metrics.blockedRate,
      avgResponseTime: metrics.avgResponseTime,
      lastBlock: metrics.lastBlock,
    },
  });
});

// Detailed metrics endpoint
router.get('/metrics', (_req, res) => {
  const metrics = getMetrics();
  res.json(metrics);
});

// Manual job trigger endpoint (for testing/debugging)
router.post('/jobs/:jobName/trigger', async (req, res) => {
  const { jobName } = req.params;
  const validJobs = ['sync-fixtures', 'sync-odds', 'sync-live-scores', 'transition-events'];

  if (!validJobs.includes(jobName)) {
    res.status(400).json({ error: `Invalid job name. Valid jobs: ${validJobs.join(', ')}` });
    return;
  }

  logger.info(`Manual trigger requested for job: ${jobName}`);

  try {
    await triggerJob(jobName);
    res.json({ success: true, message: `Job ${jobName} triggered` });
  } catch (error) {
    logger.error(`Failed to trigger job ${jobName}`, { error });
    res.status(500).json({ error: 'Failed to trigger job' });
  }
});

// Job status endpoint
router.get('/jobs', (_req, res) => {
  res.json(getJobStatus());
});
