/**
 * Database client for VPS scraper service
 *
 * Uses the shared @sport-sage/database package which supports both:
 * - DATABASE_URL for direct PostgreSQL (VPS/local)
 * - AWS Data API credentials (Lambda)
 *
 * For VPS deployment, set DATABASE_URL environment variable.
 */

import { getDb as getSharedDb, type Database } from '@sport-sage/database';
import pg from 'pg';
import { logger } from '../logger.js';

let pool: pg.Pool | null = null;

/**
 * Initialize database connection
 * Uses DATABASE_URL for direct PostgreSQL connection
 */
export function initializeDatabase(): void {
  // Build DATABASE_URL from component parts if not provided directly
  if (!process.env.DATABASE_URL) {
    const host = process.env.DATABASE_HOST;
    const port = process.env.DATABASE_PORT || '5432';
    const database = process.env.DATABASE_NAME || 'sportsage';
    const user = process.env.DATABASE_USER;
    const password = process.env.DATABASE_PASSWORD;

    if (host && user && password) {
      const ssl = process.env.DATABASE_SSL !== 'false' ? '?sslmode=require' : '';
      process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${database}${ssl}`;
      logger.info('Database URL constructed from components', { host, database });
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Missing database configuration. Set either:\n' +
        '  - DATABASE_URL for direct PostgreSQL connection\n' +
        '  - DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD for component config'
    );
  }

  // Create a pool for health checks
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected database pool error', { error: err.message });
  });

  // Verify connection by getting the shared db
  getSharedDb();
  logger.info('Database connection initialized');
}

/**
 * Get the Drizzle database instance
 * Uses the shared package which handles the connection
 */
export function getDb(): Database {
  return getSharedDb();
}

/**
 * Get the raw pg Pool for health checks
 */
export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Close database connections
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

/**
 * Health check for database connectivity
 */
export async function healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const p = getPool();
    await p.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return { ok: false, latencyMs: Date.now() - start };
  }
}
