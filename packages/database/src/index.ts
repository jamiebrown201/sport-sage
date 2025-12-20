import { drizzle } from 'drizzle-orm/aws-data-api/pg';
import { RDSDataClient } from '@aws-sdk/client-rds-data';
import * as schema from './schema';

// Re-export all schema
export * from './schema';

// Database client singleton
let db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const client = new RDSDataClient({
    region: process.env.AWS_REGION || 'eu-west-1',
  });

  return drizzle(client, {
    database: process.env.DATABASE_NAME || 'sportsage',
    secretArn: process.env.DATABASE_SECRET_ARN!,
    resourceArn: process.env.DATABASE_RESOURCE_ARN!,
    schema,
  });
}

export function getDb() {
  if (!db) {
    db = createDb();
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
