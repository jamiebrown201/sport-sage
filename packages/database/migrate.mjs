import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';
import { readFileSync } from 'fs';

const client = new RDSDataClient({ region: 'eu-west-1' });

const CLUSTER_ARN = 'arn:aws:rds:eu-west-1:238708724680:cluster:sportsage-dev-database-databaseb269d8bb-jgbqgx6yzvi7';
const SECRET_ARN = 'arn:aws:secretsmanager:eu-west-1:238708724680:secret:DatabaseSecret3B817195-R7aao5xJupze-Lkf02d';
const DATABASE = 'sportsage';

async function executeStatement(sql) {
  const command = new ExecuteStatementCommand({
    resourceArn: CLUSTER_ARN,
    secretArn: SECRET_ARN,
    database: DATABASE,
    sql,
  });
  return client.send(command);
}

async function runMigration() {
  const sql = readFileSync('drizzle/0000_pale_post.sql', 'utf-8');

  // Split by statement breakpoint
  const statements = sql.split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Running ${statements.length} statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    process.stdout.write(`[${i + 1}/${statements.length}] `);

    try {
      await executeStatement(stmt);
      console.log('✓');
    } catch (err) {
      console.log('✗');
      console.error(`Error on statement ${i + 1}:`, err.message);
      console.error('Statement:', stmt.substring(0, 100) + '...');
      process.exit(1);
    }
  }

  console.log('\n✅ Migration completed successfully!');
}

runMigration().catch(console.error);
