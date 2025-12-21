import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration Lambda handler
 *
 * This runs during CDK deployment to push schema changes to the database.
 * Uses RDS Data API so it doesn't need VPC access.
 */

const rdsClient = new RDSDataClient({});

interface CloudFormationEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  PhysicalResourceId?: string;
  ResourceProperties: {
    ClusterArn: string;
    SecretArn: string;
    DatabaseName: string;
  };
}

interface CloudFormationResponse {
  Status: 'SUCCESS' | 'FAILED';
  Reason?: string;
  PhysicalResourceId: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  Data?: Record<string, string>;
}

export async function handler(event: CloudFormationEvent): Promise<void> {
  console.log('Migration event:', JSON.stringify(event, null, 2));

  const physicalResourceId = event.PhysicalResourceId || `migration-${Date.now()}`;
  const { ClusterArn, SecretArn, DatabaseName } = event.ResourceProperties;

  try {
    // For Delete, just succeed - nothing to do
    if (event.RequestType === 'Delete') {
      await sendResponse(event, {
        Status: 'SUCCESS',
        PhysicalResourceId: physicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
      });
      return;
    }

    // Read and execute migration files
    // In Lambda, the bundled output has drizzle/ at the root level
    const migrationsDir = process.env.LAMBDA_TASK_ROOT
      ? path.join(process.env.LAMBDA_TASK_ROOT, 'drizzle')
      : path.join(__dirname, '../drizzle');
    console.log('Looking for migrations in:', migrationsDir);

    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found, skipping');
      await sendResponse(event, {
        Status: 'SUCCESS',
        PhysicalResourceId: physicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: { Message: 'No migrations to apply' },
      });
      return;
    }

    // Get all SQL files in order
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files`);

    // Create migrations tracking table if it doesn't exist
    await executeSql(ClusterArn, SecretArn, DatabaseName, `
      CREATE TABLE IF NOT EXISTS drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const appliedResult = await executeSql(ClusterArn, SecretArn, DatabaseName,
      'SELECT hash FROM drizzle_migrations'
    );
    const appliedHashes = new Set(
      (appliedResult.records || []).map((r: any) => r[0]?.stringValue)
    );

    let applied = 0;
    for (const file of files) {
      const hash = file.replace('.sql', '');

      if (appliedHashes.has(hash)) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      // Split by statement and execute each (RDS Data API doesn't support multi-statement)
      const statements = splitStatements(sql);

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await executeSql(ClusterArn, SecretArn, DatabaseName, statement);
          } catch (err) {
            // Ignore "already exists" errors for idempotency
            const errMsg = err instanceof Error ? err.message : String(err);
            if (!errMsg.includes('already exists') && !errMsg.includes('duplicate')) {
              throw err;
            }
            console.log(`Ignoring: ${errMsg}`);
          }
        }
      }

      // Record migration as applied
      await executeSql(ClusterArn, SecretArn, DatabaseName,
        `INSERT INTO drizzle_migrations (hash) VALUES ('${hash}')`
      );

      applied++;
      console.log(`Applied ${file}`);
    }

    console.log(`Migrations complete: ${applied} applied, ${files.length - applied} skipped`);

    await sendResponse(event, {
      Status: 'SUCCESS',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: { Message: `Applied ${applied} migrations` },
    });
  } catch (error) {
    console.error('Migration failed:', error);

    await sendResponse(event, {
      Status: 'FAILED',
      Reason: error instanceof Error ? error.message : String(error),
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    });
  }
}

async function executeSql(
  clusterArn: string,
  secretArn: string,
  database: string,
  sql: string
): Promise<any> {
  return rdsClient.send(new ExecuteStatementCommand({
    resourceArn: clusterArn,
    secretArn: secretArn,
    database: database,
    sql: sql,
  }));
}

/**
 * Split SQL into individual statements
 * Drizzle migrations use `--> statement-breakpoint` as delimiter
 */
function splitStatements(sql: string): string[] {
  // Drizzle uses `--> statement-breakpoint` as delimiter
  return sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));
}

async function sendResponse(
  event: CloudFormationEvent,
  response: CloudFormationResponse
): Promise<void> {
  const body = JSON.stringify(response);
  console.log('Sending response:', body);

  const url = new URL(event.ResponseURL);

  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': '',
      'Content-Length': String(Buffer.byteLength(body)),
    },
    body,
  });

  console.log('Response status:', res.status);
}
