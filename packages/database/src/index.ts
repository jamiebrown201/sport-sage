import { drizzle as drizzleDataApi } from 'drizzle-orm/aws-data-api/pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { RDSDataClient } from '@aws-sdk/client-rds-data';
import pg from 'pg';
import * as schema from './schema/index.js';

// Re-export all schema
export * from './schema/index.js';

// Re-export team utilities
export * from './utils/team-utils.js';

// Database client singleton
let db: ReturnType<typeof createDb> | null = null;

function createDb() {
  // Check if we have a local DATABASE_URL (for local development)
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    return drizzlePg(pool, { schema });
  }

  // Check if we have AWS Data API credentials (for production/AWS)
  if (process.env.DATABASE_RESOURCE_ARN && process.env.DATABASE_SECRET_ARN) {
    const client = new RDSDataClient({
      region: process.env.AWS_REGION || 'eu-west-1',
    });

    return drizzleDataApi(client, {
      database: process.env.DATABASE_NAME || 'sportsage',
      secretArn: process.env.DATABASE_SECRET_ARN,
      resourceArn: process.env.DATABASE_RESOURCE_ARN,
      schema,
    });
  }

  // No database configuration found
  throw new Error(
    'Database configuration missing. Set either:\n' +
    '  - DATABASE_URL for local PostgreSQL connection\n' +
    '  - DATABASE_RESOURCE_ARN and DATABASE_SECRET_ARN for AWS Aurora Data API'
  );
}

export function getDb() {
  if (!db) {
    db = createDb();
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
