# Sport Sage - Claude Code Instructions

## Infrastructure Rules

**CRITICAL: All infrastructure changes MUST go through CDK**

- NEVER create database tables, enums, indexes, or any database objects via CLI commands
- NEVER use `aws rds-data execute-statement` to create or modify schema
- NEVER use AWS CLI to create any resources that should be managed by CDK
- ALL database schema changes must be done through Drizzle migrations deployed via CDK
- ALL AWS resources must be defined in `/infra/lib/stacks/`
- Use `--exclusively` flag when deploying a single stack to avoid dependency issues

### Database Migrations

Database migrations are managed by the Migration Stack (`/infra/lib/stacks/migration-stack.ts`):

1. Modify schema in `/packages/database/src/schema/`
2. Generate migration: `cd packages/database && pnpm generate`
3. Deploy: `cd infra && npx cdk deploy SportSage-Dev-Migration`

The migration Lambda runs automatically on every deployment and applies pending Drizzle migrations via RDS Data API.

### CDK Stacks

| Stack | Purpose |
|-------|---------|
| Database | Aurora Serverless v2, VPC, Security Groups |
| Migration | Drizzle migrations (runs on deploy) |
| Auth | Cognito User Pool |
| Queues | SQS queues for async processing |
| Api | API Gateway + Lambda handlers |
| Scraper | Scheduled scraper jobs |

### Deployment Order

Stacks are deployed in dependency order:
1. Database
2. Migration (depends on Database)
3. Auth, Queues (independent)
4. Api (depends on Database, Migration, Auth, Queues)
5. Scraper (depends on Database, Migration, Queues)

## Project Structure

```
sport-sage/
├── packages/
│   ├── api/           # Lambda API handlers
│   ├── database/      # Drizzle schema & migrations
│   ├── scraper/       # Scraper jobs
│   └── shared/        # Shared types & schemas
├── infra/             # AWS CDK
│   ├── bin/app.ts     # Stack definitions
│   └── lib/stacks/    # Individual stacks
├── mobile/            # React Native Expo app
└── dashboard/         # Monitoring dashboard (static HTML)
```

## Bot Detection & Recovery

The scraper uses randomized cooldowns (8-15 min) for sources that get blocked. See `/packages/scraper/src/utils/bot-detection.ts`. This avoids predictable retry patterns.
