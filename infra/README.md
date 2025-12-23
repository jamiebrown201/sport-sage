# Sport Sage Infrastructure

## AWS Configuration

**Region: `eu-west-1` (Ireland)**

All Sport Sage stacks are deployed to eu-west-1. Make sure to specify the region when using AWS CLI:

```bash
# Option 1: Set environment variable
export AWS_DEFAULT_REGION=eu-west-1

# Option 2: Use --region flag
aws lambda list-functions --region eu-west-1
```

## Stacks

| Stack | Purpose |
|-------|---------|
| SportSage-Dev-Database | Aurora Serverless v2 PostgreSQL |
| SportSage-Dev-Auth | Cognito User Pool |
| SportSage-Dev-Queues | SQS settlement queue |
| SportSage-Dev-Api | HTTP API Gateway + Lambda handlers |
| SportSage-Dev-Scraper | Scheduled scraper jobs |
| SportSage-Dev-Migration | Database migrations |

## Scraper Jobs

| Job | Schedule | Uses Proxy | Notes |
|-----|----------|------------|-------|
| sync-fixtures | Daily (24h) | Yes | FlashScore - ~1GB/run |
| sync-live-scores | Every 1 min | No* | ESPN/SofaScore APIs (free) |
| sync-odds | Every 15 min | No | OddsPortal (free) |
| transition-events | Every 1 min | No | DB-only, marks scheduled->live |
| settlement | SQS trigger | No | Processes finished events |

*sync-live-scores may use proxy as fallback for FlashScore if APIs fail

## Proxy Cost Estimation

- **DataImpulse**: $1/GB (primary)
- **IPRoyal**: $1.75/GB (backup)

With current settings:
- sync-fixtures: ~$1/day (~$30/month)
- Other jobs: Free (use APIs or no proxy)

## Deployment

```bash
cd infra
pnpm cdk deploy SportSage-Dev-Scraper --require-approval never
```

## Useful Commands

```bash
# Check Lambda config
aws lambda get-function-configuration --function-name sport-sage-dev-sync-fixtures --region eu-west-1

# Check concurrency (separate API)
aws lambda get-function-concurrency --function-name sport-sage-dev-sync-fixtures --region eu-west-1

# Tail logs
aws logs tail /aws/lambda/sport-sage-dev-sync-fixtures --region eu-west-1 --since 1h --follow

# List EventBridge rules
aws events list-rules --region eu-west-1
```
