/**
 * Scraper Service - VPS Entry Point
 *
 * Persistent service for web scraping with:
 * - Express health check API
 * - node-cron job scheduling
 * - Browser pool with lifecycle management
 * - Bot detection prevention
 */

import 'dotenv/config';
import express from 'express';
import { logger } from './logger.js';
import { initializeDatabase, closeDatabase } from './database/client.js';
import { getBrowserPool } from './browser/pool.js';
import { startScheduler, stopScheduler, initializeJobs } from './scheduler.js';
import { router as apiRouter } from './api/routes.js';

const PORT = parseInt(process.env.PORT || '3001');

async function main() {
  logger.info('Starting Scraper Service');

  // Initialize database connection
  try {
    initializeDatabase();
  } catch (error) {
    logger.error('Failed to initialize database', { error });
    process.exit(1);
  }

  // Initialize browser pool
  try {
    const browserPool = getBrowserPool();
    await browserPool.initialize();
  } catch (error) {
    logger.error('Failed to initialize browser pool', { error });
    process.exit(1);
  }

  // Initialize job handlers
  try {
    await initializeJobs();
  } catch (error) {
    logger.error('Failed to initialize jobs', { error });
    process.exit(1);
  }

  // Create Express app
  const app = express();
  app.use(express.json());
  app.use('/', apiRouter);

  // Start HTTP server
  const server = app.listen(PORT, () => {
    logger.info(`Health check server listening on port ${PORT}`);
  });

  // Start job scheduler
  startScheduler();

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    // Stop accepting new requests
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop scheduler
    stopScheduler();

    // Close browser pool
    try {
      const browserPool = getBrowserPool();
      await browserPool.close();
    } catch (error) {
      logger.error('Error closing browser pool', { error });
    }

    // Close database connections
    try {
      await closeDatabase();
    } catch (error) {
      logger.error('Error closing database', { error });
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });

  logger.info('Scraper Service started successfully');
}

main().catch((error) => {
  logger.error('Failed to start Scraper Service', { error });
  process.exit(1);
});
