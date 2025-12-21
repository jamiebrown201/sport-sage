import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';

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

const SPORTS = [
  { name: 'Football', slug: 'football', iconName: 'football', sortOrder: 1 },
  { name: 'Tennis', slug: 'tennis', iconName: 'tennis', sortOrder: 2 },
  { name: 'Basketball', slug: 'basketball', iconName: 'basketball', sortOrder: 3 },
  { name: 'Darts', slug: 'darts', iconName: 'target', sortOrder: 4 },
  { name: 'Cricket', slug: 'cricket', iconName: 'cricket', sortOrder: 5 },
  { name: 'American Football', slug: 'american_football', iconName: 'football-helmet', sortOrder: 6 },
  { name: 'Golf', slug: 'golf', iconName: 'golf', sortOrder: 7 },
  { name: 'Boxing', slug: 'boxing', iconName: 'boxing-glove', sortOrder: 8 },
  { name: 'MMA', slug: 'mma', iconName: 'mma', sortOrder: 9 },
  { name: 'Formula 1', slug: 'f1', iconName: 'f1', sortOrder: 10 },
  { name: 'Horse Racing', slug: 'horse_racing', iconName: 'horse', sortOrder: 11 },
  { name: 'Rugby', slug: 'rugby', iconName: 'rugby', sortOrder: 12 },
  { name: 'Ice Hockey', slug: 'ice_hockey', iconName: 'hockey', sortOrder: 13 },
  { name: 'Baseball', slug: 'baseball', iconName: 'baseball', sortOrder: 14 },
  { name: 'Esports', slug: 'esports', iconName: 'gamepad', sortOrder: 15 },
];

async function seed() {
  console.log('Seeding sports...');

  for (const sport of SPORTS) {
    const sql = `
      INSERT INTO sports (name, slug, icon_name, sort_order, is_active)
      VALUES ('${sport.name}', '${sport.slug}', '${sport.iconName}', ${sport.sortOrder}, true)
      ON CONFLICT (slug) DO NOTHING
    `;

    try {
      await executeStatement(sql);
      console.log(`  ✓ ${sport.name}`);
    } catch (err) {
      console.error(`  ✗ ${sport.name}:`, err.message);
    }
  }

  console.log('\n✅ Seeding completed!');

  // Verify
  const result = await executeStatement('SELECT COUNT(*) as count FROM sports');
  console.log(`\nTotal sports in database: ${result.records[0][0].longValue}`);
}

seed().catch(console.error);
